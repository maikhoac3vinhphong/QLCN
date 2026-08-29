import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  // Lỗi cấu hình rõ ràng thay vì màn hình trắng khó hiểu.
  throw new Error(
    'Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY. Kiểm tra file .env (local) hoặc Environment Variables trên Vercel.'
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,     // phiên lưu trên máy → lần sau mở là vào (QLCN-01)
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
})
