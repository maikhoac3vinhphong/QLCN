import { useEffect, useState } from 'react'
import { errText } from '../lib/err'
import { getEarlyWarnings, type Warning } from '../lib/db'

export default function EarlyWarnings({ classId }: { classId: string }) {
  const [rows, setRows] = useState<Warning[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    getEarlyWarnings(classId).then(setRows).catch((e) => setErr(errText(e))).finally(() => setLoading(false))
  }, [classId])

  if (loading) return <Center>Đang rà soát…</Center>
  if (err) return <div style={box('var(--neg)')}>{err}</div>
  if (rows.length === 0) return <Center>Không có cảnh báo nào trong 2 tuần gần đây. Lớp đang ổn định 👍</Center>

  return (
    <div style={{ display: 'grid', gap: 10, paddingBottom: 20 }}>
      <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0, lineHeight: 1.55 }}>
        Các em nên được quan tâm, hỏi han kịp thời (dựa trên 14 ngày gần nhất). Đây là gợi ý để đồng hành, không phải để phạt.
      </p>
      {rows.map((r) => {
        const reasons: string[] = []
        if (r.late_absent >= 3) reasons.push(`Muộn/vắng ${r.late_absent} lần`)
        if (r.recent_net <= -5) reasons.push(`Điểm giảm ${r.recent_net}`)
        return (
          <div key={r.student_id} className="card" style={{ padding: '12px 16px' }}>
            <div style={{ fontWeight: 600 }}>{r.full_name}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {reasons.map((x, i) => (
                <span key={i} style={{ fontSize: 13, padding: '3px 10px', borderRadius: 999, color: 'var(--warn)', background: 'color-mix(in srgb, var(--warn) 14%, #fff)' }}>{x}</span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Center({ children }: { children: React.ReactNode }) { return <div style={{ display: 'grid', placeItems: 'center', minHeight: 160, color: 'var(--muted)', textAlign: 'center', padding: 20 }}>{children}</div> }
const box = (c: string): React.CSSProperties => ({ padding: '10px 12px', borderRadius: 10, background: `color-mix(in srgb, ${c} 12%, #fff)`, color: c, fontSize: 14 })
