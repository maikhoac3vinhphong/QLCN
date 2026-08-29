// supabase/functions/provision-students/index.ts
// Tạo tài khoản HS hàng loạt cho một lớp. CHẠY Ở SERVER (service_role) — không bao giờ ở client.
// Nhận: { class_id, students: [{ full_name, gender?, student_code? }] }
// Trả:  { ok, results: [{ full_name, username, password } | { full_name, skipped|error }] }
// Chỉ GVCN của lớp mới gọi được (kiểm bằng JWT người gọi).

import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// Supabase tự cấp các biến này cho Edge Function — không cần dán tay.
const URL = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const DOMAIN = 'qlcn.local' // phải khớp usernameToEmail ở client

function slug(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]/g, '')
}
function genPassword(len = 6): string {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789' // bỏ o0 l1 i dễ nhầm
  const arr = new Uint32Array(len); crypto.getRandomValues(arr)
  return Array.from(arr, (x) => abc[x % abc.length]).join('')
}

interface InStudent { full_name: string; gender?: string; student_code?: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(URL, ANON, { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Chưa đăng nhập.' }, 401)

    const { class_id, students } = await req.json() as { class_id: string; students: InStudent[] }
    if (!class_id || !Array.isArray(students) || students.length === 0)
      return json({ error: 'Thiếu class_id hoặc danh sách rỗng.' }, 400)

    const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })

    // Người gọi phải là GVCN của lớp.
    const { data: cls } = await admin.from('classes').select('id, gvcn_id').eq('id', class_id).single()
    if (!cls || cls.gvcn_id !== user.id) return json({ error: 'Bạn không phải GVCN của lớp này.' }, 403)

    // Mã HS đã có trong lớp → bỏ qua (cho phép chạy lại mà không tạo trùng).
    const { data: existing } = await admin.from('students')
      .select('student_code').eq('class_id', class_id)
    const existingCodes = new Set((existing ?? []).map((r) => (r.student_code ?? '').toLowerCase()))

    const results: Array<Record<string, unknown>> = []
    let idx = 0
    for (const s of students) {
      idx++
      const name = (s.full_name ?? '').trim()
      if (!name) continue
      const code = (s.student_code ?? '').trim()
      if (code && existingCodes.has(code.toLowerCase())) {
        results.push({ full_name: name, skipped: 'đã có mã HS này' }); continue
      }

      // username: gốc từ mã HS; nếu trống thì từ tên + số thứ tự. Đảm bảo duy nhất.
      let base = code ? slug(code) : slug(name) + idx
      let username = base, n = 1
      while (true) {
        const { data: taken } = await admin.from('profiles').select('id').eq('username', username).maybeSingle()
        if (!taken) break
        username = base + n; n++
      }
      const email = `${username}@${DOMAIN}`
      const password = genPassword()

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name: name, role: 'hs' }
      })
      if (cErr || !created?.user) { results.push({ full_name: name, error: cErr?.message ?? 'tạo user lỗi' }); continue }
      const uid = created.user.id

      const { error: pErr } = await admin.from('profiles')
        .insert({ id: uid, role: 'hs', full_name: name, username })
      if (pErr) { results.push({ full_name: name, error: 'profile: ' + pErr.message }); continue }

      const gender = s.gender === 'Nam' || s.gender === 'Nữ' ? s.gender : null
      const { error: sErr } = await admin.from('students')
        .insert({ class_id, full_name: name, gender, student_code: code || null, user_id: uid })
      if (sErr) { results.push({ full_name: name, error: 'student: ' + sErr.message }); continue }

      existingCodes.add(code.toLowerCase())
      results.push({ full_name: name, username, password })
    }

    return json({ ok: true, results })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
