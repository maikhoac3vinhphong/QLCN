import { useCallback, useEffect, useState } from 'react'
import type { Profile } from '../lib/auth'
import { decideRecord, getPending, type PendingRow } from '../lib/db'

export default function Approvals({ profile, classId }: { profile: Profile; classId: string }) {
  const [rows, setRows] = useState<PendingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    try { setRows(await getPending(classId)) }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    finally { setLoading(false) }
  }, [classId])

  useEffect(() => { load() }, [load])

  async function decide(id: string, approve: boolean) {
    setBusy(id); setErr(null)
    try {
      await decideRecord(id, approve, profile.id)
      setRows((prev) => prev.filter((r) => r.id !== id))
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) } finally { setBusy(null) }
  }

  if (loading) return <Center>Đang tải…</Center>
  if (err) return <div style={errBox}>{err}</div>
  if (rows.length === 0) return <Center>Không có ghi nhận nào chờ duyệt.</Center>

  return (
    <div style={{ display: 'grid', gap: 8, paddingBottom: 20 }}>
      <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 6px' }}>
        Các khoản trừ nặng do tổ trưởng nhập, chờ bạn quyết định.
      </p>
      {rows.map((r) => (
        <div key={r.id} className="card" style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 600 }}>{r.student_name}</span>
            <b style={{ color: 'var(--neg)' }}>{r.points}</b>
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 2 }}>{r.criterion_name}</div>
          {r.note && <div style={{ fontSize: 13, marginTop: 4 }}>{r.note}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn" style={{ flex: 1, borderColor: 'var(--pos)', color: 'var(--pos)' }}
              disabled={busy === r.id} onClick={() => decide(r.id, true)}>Duyệt</button>
            <button className="btn" style={{ flex: 1, borderColor: 'var(--neg)', color: 'var(--neg)' }}
              disabled={busy === r.id} onClick={() => decide(r.id, false)}>Từ chối</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', placeItems: 'center', minHeight: 200, color: 'var(--muted)', textAlign: 'center', padding: 20 }}>{children}</div>
}
const errBox: React.CSSProperties = { padding: '10px 12px', borderRadius: 10, background: 'color-mix(in srgb, var(--neg) 12%, #fff)', color: 'var(--neg)', fontSize: 14, margin: 12 }
