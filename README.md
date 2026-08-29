# QLCN — Quản Lý Chủ Nhiệm

Webapp quản lý nề nếp & thi đua lớp, kết nối phụ huynh. React + Vite + TS · Supabase · PWA.

## 1. Chạy ở máy

```bash
npm install
cp .env.example .env      # rồi điền VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY
npm run dev               # mở http://localhost:5173
```

## 2. Cơ sở dữ liệu (Supabase, làm 1 lần)

1. Tạo project Supabase (gói free).
2. SQL Editor → chạy `supabase/migrations/0001_init.sql` (schema gốc từ QLCN-03), rồi `0002_extend.sql`.
3. Lấy `Project URL` và `anon public key` ở **Project Settings → API** để điền vào `.env`.

### Tạo GVCN test để đăng nhập thử
Làm theo `supabase/seed_test_gvcn.sql`. Đăng nhập: `maikhoa` + mật khẩu đã đặt.

## 3. Deploy — GitHub + Vercel

```bash
git init && git add . && git commit -m "QLCN scaffold"
git branch -M main
git remote add origin https://github.com/<tài-khoản>/qlcn.git
git push -u origin main
```

Trên **vercel.com**:
1. **Add New → Project** → chọn repo `qlcn`. Framework tự nhận **Vite**.
2. **Environment Variables** → thêm 2 biến (cho cả Production & Preview):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. **Deploy**. Từ nay mỗi lần `git push` là Vercel tự build lại.

> `anon key` để lộ ở client là **bình thường** với Supabase — an toàn nằm ở RLS trong DB.
> Không bao giờ đưa `service_role key` vào code client.

## Cấu trúc

```
qlcn/
  index.html
  vite.config.ts            # cấu hình + PWA
  src/
    main.tsx
    App.tsx                 # quản lý phiên → Login / RoleHome
    lib/
      supabase.ts           # client (persist session)
      auth.ts               # đăng nhập bằng username, lấy role
      NetBadge.tsx          # chỉ báo Trực tuyến/Offline
    pages/
      Login.tsx
      RoleHome.tsx          # stub theo vai (thay dần từ Ngày 2)
    styles/tokens.css       # Design System QLCN-04
  supabase/
    migrations/0001_init.sql
    migrations/0002_extend.sql
    seed_test_gvcn.sql
  public/                   # favicon, icon PWA
```
