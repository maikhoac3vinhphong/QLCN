-- Tạo GVCN test để đăng nhập thử trong Ngày 1
-- (trước khi có Edge Function sinh tài khoản hàng loạt ở Ngày 2).
--
-- BƯỚC 1: Supabase Dashboard → Authentication → Users → Add user
--   Email:    gvcn@qlcn.local
--   Password: (tự đặt, nhớ để đăng nhập)
--   Bật "Auto Confirm User".
--
-- BƯỚC 2: copy User UID vừa tạo, thay vào <UID> rồi chạy đoạn dưới trong SQL Editor:

insert into profiles (id, role, full_name, username)
values ('<UID>', 'gvcn', 'Mai Khoa', 'maikhoa')
on conflict (id) do update
  set role = excluded.role,
      full_name = excluded.full_name,
      username = excluded.username;

-- Đăng nhập trong app: Tên đăng nhập = maikhoa · Mật khẩu = (đã đặt ở bước 1)
