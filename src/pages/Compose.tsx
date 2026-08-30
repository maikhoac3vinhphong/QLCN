import { useEffect, useState } from 'react'
import { errText } from '../lib/err'
import { getStudents, sendAnnouncement, sendNewsletter, sendPush, isoWeek, type Student } from '../lib/db'

export default function Compose({ classId, mode }: { classId: string; mode: 'announcement' | 'newsletter' }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState<'hs' | 'phhs' | 'both'>('hs')
  const [scope, setScope] = useState<'all' | 'custom'>('all')
  const [students, setStudents] = useState<Student[]>([])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [week, setWeek] = useState(isoWeek())
  const [toHs, setToHs] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  useEffect(() => { if (mode === 'announcement') getStudents(classId).then(setStudents).catch(() => {}) }, [classId, mode])

  async function send() {
    setErr(null); setOk(null)
    if (mode === 'announcement') {
      if (!title.trim() || !body.trim()) { setErr('Nhập tiêu đề và nội dung.'); return }
      if (scope === 'custom' && picked.size === 0) { setErr('Chọn ít nhất một học sinh.'); return }
      setBusy(true)
      try {
        const ids = await sendAnnouncement(classId, title.trim(), body.trim(), audience, scope === 'custom' ? [...picked] : null)
        await sendPush(ids, title.trim(), body.trim())
        setOk(recipientMsg(ids.length, audience)); setTitle(''); setBody(''); setPicked(new Set()); setScope('all')
      } catch (e) { setErr(errText(e)) } finally { setBusy(false) }
    } else {
      if (!body.trim()) { setErr('Nhập nội dung bản tin.'); return }
      setBusy(true)
      try {
        const ids = await sendNewsletter(classId, week.trim(), body.trim(), toHs)
        await sendPush(ids, 'Bản tin tuần ' + week.trim(), body.trim())
        setOk(ids.length === 0 ? 'Đã lưu & gửi. Hiện chưa có phụ huynh nào nhận (chờ onboarding phụ huynh).' : `Đã gửi tới ${ids.length} người.`)
        setBody('')
      } catch (e) { setErr(errText(e)) } finally { setBusy(false) }
    }
  }

  return (
    <div className="card" style={{ padding: 18, display: 'grid', gap: 12 }}>
      {err && <div style={box('var(--neg)')}>{err}</div>}
      {ok && <div style={box('var(--pos)')}>{ok}</div>}

      {mode === 'announcement' ? (
        <>
          <div><label className="label">Tiêu đề</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Nhắc họp lớp" /></div>
          <div><label className="label">Nội dung</label><textarea className="input" style={ta} value={body} onChange={(e) => setBody(e.target.value)} /></div>
          <div>
            <label className="label">Gửi cho</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <Seg active={audience === 'hs'} onClick={() => setAudience('hs')}>Học sinh</Seg>
              <Seg active={audience === 'phhs'} onClick={() => setAudience('phhs')}>Phụ huynh</Seg>
              <Seg active={audience === 'both'} onClick={() => setAudience('both')}>Cả hai</Seg>
            </div>
          </div>
          <div>
            <label className="label">Phạm vi</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <Seg active={scope === 'all'} onClick={() => setScope('all')}>Cả lớp</Seg>
              <Seg active={scope === 'custom'} onClick={() => setScope('custom')}>Chọn HS</Seg>
            </div>
          </div>
          {scope === 'custom' && (
            <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid var(--line)', borderRadius: 10, padding: 6 }}>
              {students.map((s) => {
                const on = picked.has(s.id)
                return (
                  <button key={s.id} onClick={() => setPicked((p) => { const n = new Set(p); on ? n.delete(s.id) : n.add(s.id); return n })}
                    style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'transparent', border: 'none', textAlign: 'left', fontSize: 14 }}>
                    <span style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${on ? 'var(--primary)' : 'var(--line)'}`, background: on ? 'var(--primary)' : '#fff', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12 }}>{on ? '✓' : ''}</span>
                    {s.full_name}
                  </button>
                )
              })}
            </div>
          )}
          {(audience === 'phhs' || audience === 'both') && (
            <div style={{ fontSize: 13, color: 'var(--warn)' }}>Lưu ý: phụ huynh chỉ nhận được sau khi hoàn tất onboarding phụ huynh.</div>
          )}
        </>
      ) : (
        <>
          <div><label className="label">Tuần</label><input className="input" style={{ maxWidth: 140 }} value={week} onChange={(e) => setWeek(e.target.value)} /></div>
          <div><label className="label">Nội dung bản tin (gửi phụ huynh)</label><textarea className="input" style={ta} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Tóm tắt tình hình lớp trong tuần, lời động viên…" /></div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
            <input type="checkbox" checked={toHs} onChange={(e) => setToHs(e.target.checked)} /> Gửi cả cho học sinh
          </label>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Bản tin do bạn soạn và bấm gửi — không tự động gửi. Gợi ý AI sẽ thêm khi có nguồn AI miễn phí.</div>
        </>
      )}

      <button className="btn btn-primary" disabled={busy} onClick={send}>{busy ? 'Đang gửi…' : mode === 'announcement' ? 'Gửi thông báo' : 'Gửi bản tin'}</button>
    </div>
  )
}

function recipientMsg(n: number, audience: string) {
  if (n === 0) return audience === 'hs' ? 'Đã gửi, nhưng chưa có HS nào có tài khoản nhận.' : 'Đã gửi. Chưa có người nhận (phụ huynh chưa onboarding).'
  return `Đã gửi tới ${n} người.`
}
function Seg({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} style={{ flex: 1, minHeight: 40, borderRadius: 10, fontSize: 14, fontWeight: 500, border: `1px solid ${active ? 'var(--primary)' : 'var(--line)'}`, background: active ? 'var(--primary)' : 'var(--surface)', color: active ? '#fff' : 'var(--ink)' }}>{children}</button>
}
const ta: React.CSSProperties = { minHeight: 120, padding: 12, resize: 'vertical', fontFamily: 'inherit' }
const box = (c: string): React.CSSProperties => ({ padding: '10px 12px', borderRadius: 10, background: `color-mix(in srgb, ${c} 12%, #fff)`, color: c, fontSize: 14 })
