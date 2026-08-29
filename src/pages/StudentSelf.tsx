import { useEffect, useMemo, useState } from 'react'
import { errText } from '../lib/err'
import { AXES } from '../lib/axes'
import { getMyStudent, getAxisNet, getLeaderboard, getChildRecords, type ChildRecord, type LeaderRow } from '../lib/db'
import Radar from './Radar'

export default function StudentSelf({ classId }: { classId: string }) {
  const [me, setMe] = useState<{ id: string; full_name: string; group_id: string | null } | null>(null)
  const [net, setNet] = useState<Record<string, number>>({})
  const [board, setBoard] = useState<LeaderRow[]>([])
  const [feed, setFeed] = useState<ChildRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const s = await getMyStudent()
        if (!s) { setErr('Không tìm thấy hồ sơ học sinh của bạn.'); setLoading(false); return }
        setMe(s)
        const to = new Date(); const from = new Date(to.getFullYear(), to.getMonth() - 2, 1) // ~3 tháng gần nhất
        const [n, lb, fd] = await Promise.all([
          getAxisNet(s.id), getLeaderboard(classId),
          getChildRecords(s.id, from.toISOString(), new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59).toISOString())
        ])
        setNet(n); setBoard(lb); setFeed(fd)
      } catch (e) { setErr(errText(e)) } finally { setLoading(false) }
    })()
  }, [classId])

  // Điểm ròng → thang 0..100 (50 = trung tính; không bao giờ về 0 để tránh cảm giác "kém").
  const scores = useMemo(() => {
    const out: Record<string, number> = {}
    for (const a of AXES) out[a.key] = Math.max(5, Math.min(100, 50 + (net[a.key] ?? 0) * 4))
    return out
  }, [net])

  const mine = me ? board.find((r) => r.student_id === me.id) : undefined
  const inGroup = useMemo(() => {
    if (!me?.group_id) return null
    const g = board.filter((r) => r.group_id === me.group_id).sort((a, b) => b.total - a.total)
    const idx = g.findIndex((r) => r.student_id === me.id)
    return idx >= 0 ? { rank: idx + 1, size: g.length } : null
  }, [board, me])

  const encouragement = useMemo(() => buildEncouragement(scores), [scores])

  if (loading) return <Center>Đang tải…</Center>
  if (err) return <div style={errBox}>{err}</div>

  return (
    <div style={{ display: 'grid', gap: 14, paddingBottom: 20 }}>
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{me?.full_name}</div>
          {mine?.rank === 1 && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--warn)' }}>🏆 Top lớp</span>}
        </div>
        <div style={{ display: 'flex', gap: 20, marginTop: 10 }}>
          <div><div style={lbl}>Điểm</div><div style={{ ...val, color: (mine?.total ?? 0) >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{mine?.total ?? 0}</div></div>
          <div><div style={lbl}>Hạng lớp</div><div style={val}>{mine?.rank ?? '—'}</div></div>
          {inGroup && <div><div style={lbl}>Hạng tổ</div><div style={val}>{inGroup.rank}/{inGroup.size}</div></div>}
        </div>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <h3 style={{ ...h3, marginTop: 0 }}>5 mặt của em</h3>
        <Radar values={scores} />
        <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 12, background: 'var(--primary-050)', fontSize: 14, lineHeight: 1.6 }}>
          {encouragement}
        </div>
        {Object.values(net).every((v) => v === 0) && (
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
            (Biểu đồ sẽ rõ hơn khi có thêm ghi nhận đã được phân nhóm theo 5 mặt.)
          </div>
        )}
      </div>

      <section>
        <h3 style={h3}>Biểu dương &amp; nhắc nhở gần đây</h3>
        {feed.length === 0 ? <Muted>Chưa có ghi nhận nào.</Muted> : (
          <div style={{ display: 'grid', gap: 6 }}>
            {feed.slice(0, 20).map((r) => (
              <div key={r.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px' }}>
                <span>{r.criterion_name}<span style={{ display: 'block', fontSize: 12, color: 'var(--muted)' }}>{new Date(r.created_at).toLocaleString('vi-VN')}</span></span>
                <b style={{ color: r.kind === 'cong' ? 'var(--pos)' : 'var(--neg)' }}>{r.points > 0 ? '+' + r.points : r.points}</b>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// Gợi ý động viên: nêu điểm mạnh, khuyên cải thiện — KHÔNG chê, KHÔNG so sánh với bạn khác.
function buildEncouragement(scores: Record<string, number>): string {
  const entries = AXES.map((a) => ({ key: a.key, label: a.label, v: scores[a.key] ?? 50 }))
  const allNeutral = entries.every((e) => e.v === 50)
  if (allNeutral) return 'Chào em! Hãy tiếp tục cố gắng mỗi ngày, những nỗ lực nhỏ sẽ tạo nên tiến bộ lớn nhé.'
  const strong = [...entries].sort((a, b) => b.v - a.v)[0]
  const grow = [...entries].sort((a, b) => a.v - b.v)[0]
  let msg = `Em đang làm rất tốt ở mặt ${strong.label.toLowerCase()} — hãy giữ vững nhé! `
  if (grow.v < 50 || grow.key !== strong.key) {
    msg += `Nếu để ý thêm một chút ở ${grow.label.toLowerCase()}, em sẽ tiến bộ toàn diện hơn. Cô/thầy tin em làm được.`
  } else {
    msg += 'Em đang cân bằng đều các mặt, thật đáng khen.'
  }
  return msg
}

function Center({ children }: { children: React.ReactNode }) { return <div style={{ display: 'grid', placeItems: 'center', minHeight: 160, color: 'var(--muted)', padding: 20 }}>{children}</div> }
function Muted({ children }: { children: React.ReactNode }) { return <div style={{ color: 'var(--muted)', fontSize: 14, padding: '6px 2px' }}>{children}</div> }
const h3: React.CSSProperties = { margin: '0 0 8px', fontSize: 16 }
const lbl: React.CSSProperties = { fontSize: 12, color: 'var(--muted)' }
const val: React.CSSProperties = { fontSize: 22, fontWeight: 700 }
const errBox: React.CSSProperties = { padding: '10px 12px', borderRadius: 10, background: 'color-mix(in srgb, var(--neg) 12%, #fff)', color: 'var(--neg)', fontSize: 14, margin: 12 }
