-- ============================================================================
-- QLCN — Migration 0001_init  (schema gốc theo QLCN-03 + helper + RLS + trigger)
-- Chạy TRƯỚC 0002_extend.sql. Postgres/Supabase. Mọi bảng bật RLS.
-- Nhãn UI tiếng Việt; tên bảng/cột tiếng Anh.
-- ============================================================================

-- ============================== 1) BẢNG =====================================
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null check (role in ('gvcn','totruong','hs','phhs')),
  full_name text not null,
  username text unique,
  created_at timestamptz default now()
);

create table classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  school_year text not null,
  gvcn_id uuid not null references profiles(id),
  created_at timestamptz default now()
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  name text not null,
  color text,
  position int not null,
  leader_student_id uuid
);

create table students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  group_id uuid references groups(id),
  full_name text not null,
  gender text check (gender in ('Nam','Nữ')),
  student_code text,
  seat_index int,
  user_id uuid references profiles(id),
  created_at timestamptz default now()
);

create table parent_links (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  parent_user_id uuid references profiles(id),
  token text not null unique,
  claimed_at timestamptz
);

create table criteria (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  name text not null,
  points int not null,
  kind text generated always as (case when points >= 0 then 'cong' else 'tru' end) stored,
  category text,
  requires_approval boolean default false,
  active boolean default true
);

create table records (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  criterion_id uuid not null references criteria(id),
  points int not null,
  recorded_by uuid not null references profiles(id),
  status text not null default 'applied' check (status in ('applied','pending','rejected')),
  note text,
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  created_at timestamptz default now()
);

create table attendance (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  date date not null,
  status text not null check (status in ('present','late','excused','absent')),
  recorded_by uuid not null references profiles(id),
  created_at timestamptz default now(),
  unique (student_id, date)
);

create table goals (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  week text not null,
  text text not null,
  progress int default 0 check (progress between 0 and 100)
);

create table events (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  date date not null,
  title text not null,
  detail text,
  created_by uuid references profiles(id)
);

create table event_confirmations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  parent_link_id uuid not null references parent_links(id),
  status text default 'yes',
  created_at timestamptz default now(),
  unique (event_id, parent_link_id)
);

create table nominations (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  nominee_student_id uuid not null references students(id),
  nominator_student_id uuid references students(id),
  reason text,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  decided_by uuid references profiles(id)
);

create table weekly_reports (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  student_id uuid references students(id),
  week text not null,
  draft_text text,
  status text default 'draft' check (status in ('draft','sent')),
  sent_by uuid references profiles(id),
  sent_at timestamptz
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text,
  title text not null,
  body text,
  read boolean default false,
  created_at timestamptz default now()
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references classes(id) on delete cascade,
  actor_user_id uuid references profiles(id),
  action text not null,
  target_type text,
  target_id uuid,
  meta jsonb,
  created_at timestamptz default now()
);

create table privacy_settings (
  class_id uuid primary key references classes(id) on delete cascade,
  public_leaderboard boolean default true,
  anonymize_public boolean default false,
  parent_see_detail boolean default true,
  parent_see_rank boolean default false
);

-- ====================== 2) HÀM HELPER (security definer) =====================
-- security definer để bỏ qua RLS bên trong hàm → tránh đệ quy policy.

create or replace function my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function is_gvcn_of(p_class_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from classes c where c.id = p_class_id and c.gvcn_id = auth.uid());
$$;

create or replace function my_student_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from students where user_id = auth.uid() limit 1;
$$;

create or replace function my_children_student_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select pl.student_id from parent_links pl where pl.parent_user_id = auth.uid();
$$;

create or replace function my_class_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select c.id from classes c where c.gvcn_id = auth.uid()
  union
  select s.class_id from students s where s.user_id = auth.uid()
  union
  select s.class_id from students s
    join parent_links pl on pl.student_id = s.id
   where pl.parent_user_id = auth.uid();
$$;

create or replace function is_in_class(p_class_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_class_id in (select my_class_ids());
$$;

-- ============================ 3) TRIGGER =====================================
-- 3a. Ép status='pending' khi tiêu chí requires_approval (trừ nặng qua duyệt).
create or replace function enforce_record_approval()
returns trigger language plpgsql security definer set search_path = public as $$
declare req boolean;
begin
  select requires_approval into req from criteria where id = new.criterion_id;
  if coalesce(req,false) then new.status := 'pending'; end if;
  return new;
end $$;
create trigger trg_enforce_record_approval
  before insert on records
  for each row execute function enforce_record_approval();

-- 3b. Ghi audit_log cho records/attendance/nominations/weekly_reports.
create or replace function log_audit_generic()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log(class_id, actor_user_id, action, target_type, target_id, meta)
  values (
    new.class_id, auth.uid(),
    tg_table_name || '.' || lower(tg_op),
    tg_table_name, new.id,
    jsonb_build_object('status', to_jsonb(new)->'status')
  );
  return new;
end $$;
create trigger trg_audit_records      after insert or update on records
  for each row execute function log_audit_generic();
create trigger trg_audit_attendance   after insert or update on attendance
  for each row execute function log_audit_generic();
create trigger trg_audit_nominations  after insert or update on nominations
  for each row execute function log_audit_generic();
create trigger trg_audit_weekly       after insert or update on weekly_reports
  for each row execute function log_audit_generic();

-- ============================ 4) BẬT RLS =====================================
alter table profiles            enable row level security;
alter table classes             enable row level security;
alter table groups              enable row level security;
alter table students            enable row level security;
alter table parent_links        enable row level security;
alter table criteria            enable row level security;
alter table records             enable row level security;
alter table attendance          enable row level security;
alter table goals               enable row level security;
alter table events              enable row level security;
alter table event_confirmations enable row level security;
alter table nominations         enable row level security;
alter table weekly_reports      enable row level security;
alter table notifications       enable row level security;
alter table audit_log           enable row level security;
alter table privacy_settings    enable row level security;

-- ============================ 5) POLICY ======================================

-- profiles: mỗi user đọc hồ sơ của chính mình (đủ cho đăng nhập + lấy vai).
create policy profiles_self_read on profiles
  for select using (id = auth.uid());

-- classes
create policy classes_gvcn on classes
  for all using (gvcn_id = auth.uid()) with check (gvcn_id = auth.uid());
create policy classes_member_read on classes
  for select using (is_in_class(id));

-- groups
create policy groups_gvcn on groups
  for all using (is_gvcn_of(class_id)) with check (is_gvcn_of(class_id));
create policy groups_member_read on groups
  for select using (is_in_class(class_id));

-- criteria
create policy criteria_gvcn on criteria
  for all using (is_gvcn_of(class_id)) with check (is_gvcn_of(class_id));
create policy criteria_member_read on criteria
  for select using (is_in_class(class_id));

-- privacy_settings
create policy privacy_gvcn on privacy_settings
  for all using (is_gvcn_of(class_id)) with check (is_gvcn_of(class_id));
create policy privacy_member_read on privacy_settings
  for select using (is_in_class(class_id));

-- students
create policy students_gvcn on students
  for all using (is_gvcn_of(class_id)) with check (is_gvcn_of(class_id));
create policy students_read on students
  for select using (
        (my_role() in ('hs','totruong') and is_in_class(class_id))
     or id in (select my_children_student_ids())
  );

-- records
create policy records_insert on records
  for insert with check (
        is_gvcn_of(class_id)
     or (my_role() = 'totruong' and is_in_class(class_id))
  );
create policy records_update on records
  for update using (is_gvcn_of(class_id));
create policy records_select on records
  for select using (
        student_id = my_student_id()
     or (student_id in (select my_children_student_ids())
         and exists (select 1 from privacy_settings p
                     where p.class_id = records.class_id and p.parent_see_detail))
  );
-- (Bảng xếp hạng công khai lấy qua RPC tổng hợp sẽ thêm ở Ngày 3, tôn trọng privacy.)

-- attendance
create policy attendance_write on attendance
  for insert with check (
        is_gvcn_of(class_id)
     or (my_role() = 'totruong' and is_in_class(class_id))
  );
create policy attendance_update on attendance
  for update using (
        is_gvcn_of(class_id)
     or (my_role() = 'totruong' and is_in_class(class_id))
  );
create policy attendance_select on attendance
  for select using (
        is_gvcn_of(class_id)
     or student_id = my_student_id()
     or student_id in (select my_children_student_ids())
  );

-- goals (theo group → class)
create policy goals_gvcn on goals
  for all using (exists (select 1 from groups g where g.id = goals.group_id and is_gvcn_of(g.class_id)))
  with check (exists (select 1 from groups g where g.id = goals.group_id and is_gvcn_of(g.class_id)));
create policy goals_read on goals
  for select using (exists (select 1 from groups g where g.id = goals.group_id and is_in_class(g.class_id)));

-- events
create policy events_gvcn on events
  for all using (is_gvcn_of(class_id)) with check (is_gvcn_of(class_id));
create policy events_read on events
  for select using (is_in_class(class_id));

-- event_confirmations (PH xác nhận qua Edge Function sau; ở đây GVCN đọc)
create policy event_conf_gvcn_read on event_confirmations
  for select using (exists (select 1 from events e where e.id = event_id and is_gvcn_of(e.class_id)));

-- nominations
create policy nominations_insert on nominations
  for insert with check (my_role() = 'hs' and is_in_class(class_id));
create policy nominations_update on nominations
  for update using (is_gvcn_of(class_id));
create policy nominations_select on nominations
  for select using (is_in_class(class_id));

-- weekly_reports
create policy wr_gvcn on weekly_reports
  for all using (is_gvcn_of(class_id)) with check (is_gvcn_of(class_id));
create policy wr_parent_read on weekly_reports
  for select using (
    status = 'sent' and (
         student_id in (select my_children_student_ids())
      or (student_id is null and is_in_class(class_id))
    )
  );

-- notifications: mỗi user chỉ đọc/đánh dấu đã đọc của mình. Insert do server.
create policy notif_self_read on notifications
  for select using (user_id = auth.uid());
create policy notif_self_update on notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- audit_log: chỉ GVCN đọc. Không mở insert/update/delete cho client
-- (trigger security definer tự ghi, bỏ qua RLS).
create policy audit_gvcn_read on audit_log
  for select using (is_gvcn_of(class_id));

-- parent_links: KHÔNG policy client → chỉ Edge Function (service role) thao tác.
