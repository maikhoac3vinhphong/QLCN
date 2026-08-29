import { useEffect, useMemo, useState } from 'react'
import { errText } from '../lib/err'
import {
  getStudents, getLeaderboard, getChildRecords, getChildAttendance, sendParentFeedback,
  type Student, type ChildRecord, type AttStatus
} from '../lib/db'

const ATT_LABEL: Record<AttStatus, string> = { present: 'Có mặt', late: 'Muộn', excused: 'Phép', absent: 'Không phép' }
const ATT_COLOR: Record<AttStatus, string> = { present: 'var(--pos)', late: 'var(--warn)', excused: 'var(--primary)', absent: 'var(--neg)' }
type Range = 'today' | 'week' | 'month' | 'pick'

export default function Parent({ classId }: { classId: string }) {
  const [child, setChild] = useState<Student | null>(null)
  const [rank, setRank] = useState<{ total: number; rank: number } | null>(null)
  const [range, setRange] = useState<Range>('today')
  const [pickDate, setPickDate] = useState(todayStr())
  const [records, setRecords] = useState<ChildRecord[]>([])
  const [att, setAtt] = useState<{ date: string; status: AttStatus }[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [fb, setFb] = useState('')
  const [fbOk, setFbOk] = useState(false)
  const [busy, setBusy] = useState(false)

  const bounds = useMemo(() => rangeBounds(range, pickDate), [range, pickDate])

  useEffect(() => {
    (async () => {
      try {
        const [sts, lb] = await Promise.all([getStudents(classId), getLeaderboard(classId)])
        const c = sts[0] ?? null; setChild(c)
        if (c) { const row = lb.find((r) => r.student_id === c.id); if (row) setRank({ total: row.total, rank: row.rank }) }
      } catch (e) { setErr(errText(e)) }
    })()
  }, [classId])

  useEffect(() => {
    if (!child) return
    setLoading(true)
    Promise.all([
      getChildRecords(child.id, bounds.fromISO, bounds.toISO),
      getChildAttendance(child.id, bounds.fromDate, bounds.toDate)
    ]).then(([r, a]) => { setRecords(r); setAtt(a) }).catch((e) => setErr(errText(e))).finally(() => setLoading(false))
  }, [child, bounds.fromISO, bounds.toISO])

  async function send() {
    if (!child || !fb.trim()) return
    setBusy(true); setErr(null)
    try { await sendParentFeedback(classId, child.id, fb.trim()); setFb(''); setFbOk(true); setTimeout(() => setFbOk(false), 2500) }
    catch (e) { setErr(errText(e)) } finally { setBusy(false) }
  }

  if (err) return <div style={errBox}>{err}</div>
  if (!child) return <Center>Đang tải thông tin con…</Center>

  const todayAtt = att.find((a) => a.date === todayStr())

  return (
    <div style={{ display: 'grid', gap: 14, paddingBottom: 20 }}>
      <div className="card" style={{ padding: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{child.full_name}</div>
        <div style={{ display: 'flex', gap: 18, marginTop: 10 }}>
          <div><div style={lbl}>Điểm thi đua</div><div style={{ ...val, color: (rank?.total ?? 0) >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{rank?.total ?? 0}</div></div>
          <div><div style={lbl}>Hạng lớp</div><div style={val}>{rank?.rank ?? '—'}</div></div>
          <div><div style={lbl}>Hôm nay</div><div style={{ ...val, fontSize: 15, color: todayAtt ? ATT_COLOR[todayAtt.status] : 'var(--muted)' }}>{todayAtt ? ATT_LABEL[todayAtt.status] : 'Chưa điểm danh'}</div></div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Seg active={range === 'today'} onClick={() => setRange('today')}>Hôm nay</Seg>
        <Seg active={range === 'week'} onClick={() => setRange('week')}>Tuần</Seg>
        <Seg active={range === 'month'} onClick={() => setRange('month')}>Tháng</Seg>
        <Seg active={range === 'pick'} onClick={() => setRange('pick')}>Chọn ngày</Seg>
        {range === 'pick' && <input className="input" type="date" max={todayStr()} value={pickDate} onChange={(e) => setPickDate(e.target.value)} style={{ maxWidth: 160, minHeight: 38 }} />}
      </div>

      <section>
        <h3 style={h3}>Biểu dương & nhắc nhở</h3>
        {loading ? <Center>Đang tải…</Center> : records.length === 0 ? <Muted>Không có ghi nhận trong khoảng này.</Muted> : (
          <div style={{ display: 'grid', gap: 6 }}>
            {records.map((r) => (
              <div key={r.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px' }}>
                <span>{r.criterion_name}<span style={{ display: 'block', fontSize: 12, color: 'var(--muted)' }}>{new Date(r.created_at).toLocaleString('vi-VN')}</span></span>
                <b style={{ color: r.kind === 'cong' ? 'var(--pos)' : 'var(--neg)' }}>{r.points > 0 ? '+' + r.points : r.points}</b>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 style={h3}>Chuyên cần</h3>
        {att.length === 0 ? <Muted>Chưa có dữ liệu điểm danh.</Muted> : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {att.map((a) => (
              <span key={a.date} style={{ fontSize: 13, padding: '4px 10px', borderRadius: 999, color: ATT_COLOR[a.status], background: `color-mix(in srgb, ${ATT_COLOR[a.status]} 13%, #fff)` }}>
                {a.date.slice(5)} · {ATT_LABEL[a.status]}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ ...h3, marginTop: 0 }}>Nhắn cho giáo viên chủ nhiệm</h3>
        {fbOk && <div style={{ ...okBox }}>Đã gửi phản hồi.</div>}
        <textarea className="input" style={{ minHeight: 80, padding: 12, resize: 'vertical', fontFamily: 'inherit' }} value={fb} onChange={(e) => setFb(e.target.value)} placeholder="Lời nhắn, thắc mắc gửi GVCN…" />
        <button className="btn btn-primary" style={{ marginTop: 10 }} disabled={busy || !fb.trim()} onClick={send}>{busy ? 'Đang gửi…' : 'Gửi phản hồi'}</button>
      </section>
    </div>
  )
}

function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function rangeBounds(range: Range, pick: string) {
  const now = new Date(); const end = new Date(now); end.setHours(23, 59, 59, 999)
  let start = new Date(now); start.setHours(0, 0, 0, 0)
  if (range === 'week') start.setDate(start.getDate() - 6)
  else if (range === 'month') start = new Date(now.getFullYear(), now.getMonth(), 1)
  else if (range === 'pick') { const d = new Date(pick + 'T00:00:00'); return { fromISO: d.toISOString(), toISO: new Date(pick + 'T23:59:59').toISOString(), fromDate: pick, toDate: pick } }
  return { fromISO: start.toISOString(), toISO: end.toISOString(), fromDate: start.toISOString().slice(0, 10), toDate: end.toISOString().slice(0, 10) }
}

function Seg({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} style={{ minHeight: 38, padding: '0 14px', borderRadius: 999, fontSize: 14, fontWeight: 500, border: `1px solid ${active ? 'var(--primary)' : 'var(--line)'}`, background: active ? 'var(--primary)' : 'var(--surface)', color: active ? '#fff' : 'var(--ink)' }}>{children}</button>
}
function Center({ children }: { children: React.ReactNode }) { return <div style={{ display: 'grid', placeItems: 'center', minHeight: 140, color: 'var(--muted)', padding: 20 }}>{children}</div> }
function Muted({ children }: { children: React.ReactNode }) { return <div style={{ color: 'var(--muted)', fontSize: 14, padding: '6px 2px' }}>{children}</div> }
const h3: React.CSSProperties = { margin: '0 0 8px', fontSize: 16 }
const lbl: React.CSSProperties = { fontSize: 12, color: 'var(--muted)' }
const val: React.CSSProperties = { fontSize: 22, fontWeight: 700 }
const errBox: React.CSSProperties = { padding: '10px 12px', borderRadius: 10, background: 'color-mix(in srgb, var(--neg) 12%, #fff)', color: 'var(--neg)', fontSize: 14, margin: 12 }
const okBox: React.CSSProperties = { padding: '8px 12px', borderRadius: 10, background: 'color-mix(in srgb, var(--pos) 12%, #fff)', color: 'var(--pos)', fontSize: 14, marginBottom: 8 }
