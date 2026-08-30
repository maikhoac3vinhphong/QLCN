import { useEffect, useState } from 'react'
import { errText } from '../lib/err'
import { getClassInfo, startNewYear } from '../lib/db'

export default function NewYear({ classId }: { classId: string }) {
  const [info, setInfo] = useState<{ name: string; school_year: string } | null>(null)
  const [year, setYear] = useState('')
  const [ack, setAck] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    getClassInfo(classId).then((c) => {
      if (c) { setInfo(c); setYear(nextYear(c.school_year)) }
    }).catch((e) => setErr(errText(e)))
  }, [classId])

  async function go() {
    if (!year.trim()) { setErr('Nhập năm học mới.'); return }
    setBusy(true); setErr(null)
    try {
      await startNewYear(classId, year.trim())
      window.location.reload() // vào lớp mới (được chọn tự động vì mới nhất)
    } catch (e) { setErr(errText(e)); setBusy(false) }
  }

  if (!info) return <Center>Đang tải…</Center>

  return (
    <div style={{ display: 'grid', gap: 14, paddingBottom: 20 }}>
      {err && <div style={box('var(--neg)')}>{err}</div>}
      <div className="card" style={{ padding: 18 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 17 }}>Khởi tạo năm học mới</h3>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0, lineHeight: 1.6 }}>
          Lớp hiện tại: <b style={{ color: 'var(--ink)' }}>{info.name}</b> · năm {info.school_year}.
        </p>
        <div style={{ marginTop: 14 }}>
          <label className="label">Năm học mới</label>
          <input className="input" style={{ maxWidth: 200 }} value={year} onChange={(e) => setYear(e.target.value)} placeholder="VD 2026-2027" />
        </div>
        <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: 'color-mix(in srgb, var(--warn) 12%, #fff)', color: 'var(--ink)', fontSize: 14, lineHeight: 1.6 }}>
          Lớp mới sẽ <b>giữ nguyên các tổ và bộ tiêu chí</b> nhưng <b>chưa có học sinh</b> — bạn sẽ nhập danh sách mới ở Thiết lập lớp.
          Dữ liệu năm cũ <b>được lưu lại</b> (chuyển sang chế độ chỉ xem), <b>không bị xóa</b>.
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, fontSize: 14 }}>
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> Tôi hiểu và muốn tạo năm học mới.
        </label>
        <button className="btn btn-primary" style={{ marginTop: 14 }} disabled={busy || !ack} onClick={go}>
          {busy ? 'Đang tạo…' : 'Tạo năm học mới'}
        </button>
      </div>
    </div>
  )
}

function nextYear(sy: string): string {
  const m = sy.match(/(\d{4})\s*-\s*(\d{4})/)
  if (m) return `${+m[1] + 1}-${+m[2] + 1}`
  const y = new Date().getFullYear()
  return `${y}-${y + 1}`
}
function Center({ children }: { children: React.ReactNode }) { return <div style={{ display: 'grid', placeItems: 'center', minHeight: 160, color: 'var(--muted)', padding: 20 }}>{children}</div> }
const box = (c: string): React.CSSProperties => ({ padding: '10px 12px', borderRadius: 10, background: `color-mix(in srgb, ${c} 12%, #fff)`, color: c, fontSize: 14 })
