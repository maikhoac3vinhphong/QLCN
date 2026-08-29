import { useEffect, useMemo, useState } from 'react'
import { errText } from '../lib/err'
import { getGroupsFull, getStudentsFull, saveGroupsRoles, type GroupFull, type StudentFull } from '../lib/db'

export default function GroupsRoles({ classId }: { classId: string }) {
  const [groups, setGroups] = useState<GroupFull[]>([])
  const [students, setStudents] = useState<StudentFull[]>([])
  const [groupOf, setGroupOf] = useState<Record<string, string | null>>({})
  const [leaderOf, setLeaderOf] = useState<Record<string, string | null>>({})
  const [treasurerId, setTreasurerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  async function load() {
    setLoading(true); setErr(null); setOk(null)
    try {
      const [gs, st] = await Promise.all([getGroupsFull(classId), getStudentsFull(classId)])
      setGroups(gs); setStudents(st)
      setGroupOf(Object.fromEntries(st.map((s) => [s.id, s.group_id])))
      setLeaderOf(Object.fromEntries(gs.map((g) => [g.id, g.leader_student_id])))
      setTreasurerId(st.find((s) => s.is_treasurer)?.id ?? null)
    } catch (e) { setErr(errText(e)) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [classId])

  const unassigned = useMemo(() => students.filter((s) => !groupOf[s.id]).length, [students, groupOf])

  function autoSplit() {
    // chia đều theo thứ tự tên vào các tổ hiện có
    if (groups.length === 0) return
    const next: Record<string, string | null> = {}
    students.forEach((s, i) => { next[s.id] = groups[i % groups.length].id })
    setGroupOf(next)
  }

  async function save() {
    setBusy(true); setErr(null); setOk(null)
    try {
      await saveGroupsRoles(classId, { groupOf, leaderOf, treasurerId, students, groups })
      setOk('Đã lưu chia tổ & vai.')
      await load()
    } catch (e) { setErr(errText(e)) } finally { setBusy(false) }
  }

  if (loading) return <Center>Đang tải…</Center>
  if (groups.length === 0) return <Center>Lớp chưa có tổ. Vào Thiết lập lớp trước.</Center>
  if (students.length === 0) return <Center>Lớp chưa có học sinh.</Center>

  return (
    <div style={{ display: 'grid', gap: 14, paddingBottom: 20 }}>
      {err && <div style={box('var(--neg)')}>{err}</div>}
      {ok && <div style={box('var(--pos)')}>{ok}</div>}

      <section className="card" style={pad}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={h3}>Gán tổ</h3>
          <button className="btn" style={{ minHeight: 36 }} onClick={autoSplit}>Chia đều</button>
        </div>
        {unassigned > 0 && <p style={{ ...hint, color: 'var(--warn)' }}>Còn {unassigned} HS chưa có tổ.</p>}
        <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid var(--line)', borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td style={td}>{s.full_name}</td>
                  <td style={{ ...td, width: 130 }}>
                    <select className="input" style={sel} value={groupOf[s.id] ?? ''}
                      onChange={(e) => setGroupOf((p) => ({ ...p, [s.id]: e.target.value || null }))}>
                      <option value="">— chưa —</option>
                      {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" style={pad}>
        <h3 style={h3}>Tổ trưởng & thủ quỹ</h3>
        <p style={hint}>Tổ trưởng được quyền ghi nhận & điểm danh. Thủ quỹ (sắp dùng cho thu chi quỹ) là một HS bất kỳ.</p>
        {groups.map((g) => {
          const members = students.filter((s) => groupOf[s.id] === g.id)
          return (
            <div key={g.id} style={{ marginBottom: 10 }}>
              <label className="label">Tổ trưởng {g.name}</label>
              <select className="input" value={leaderOf[g.id] ?? ''} onChange={(e) => setLeaderOf((p) => ({ ...p, [g.id]: e.target.value || null }))}>
                <option value="">— chưa chọn —</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </div>
          )
        })}
        <label className="label">Thủ quỹ lớp</label>
        <select className="input" value={treasurerId ?? ''} onChange={(e) => setTreasurerId(e.target.value || null)}>
          <option value="">— chưa chọn —</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
      </section>

      <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? 'Đang lưu…' : 'Lưu chia tổ & vai'}</button>
    </div>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', placeItems: 'center', minHeight: 200, color: 'var(--muted)', textAlign: 'center', padding: 20 }}>{children}</div>
}
const pad: React.CSSProperties = { padding: 18 }
const h3: React.CSSProperties = { margin: 0, fontSize: 17 }
const hint: React.CSSProperties = { color: 'var(--muted)', fontSize: 14, margin: '0 0 10px', lineHeight: 1.5 }
const td: React.CSSProperties = { padding: '7px 10px', borderBottom: '1px solid var(--line)' }
const sel: React.CSSProperties = { minHeight: 36, padding: '0 8px', fontSize: 14 }
const box = (c: string): React.CSSProperties => ({ padding: '10px 12px', borderRadius: 10, background: `color-mix(in srgb, ${c} 12%, #fff)`, color: c, fontSize: 14 })
