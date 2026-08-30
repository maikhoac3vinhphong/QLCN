import { useEffect, useState } from 'react'
import { errText } from '../lib/err'
import { getStudentsManage, updateStudent, setStudentActive, resetStudentPassword, type ManageStudent } from '../lib/db'

export default function StudentManage({ classId }: { classId: string }) {
  const [rows, setRows] = useState<ManageStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [showLeft, setShowLeft] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editGender, setEditGender] = useState<string>('')
  const [pw, setPw] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try { setRows(await getStudentsManage(classId)) } catch (e) { setErr(errText(e)) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [classId])

  const active = rows.filter((r) => r.active)
  const left = rows.filter((r) => !r.active)

  function startEdit(s: ManageStudent) { setEditId(s.id); setEditName(s.full_name); setEditGender(s.gender ?? '') }
  async function saveEdit(id: string) {
    setBusy(id); setErr(null)
    try {
      await updateStudent(id, { full_name: editName.trim(), gender: editGender || null })
      setEditId(null); await load()
    } catch (e) { setErr(errText(e)) } finally { setBusy(null) }
  }
  async function reset(s: ManageStudent) {
    setBusy(s.id); setErr(null)
    try { const p = await resetStudentPassword(s.id); setPw((m) => ({ ...m, [s.id]: p })) }
    catch (e) { setErr(errText(e)) } finally { setBusy(null) }
  }
  async function toggleActive(s: ManageStudent, active: boolean) {
    setBusy(s.id); setErr(null)
    try { await setStudentActive(s.id, active); await load() } catch (e) { setErr(errText(e)) } finally { setBusy(null) }
  }

  if (loading) return <Center>Đang tải…</Center>

  const row = (s: ManageStudent) => (
    <div key={s.id} className="card" style={{ padding: '12px 14px' }}>
      {editId === s.id ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="input" style={{ maxWidth: 120 }} value={editGender} onChange={(e) => setEditGender(e.target.value)}>
              <option value="">Giới tính</option><option value="Nam">Nam</option><option value="Nữ">Nữ</option>
            </select>
            <button className="btn btn-primary" style={{ minHeight: 40 }} disabled={busy === s.id} onClick={() => saveEdit(s.id)}>Lưu</button>
            <button className="btn" style={{ minHeight: 40 }} onClick={() => setEditId(null)}>Hủy</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 600 }}>{s.full_name}</span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{s.student_code} · {s.gender ?? '—'}</span>
          </div>
          {pw[s.id] && (
            <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'var(--primary-050)', fontSize: 14 }}>
              Mật khẩu mới: <b>{pw[s.id]}</b> — báo cho HS (chỉ hiện lần này).
            </div>
          )}
          {s.active ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              <button className="btn" style={btn} onClick={() => startEdit(s)}>Sửa</button>
              <button className="btn" style={btn} disabled={busy === s.id} onClick={() => reset(s)}>{busy === s.id ? '…' : 'Đổi mật khẩu'}</button>
              <button className="btn" style={{ ...btn, borderColor: 'var(--neg)', color: 'var(--neg)' }} disabled={busy === s.id} onClick={() => { if (confirm(`Cho ${s.full_name} thôi học? Em sẽ ẩn khỏi lớp, dữ liệu vẫn được giữ.`)) toggleActive(s, false) }}>Cho thôi học</button>
            </div>
          ) : (
            <button className="btn" style={{ ...btn, marginTop: 10 }} disabled={busy === s.id} onClick={() => toggleActive(s, true)}>Khôi phục</button>
          )}
        </>
      )}
    </div>
  )

  return (
    <div style={{ display: 'grid', gap: 10, paddingBottom: 20 }}>
      {err && <div style={box('var(--neg)')}>{err}</div>}
      <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>Đang học: <b>{active.length}</b>{left.length ? ` · đã thôi học: ${left.length}` : ''}. Thêm HS mới ở Thiết lập lớp.</p>
      {active.map(row)}
      {left.length > 0 && (
        <div>
          <button className="btn" style={{ width: '100%', marginTop: 4 }} onClick={() => setShowLeft((v) => !v)}>
            {showLeft ? 'Ẩn' : 'Xem'} danh sách đã thôi học ({left.length})
          </button>
          {showLeft && <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>{left.map(row)}</div>}
        </div>
      )}
    </div>
  )
}

function Center({ children }: { children: React.ReactNode }) { return <div style={{ display: 'grid', placeItems: 'center', minHeight: 160, color: 'var(--muted)', padding: 20 }}>{children}</div> }
const btn: React.CSSProperties = { minHeight: 38, padding: '0 14px', fontSize: 14 }
const box = (c: string): React.CSSProperties => ({ padding: '10px 12px', borderRadius: 10, background: `color-mix(in srgb, ${c} 12%, #fff)`, color: c, fontSize: 14 })
