import { useCallback, useEffect, useState } from 'react'
import { getGroupTotals, getLeaderboard, type GroupRow, type LeaderRow } from '../lib/db'

export default function Leaderboard({ classId }: { classId: string }) {
  const [tab, setTab] = useState<'ca_nhan' | 'to'>('ca_nhan')
  const [rows, setRows] = useState<LeaderRow[]>([])
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [lb, gt] = await Promise.all([getLeaderboard(classId), getGroupTotals(classId)])
      setRows(lb); setGroups(gt)
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) } finally { setLoading(false) }
  }, [classId])

  useEffect(() => {
    load()
    const t = setInterval(load, 15000) // tự làm mới; realtime push để Ngày sau
    return () => clearInterval(t)
  }, [load])

  const maxGroup = Math.max(1, ...groups.map((g) => Math.abs(g.total)))

  return (
    <div style={{ paddingBottom: 20 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <TabBtn active={tab === 'ca_nhan'} onClick={() => setTab('ca_nhan')}>Cá nhân</TabBtn>
        <TabBtn active={tab === 'to'} onClick={() => setTab('to')}>Theo tổ</TabBtn>
        <button className="btn" style={{ minHeight: 36, marginLeft: 'auto' }} onClick={load}>Làm mới</button>
      </div>

      {err && <div style={errBox}>{err}</div>}
      {loading ? <Center>Đang tải…</Center> : tab === 'ca_nhan' ? (
        rows.length === 0 ? <Center>Chưa có dữ liệu xếp hạng.</Center> : (
          <div style={{ display: 'grid', gap: 8 }}>
            {rows.map((r) => (
              <div key={r.student_id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                <span style={rankStyle(r.rank)}>{r.rank}</span>
                <span style={{ flex: 1, fontWeight: 500 }}>
                  {r.display_name}{r.rank === 1 && <span style={badge}>🏆 Top lớp</span>}
                </span>
                <b style={{ color: r.total > 0 ? 'var(--pos)' : r.total < 0 ? 'var(--neg)' : 'var(--muted)' }}>{r.total}</b>
              </div>
            ))}
          </div>
        )
      ) : (
        groups.length === 0 ? <Center>Chưa có tổ.</Center> : (
          <div style={{ display: 'grid', gap: 10 }}>
            {[...groups].sort((a, b) => b.total - a.total).map((g) => (
              <div key={g.group_id} className="card" style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 500 }}>{g.group_name}</span>
                  <b style={{ color: g.total >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{g.total}</b>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: 'var(--line)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.max(4, Math.abs(g.total) / maxGroup * 100)}%`,
                    background: g.total >= 0 ? 'var(--pos)' : 'var(--neg)' }} />
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}

function rankStyle(rank: number): React.CSSProperties {
  const bg = rank === 1 ? '#f4c430' : rank === 2 ? '#b8c0c8' : rank === 3 ? '#cd7f32' : 'var(--primary-100)'
  const fg = rank <= 3 ? '#fff' : 'var(--primary)'
  return { minWidth: 30, height: 30, borderRadius: 999, background: bg, color: fg, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 14 }
}
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} style={{ minHeight: 38, padding: '0 16px', borderRadius: 999, fontSize: 14, fontWeight: 500,
    border: `1px solid ${active ? 'var(--primary)' : 'var(--line)'}`, background: active ? 'var(--primary)' : 'var(--surface)', color: active ? '#fff' : 'var(--ink)' }}>{children}</button>
}
function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', placeItems: 'center', minHeight: 200, color: 'var(--muted)', textAlign: 'center', padding: 20 }}>{children}</div>
}
const badge: React.CSSProperties = { marginLeft: 8, fontSize: 12, color: 'var(--warn)', fontWeight: 600 }
const errBox: React.CSSProperties = { padding: '10px 12px', borderRadius: 10, background: 'color-mix(in srgb, var(--neg) 12%, #fff)', color: 'var(--neg)', fontSize: 14, marginBottom: 12 }
