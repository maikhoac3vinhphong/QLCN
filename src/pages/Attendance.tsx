import { useEffect, useMemo, useState } from 'react'
import type { Profile } from '../lib/auth'
import { getStudents, getAttendance, setAttendance, setAttendanceBulk, type AttStatus, type Student } from '../lib/db'
import { errText } from '../lib/err'

const STATUSES: { id: AttStatus; label: string; color: string }[] = [
  { id: 'present', label: 'Có mặt', color: 'var(--pos)' },
  { id: 'late', label: 'Muộn', color: 'var(--warn)' },
  { id: 'excused', label: 'Phép', color: 'var(--primary)' },
  { id: 'absent', label: 'Không phép', color: 'var(--neg)' }
]

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Attendance({ profile, classId }: { profile: Profile; classId: string }) {
  const [date, setDate] = useState(todayStr())
  const [students, setStudents] = useState<Student[]>([])
  const [marks, setMarks] = useState<Map<string, AttStatus>>(new Map())
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      setLoading(true); setErr(null)
      try {
        const [st, att] = await Promise.all([getStudents(classId), getAttendance(classId, date)])
        setStudents(st); setMarks(att)
      } catch (e) { setErr(errText(e)) } finally { setLoading(false) }
    })()
  }, [classId, date])

  const counts = useMemo(() => {
    const c: Record<string, number> = { present: 0, late: 0, excused: 0, absent: 0, none: 0 }
    for (const s of students) { const m = marks.get(s.id); c[m ?? 'none']++ }
    return c
  }, [students, marks])

  async function set(studentId: string, status: AttStatus) {
    const prev = marks.get(studentId)
    setMarks((m) => new Map(m).set(studentId, status))
    try {
      await setAttendance({ classId, studentId, date, status, recordedBy: profile.id })
    } catch (e) {
      setMarks((m) => { const n = new Map(m); if (prev) n.set(studentId, prev); else n.delete(studentId); return n })
      setErr('Lưu điểm danh lỗi: ' + (errText(e)))
    }
  }

  async function markAllPresent() {
    const targets = students.filter((s) => !marks.get(s.id))
    if (targets.length === 0) return
    const next = new Map(marks)
    targets.forEach((s) => next.set(s.id, 'present'))
    setMarks(next)
    try {
      await setAttendanceBulk(targets.map((s) => ({ classId, studentId: s.id, date, status: 'present' as AttStatus, recordedBy: profile.id })))
    } catch (e) { setErr('Lưu lỗi: ' + (errText(e))) }
  }

  if (loading) return <Center>Đang tải…</Center>
  if (students.length === 0) return <Center>Lớp chưa có học sinh.</Center>

  return (
    <div style={{ paddingBottom: 20 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <input className="input" type="date" value={date} max={todayStr()}
          onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 180 }} />
        <button className="btn" style={{ minHeight: 40 }} onClick={markAllPresent}>Tất cả có mặt</button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {STATUSES.map((s) => <Tag key={s.id} color={s.color}>{s.label}: {counts[s.id]}</Tag>)}
        {counts.none > 0 && <Tag color="var(--muted)">Chưa: {counts.none}</Tag>}
      </div>

      {err && <div style={errBox}>{err}</div>}

      <div style={{ display: 'grid', gap: 8 }}>
        {students.map((s) => {
          const cur = marks.get(s.id)
          return (
            <div key={s.id} className="card" style={{ padding: '12px 14px' }}>
              <div style={{ fontWeight: 500, marginBottom: 10 }}>{s.full_name}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {STATUSES.map((st) => {
                  const active = cur === st.id
                  return (
                    <button key={st.id} onClick={() => set(s.id, st.id)} style={{
                      flex: 1, minHeight: 38, borderRadius: 10, fontSize: 13, fontWeight: 500,
                      border: `1px solid ${active ? st.color : 'var(--line)'}`,
                      color: active ? '#fff' : st.color,
                      background: active ? st.color : `color-mix(in srgb, ${st.color} 8%, #fff)`
                    }}>{st.label}</button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  return <span style={{ fontSize: 13, fontWeight: 500, color, padding: '4px 10px', borderRadius: 999,
    background: `color-mix(in srgb, ${color} 13%, #fff)` }}>{children}</span>
}
function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', placeItems: 'center', minHeight: 200, color: 'var(--muted)', textAlign: 'center', padding: 20 }}>{children}</div>
}
const errBox: React.CSSProperties = { padding: '10px 12px', borderRadius: 10, background: 'color-mix(in srgb, var(--neg) 12%, #fff)', color: 'var(--neg)', fontSize: 14, marginBottom: 12 }
