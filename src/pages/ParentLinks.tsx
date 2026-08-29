import { useEffect, useState } from 'react'
import { errText } from '../lib/err'
import { ensureParentLinks, type ParentLink } from '../lib/db'

export default function ParentLinks({ classId }: { classId: string }) {
  const [links, setLinks] = useState<ParentLink[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    ensureParentLinks(classId).then(setLinks).catch((e) => setErr(errText(e))).finally(() => setLoading(false))
  }, [classId])

  const urlOf = (token: string) => `${window.location.origin}/ph/${token}`

  async function copy(token: string) {
    try { await navigator.clipboard.writeText(urlOf(token)); setCopied(token); setTimeout(() => setCopied(null), 1500) }
    catch { setErr('Không sao chép được. Hãy nhấn giữ để chọn link thủ công.') }
  }

  if (loading) return <Center>Đang tạo link…</Center>
  if (err) return <div style={errBox}>{err}</div>

  const claimedCount = links.filter((l) => l.claimed).length

  return (
    <div style={{ display: 'grid', gap: 10, paddingBottom: 20 }}>
      <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0, lineHeight: 1.55 }}>
        Mỗi HS một link riêng. Gửi link cho phụ huynh (dán vào tin nhắn, hoặc cho quét sau này).
        Phụ huynh mở link, đặt mật khẩu là theo dõi được con. Đã nhận: <b>{claimedCount}</b>/{links.length}.
      </p>
      {links.map((l) => (
        <div key={l.student_id} className="card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>{l.full_name}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: l.claimed ? 'var(--pos)' : 'var(--muted)' }}>
              {l.claimed ? '✓ Đã nhận' : 'Chưa nhận'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
            <input className="input" readOnly value={urlOf(l.token)} style={{ fontSize: 13, minHeight: 40 }} onFocus={(e) => e.currentTarget.select()} />
            <button className="btn" style={{ minHeight: 40, whiteSpace: 'nowrap' }} onClick={() => copy(l.token)}>
              {copied === l.token ? 'Đã chép' : 'Sao chép'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', placeItems: 'center', minHeight: 160, color: 'var(--muted)', textAlign: 'center', padding: 20 }}>{children}</div>
}
const errBox: React.CSSProperties = { padding: '10px 12px', borderRadius: 10, background: 'color-mix(in srgb, var(--neg) 12%, #fff)', color: 'var(--neg)', fontSize: 14 }
