-- ============================================================================
-- QLCN — Migration 0002: mở rộng
--   (1) Năm học tái sử dụng   (2) Thủ quỹ (HS gán thêm quyền)
--   (3) Thu chi quỹ lớp        (4) Thông báo có chọn người nhận
-- Chạy SAU schema gốc (0001_init.sql lấy từ QLCN-03). Mọi bảng bật RLS.
-- Nhãn UI tiếng Việt; tên bảng/cột tiếng Anh.
-- ============================================================================

-- ============================================================================
-- 1) NĂM HỌC TÁI SỬ DỤNG
--    Mỗi năm = 1 hàng `classes` mới (cùng name, khác school_year).
--    archived=true: lớp năm cũ, chỉ đọc. source_class_id: lớp gốc được nhân bản.
-- ============================================================================
alter table classes
  add column if not exists archived        boolean not null default false,
  add column if not exists source_class_id uuid references classes(id);

-- ============================================================================
-- 2) THỦ QUỸ  (Cách A: HS được gán thêm quyền — KHÔNG thêm role mới)
-- ============================================================================
alter table students
  add column if not exists is_treasurer boolean not null default false;

-- Helper RLS: user hiện tại có là thủ quỹ của lớp này không?
create or replace function is_treasurer_of(p_class_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from students s
    where s.class_id = p_class_id
      and s.user_id  = auth.uid()
      and s.is_treasurer = true
  );
$$;

-- ============================================================================
-- 3) THU CHI QUỸ LỚP  (chỉ ghi sổ minh bạch, KHÔNG cổng thanh toán)
-- ============================================================================

-- Cấu hình mức đóng: bao nhiêu / tuần / HS
create table if not exists fund_config (
  class_id      uuid primary key references classes(id) on delete cascade,
  weekly_amount int  not null default 0,   -- đồng / tuần / HS
  note          text
);

-- Sổ cái thu/chi
create table if not exists fund_transactions (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references classes(id) on delete cascade,
  kind        text not null check (kind in ('thu','chi')),
  amount      int  not null check (amount >= 0),
  student_id  uuid references students(id),   -- 'thu' theo HS; null nếu thu/chi chung
  week        text,                           -- "2026-W12" cho khoản thu theo tuần
  category    text,                           -- 'chi': "nước","in ấn"...
  note        text,
  recorded_by uuid not null references profiles(id),
  created_at  timestamptz default now()
);
create index if not exists idx_fund_tx_class_week on fund_transactions (class_id, week);
create index if not exists idx_fund_tx_class_kind on fund_transactions (class_id, kind);

-- ============================================================================
-- 4) THÔNG BÁO  (soạn 1 lần → chọn All / tùy chọn HS hoặc PH → fan-out)
--    Fan-out sang bảng `notifications` (đã có) + Web Push do Edge Function làm.
-- ============================================================================
create table if not exists announcements (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references classes(id) on delete cascade,
  title      text not null,
  body       text,
  audience   text not null check (audience in ('hs','phhs','both')),
  scope      text not null default 'all' check (scope in ('all','custom')),
  created_by uuid not null references profiles(id),
  created_at timestamptz default now(),
  sent_at    timestamptz              -- null = nháp; set khi đã fan-out
);

-- Chỉ dùng khi scope='custom': danh sách HS được chọn (audience quyết định gửi HS/PH/cả hai)
create table if not exists announcement_targets (
  announcement_id uuid not null references announcements(id) on delete cascade,
  student_id      uuid not null references students(id) on delete cascade,
  primary key (announcement_id, student_id)
);

-- ============================================================================
-- 5) RLS
-- ============================================================================
alter table fund_config          enable row level security;
alter table fund_transactions    enable row level security;
alter table announcements        enable row level security;
alter table announcement_targets enable row level security;

-- ----- fund_config: GVCN toàn quyền; thủ quỹ đọc -----
create policy fund_config_gvcn on fund_config
  for all using (is_gvcn_of(class_id)) with check (is_gvcn_of(class_id));
create policy fund_config_treasurer_read on fund_config
  for select using (is_treasurer_of(class_id));

-- ----- fund_transactions -----
-- Ghi: GVCN hoặc thủ quỹ của lớp.
create policy fund_tx_insert on fund_transactions
  for insert with check (is_gvcn_of(class_id) or is_treasurer_of(class_id));
create policy fund_tx_update on fund_transactions
  for update using (is_gvcn_of(class_id) or is_treasurer_of(class_id));
-- Đọc: GVCN + thủ quỹ thấy toàn bộ; HS chỉ thấy khoản của chính mình.
-- (Tổng quỹ công khai cho HS/PH lấy qua RPC tổng hợp, không lộ ai đóng ai chưa.)
create policy fund_tx_read on fund_transactions
  for select using (
        is_gvcn_of(class_id)
     or is_treasurer_of(class_id)
     or student_id = my_student_id()
  );

-- ----- announcements: chỉ GVCN soạn/sửa/gửi -----
-- Người nhận KHÔNG đọc bảng này trực tiếp; họ nhận qua `notifications` sau fan-out.
create policy ann_gvcn on announcements
  for all using (is_gvcn_of(class_id)) with check (is_gvcn_of(class_id));

create policy ann_targets_gvcn on announcement_targets
  for all using (
    exists (select 1 from announcements a
            where a.id = announcement_id and is_gvcn_of(a.class_id))
  )
  with check (
    exists (select 1 from announcements a
            where a.id = announcement_id and is_gvcn_of(a.class_id))
  );

-- ============================================================================
-- 6) AUDIT — quỹ là tiền, phải ghi log bất biến
--    (dùng lại cơ chế audit_log ở QLCN-03)
-- ============================================================================
create or replace function log_fund_tx()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into audit_log(class_id, actor_user_id, action, target_type, target_id, meta)
  values (
    new.class_id, auth.uid(),
    case when tg_op='INSERT' then 'fund.add' else 'fund.update' end,
    'fund_transaction', new.id,
    jsonb_build_object('kind',new.kind,'amount',new.amount,'week',new.week)
  );
  return new;
end $$;

create trigger trg_log_fund_tx
  after insert or update on fund_transactions
  for each row execute function log_fund_tx();

-- ============================================================================
-- 7) RPC tổng hợp quỹ theo tuần/tháng (cho màn tổng kết của Thủ quỹ/GVCN)
-- ============================================================================
create or replace function fund_summary(p_class_id uuid, p_from date, p_to date)
returns table (total_thu bigint, total_chi bigint, balance bigint)
language sql stable security definer
set search_path = public as $$
  select
    coalesce(sum(amount) filter (where kind='thu'),0)                         as total_thu,
    coalesce(sum(amount) filter (where kind='chi'),0)                         as total_chi,
    coalesce(sum(amount) filter (where kind='thu'),0)
      - coalesce(sum(amount) filter (where kind='chi'),0)                     as balance
  from fund_transactions
  where class_id = p_class_id
    and created_at::date between p_from and p_to
    and (is_gvcn_of(p_class_id) or is_treasurer_of(p_class_id));
$$;
