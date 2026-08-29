import { supabase } from './supabase'

export type Role = 'gvcn' | 'totruong' | 'hs' | 'phhs'

export interface Profile {
  id: string
  role: Role
  full_name: string
  username: string | null
}

// Supabase Auth dùng email. Ta không có email của HS → dùng email alias nội bộ.
// Edge Function tạo tài khoản HS cũng phải tạo với email alias y hệt quy tắc này.
const DOMAIN = 'qlcn.local'
export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${DOMAIN}`
}

export async function signInWithUsername(username: string, password: string) {
  const email = usernameToEmail(username)
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signOut() {
  await supabase.auth.signOut()
}

// Lấy hồ sơ + vai của user đang đăng nhập. null nếu chưa đăng nhập.
export async function getMyProfile(): Promise<Profile | null> {
  const { data: sess } = await supabase.auth.getSession()
  const uid = sess.session?.user.id
  if (!uid) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, full_name, username')
    .eq('id', uid)
    .single()

  if (error) throw error
  return data as Profile
}
