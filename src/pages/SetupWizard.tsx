import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/auth'
import { parseStudents, type ParsedStudent } from '../lib/parseStudents'
import { provisionStudents, type ProvisionResult } from '../lib/api'

type Step = 1 | 2 | 3 | 4

interface StudentRow {
  id: string
  full_name: string
  student_code: string | null
  group_id: string | null
}
interface Group { id: string; name: string; position: number }

const CRITERIA_DEFAULT = `Phát biểu xây dựng bài | 2
Giúp đỡ bạn | 2
Trực nhật tốt | 1
Điểm tốt (9-10) | 3
Đi học muộn | -1
Quên đồng phục | -1
Không thuộc bài | -2
Mất trật tự | -2
Vô lễ / đánh nhau | -5`

export default function SetupWizard({ profile, onDone }: { profile: Profile; onDone: () => void }) {
  const [step, setStep] = useState<Step>(1)

  // B1
  const [className, setClassName] = useState('')
  const [schoolYear, setSchoolYear] = useState(defaultSchoolYear())
  const [classId, setClassId] = useState<string | null>(null)
  const [groups, setGroups] = useState<Group[]>([])

  // B2
  const [raw, setRaw] = useState('')
  const parsed = useMemo<ParsedStudent[]>(() => parseStudents(raw), [raw])
  const [creds, setCreds] = useState<ProvisionResult[] | null>(null)

  // B3
  const [students, setStudents] = useState<StudentRow[]>([])
  const [leaders, setLeaders] = useState<Record<string, string>>({}) // group_id -> student_id
  const [treasurer, setTreasurer] = useState<string>('')

  // B4
  const [critText, setCritText] = useState(CRITERIA_DEFAULT)

  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // ---------- B1: tạo lớp + 4 tổ + privacy mặc định ----------
  async function createClass() {
    if (!className.trim()) { setErr('Nhập tên lớp.'); return }
    setBusy(true); setErr(null)
    try {
      const { data: cls, error } = await supabase.from('classes')
        .insert({ name: className.trim(), school_year: schoolYear.trim(), gvcn_id: profile.id })
        .select('id').single()
      if (error) throw error
      const cid = cls.id as string

      await supabase.from('privacy_settings').insert({ class_id: cid })
      const { data: gs, error: gErr } = await supabase.from('groups')
        .insert([0, 1, 2, 3].map((p) => ({ class_id: cid, name: `Tổ ${p + 1}`, position: p })))
        .select('id, name, position')
      if (gErr) throw gErr

      setClassId(cid)
      setGroups((gs as Group[]).sort((a, b) => a.position - b.position))
      setStep(2)
    } catch (e) { setErr(msg(e)) } finally { setBusy(false) }
  }

  // ---------- B2: sinh tài khoản HS ----------
  async function provision() {
    if (!classId || parsed.length === 0) { setErr('Chưa có danh sách HS.'); return }
    setBusy(true); setErr(null)
    try {
      const { results } = await provisionStudents(classId, parsed)
      setCreds(results)
      // nạp lại danh sách HS thật từ DB (đã có id) để chia tổ ở B3
      const { data: sts } = await supabase.from('students')
        .select('id, full_name, student_code, group_id').eq('class_id', classId)
        .order('full_name')
      const rows = (sts ?? []) as StudentRow[]
      // chia tổ mặc định vòng tròn
      rows.forEach((r, i) => { if (!r.group_id) r.group_id = groups[i % groups.length]?.id ?? null })
      setStudents(rows)
    } catch (e) { setErr(msg(e)) } finally { setBusy(false) }
  }

  function downloadCreds() {
    if (!creds) return
    const rows = creds.filter((c) => c.username)
      .map((c) => `${csv(c.full_name)},${c.username},${c.password}`)
    const blob = new Blob([`Họ tên,Tên đăng nhập,Mật khẩu\n${rows.join('\n')}`], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `taikhoan-${className || 'lop'}.csv`
    a.click()
  }

  // ---------- B3: lưu tổ + tổ trưởng + thủ quỹ ----------
  async function saveGroups() {
    setBusy(true); setErr(null)
    try {
      // cập nhật group cho từng HS
      for (const s of students) {
        await supabase.from('students').update({ group_id: s.group_id }).eq('id', s.id)
      }
      // tổ trưởng: đặt role totruong + gán leader_student_id
      for (const g of groups) {
        const sid = leaders[g.id]
        if (!sid) continue
        await supabase.from('groups').update({ leader_student_id: sid }).eq('id', g.id)
        const uid = await userIdOfStudent(sid)
        if (uid) await supabase.from('profiles').update({ role: 'totruong' }).eq('id', uid)
      }
      // thủ quỹ (HS gán thêm quyền)
      if (treasurer) await supabase.from('students').update({ is_treasurer: true }).eq('id', treasurer)
      setStep(4)
    } catch (e) { setErr(msg(e)) } finally { setBusy(false) }
  }

  // ---------- B4: lưu tiêu chí ----------
  async function saveCriteria() {
    if (!classId) return
    const rows = critText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
      const [name, pts] = l.split('|').map((x) => x.trim())
      const points = parseInt(pts, 10)
      return { name, points }
    }).filter((r) => r.name && !Number.isNaN(r.points))
    if (rows.length === 0) { setErr('Chưa có tiêu chí hợp lệ (mỗi dòng: tên | điểm).'); return }
    setBusy(true); setErr(null)
    try {
      await supabase.from('criteria').insert(rows.map((r) => ({
        class_id: classId, name: r.name, points: r.points,
        requires_approval: r.points <= -5 // trừ nặng phải duyệt
      })))
      onDone()
    } catch (e) { setErr(msg(e)) } finally { setBusy(false) }
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: 20 }}>
      <Stepper step={step} />
      {err && <div style={errBox}>{err}</div>}

      {step === 1 && (
        <div className="card" style={pad}>
          <h2 style={h2}>Thông tin lớp</h2>
          <label className="label">Tên lớp</label>
          <input className="input" placeholder="VD: 9A2" value={className} onChange={(e) => setClassName(e.target.value)} />
          <div style={{ height: 12 }} />
          <label className="label">Năm học</label>
          <input className="input" value={schoolYear} onChange={(e) => setSchoolYear(e.target.value)} />
          <p style={hint}>Tự tạo sẵn 4 tổ (mỗi tổ = 1 dãy bàn). Có thể đổi sau.</p>
          <button className="btn btn-primary" style={wide} disabled={busy} onClick={createClass}>
            {busy ? 'Đang tạo…' : 'Tiếp tục'}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="card" style={pad}>
          <h2 style={h2}>Danh sách học sinh</h2>
          {!creds ? (
            <>
              <p style={hint}>Dán từ Excel: mỗi dòng một HS, 3 cột <strong>Họ tên · Giới tính · Mã HS</strong> (cách nhau bằng Tab).</p>
              <textarea className="input" style={{ minHeight: 160, padding: 12, resize: 'vertical' }}
                placeholder={'Nguyễn Văn An\tNam\t9A201\nTrần Thị Bích\tNữ\t9A202'}
                value={raw} onChange={(e) => setRaw(e.target.value)} />
              {parsed.length > 0 && (
                <div style={{ marginTop: 12, fontSize: 14, color: 'var(--muted)' }}>
                  Nhận diện <strong style={{ color: 'var(--ink)' }}>{parsed.length}</strong> học sinh.
                </div>
              )}
              <button className="btn btn-primary" style={wide} disabled={busy || parsed.length === 0} onClick={provision}>
                {busy ? 'Đang tạo tài khoản…' : `Tạo tài khoản (${parsed.length})`}
              </button>
            </>
          ) : (
            <>
              <div style={{ padding: 12, borderRadius: 10, background: 'var(--primary-050)', marginBottom: 12 }}>
                Đã tạo xong. <strong>Tải danh sách và phát cho HS ngay</strong> — mật khẩu chỉ hiện lần này.
              </div>
              <button className="btn" onClick={downloadCreds}>⬇ Tải danh sách tài khoản (.csv)</button>
              <div style={{ maxHeight: 260, overflow: 'auto', marginTop: 12, border: '1px solid var(--line)', borderRadius: 10 }}>
                <table style={table}>
                  <thead><tr><th style={th}>Họ tên</th><th style={th}>Tên ĐN</th><th style={th}>Mật khẩu</th></tr></thead>
                  <tbody>
                    {creds.map((c, i) => (
                      <tr key={i}>
                        <td style={td}>{c.full_name}</td>
                        <td style={td}>{c.username ?? '—'}</td>
                        <td style={td}>{c.password ?? <span style={{ color: 'var(--muted)' }}>{c.skipped ?? c.error}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="btn btn-primary" style={wide} onClick={() => setStep(3)}>Tiếp tục: chia tổ</button>
            </>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="card" style={pad}>
          <h2 style={h2}>Chia tổ &amp; chọn vai</h2>
          <p style={hint}>Mỗi HS thuộc một tổ. Chọn tổ trưởng cho từng tổ và một thủ quỹ cho lớp.</p>
          <div style={{ maxHeight: 300, overflow: 'auto', border: '1px solid var(--line)', borderRadius: 10 }}>
            <table style={table}>
              <thead><tr><th style={th}>Họ tên</th><th style={th}>Tổ</th></tr></thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td style={td}>{s.full_name}</td>
                    <td style={td}>
                      <select className="input" style={sel} value={s.group_id ?? ''}
                        onChange={(e) => setStudents((prev) => prev.map((x) => x.id === s.id ? { ...x, group_id: e.target.value } : x))}>
                        {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 16 }}>
            {groups.map((g) => {
              const members = students.filter((s) => s.group_id === g.id)
              return (
                <div key={g.id} style={{ marginBottom: 10 }}>
                  <label className="label">Tổ trưởng {g.name}</label>
                  <select className="input" value={leaders[g.id] ?? ''} onChange={(e) => setLeaders((p) => ({ ...p, [g.id]: e.target.value }))}>
                    <option value="">— chọn —</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                  </select>
                </div>
              )
            })}
            <label className="label">Thủ quỹ lớp</label>
            <select className="input" value={treasurer} onChange={(e) => setTreasurer(e.target.value)}>
              <option value="">— chọn —</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </div>

          <button className="btn btn-primary" style={wide} disabled={busy} onClick={saveGroups}>
            {busy ? 'Đang lưu…' : 'Tiếp tục: tiêu chí'}
          </button>
        </div>
      )}

      {step === 4 && (
        <div className="card" style={pad}>
          <h2 style={h2}>Tiêu chí thi đua</h2>
          <p style={hint}>Mỗi dòng: <strong>tên | điểm</strong>. Điểm dương = cộng, âm = trừ. Trừ từ 5 điểm trở lên sẽ cần GVCN duyệt.</p>
          <textarea className="input" style={{ minHeight: 220, padding: 12, resize: 'vertical', fontFamily: 'inherit' }}
            value={critText} onChange={(e) => setCritText(e.target.value)} />
          <button className="btn btn-primary" style={wide} disabled={busy} onClick={saveCriteria}>
            {busy ? 'Đang lưu…' : 'Hoàn tất thiết lập'}
          </button>
        </div>
      )}
    </div>
  )

  async function userIdOfStudent(sid: string): Promise<string | null> {
    const { data } = await supabase.from('students').select('user_id').eq('id', sid).single()
    return (data?.user_id as string) ?? null
  }
}

function Stepper({ step }: { step: Step }) {
  const items = ['Lớp', 'Học sinh', 'Tổ & vai', 'Tiêu chí']
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      {items.map((t, i) => {
        const n = (i + 1) as Step
        const active = n === step, done = n < step
        return (
          <div key={t} style={{
            flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 500,
            color: active ? '#fff' : done ? 'var(--primary)' : 'var(--muted)',
            background: active ? 'var(--primary)' : done ? 'var(--primary-100)' : 'var(--surface)',
            border: `1px solid ${active || done ? 'var(--primary)' : 'var(--line)'}`,
            borderRadius: 999, padding: '7px 4px'
          }}>{i + 1}. {t}</div>
        )
      })}
    </div>
  )
}

function defaultSchoolYear() {
  const y = new Date().getFullYear(), m = new Date().getMonth()
  const start = m >= 5 ? y : y - 1 // năm học bắt đầu ~ tháng 8
  return `${start}-${start + 1}`
}
const msg = (e: unknown) => e instanceof Error ? e.message : String(e)
const csv = (s: string) => /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s

const pad: React.CSSProperties = { padding: 22 }
const wide: React.CSSProperties = { width: '100%', marginTop: 18 }
const h2: React.CSSProperties = { margin: '0 0 12px', fontSize: 20 }
const hint: React.CSSProperties = { color: 'var(--muted)', fontSize: 14, margin: '4px 0 12px', lineHeight: 1.55 }
const errBox: React.CSSProperties = { padding: '10px 12px', borderRadius: 10, marginBottom: 12, background: 'color-mix(in srgb, var(--neg) 12%, #fff)', color: 'var(--neg)', fontSize: 14 }
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 14 }
const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', position: 'sticky', top: 0, background: 'var(--surface)', borderBottom: '1px solid var(--line)', fontWeight: 600 }
const td: React.CSSProperties = { padding: '7px 10px', borderBottom: '1px solid var(--line)' }
const sel: React.CSSProperties = { minHeight: 36, padding: '0 8px', fontSize: 14 }
