// Chuyển mọi loại lỗi thành chuỗi đọc được.
// Lỗi từ Supabase/PostgREST là object { message, details, hint, code } — KHÔNG phải Error,
// nên String(e) ra "[object Object]". Hàm này lấy đúng message + mã lỗi.
export function errText(e: unknown): string {
  if (e == null) return 'Đã xảy ra lỗi.'
  if (typeof e === 'string') return e
  if (e instanceof Error) return e.message
  if (typeof e === 'object') {
    const o = e as Record<string, unknown>
    const m = o.message ?? o.error_description ?? o.error ?? o.hint ?? o.details
    if (typeof m === 'string' && m) {
      const code = typeof o.code === 'string' && o.code ? ` (${o.code})` : ''
      return m + code
    }
    try { return JSON.stringify(o) } catch { return 'Lỗi không xác định.' }
  }
  return String(e)
}
