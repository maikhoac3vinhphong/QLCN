export interface ParsedStudent {
  full_name: string
  gender?: 'Nam' | 'Nữ'
  student_code?: string
}

// Tách văn bản dán từ Excel: mỗi dòng 1 HS, cột phân tách bằng Tab (hoặc , ; |).
// Cột: Họ tên · Giới tính · Mã HS. Tự bỏ dòng tiêu đề.
export function parseStudents(text: string): ParsedStudent[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const out: ParsedStudent[] = []
  for (const line of lines) {
    const cols = line.split(/\t|,|;|\|/).map((c) => c.trim())
    const name = cols[0]
    if (!name) continue
    if (/^(họ.*tên|tên|full ?name|stt|no\.?)$/i.test(name)) continue // dòng tiêu đề
    const g = (cols[1] ?? '').toLowerCase()
    let gender: 'Nam' | 'Nữ' | undefined
    if (g.startsWith('nam') || g === 'm' || g === 'male') gender = 'Nam'
    else if (g.startsWith('nữ') || g.startsWith('nu') || g === 'f' || g === 'female') gender = 'Nữ'
    out.push({ full_name: name, gender, student_code: cols[2] || undefined })
  }
  return out
}
