import { useState } from 'react'
import { signInWithUsername } from '../lib/auth'
import { useIsDesktop } from '../lib/useIsDesktop'

export default function Login({ onSignedIn }: { onSignedIn: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const desktop = useIsDesktop()

  async function submit() {
    if (!username || !password) { setErr('Nhập tên đăng nhập và mật khẩu.'); return }
    setBusy(true); setErr(null)
    try { await signInWithUsername(username, password); onSignedIn() }
    catch { setErr('Sai tên đăng nhập hoặc mật khẩu.') }
    finally { setBusy(false) }
  }

  const form = (
    <div style={{ width: '100%', maxWidth: 380 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 24, color: 'var(--primary)', letterSpacing: 1 }}>QLCN</div>
        <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 2 }}>Đăng nhập để tiếp tục</div>
      </div>
      <label className="label" htmlFor="u">Tên đăng nhập</label>
      <input id="u" className="input" autoComplete="username" autoCapitalize="none" value={username}
        onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      <div style={{ height: 14 }} />
      <label className="label" htmlFor="p">Mật khẩu</label>
      <input id="p" className="input" type="password" autoComplete="current-password" value={password}
        onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      {err && <div style={errBox}>{err}</div>}
      <button className="btn btn-primary" style={{ width: '100%', marginTop: 18 }} disabled={busy} onClick={submit}>
        {busy ? 'Đang vào…' : 'Đăng nhập'}
      </button>
      <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: 'var(--muted)' }}>
        Học sinh dùng mã HS · Phụ huynh mở link/QR do giáo viên cấp.
      </div>
    </div>
  )

  if (desktop) {
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <div style={{ background: 'var(--primary)', color: '#fff', padding: 48, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 34, letterSpacing: 1 }}>QLCN</div>
          <div style={{ fontSize: 18, marginTop: 10, opacity: .95 }}>Quản lý nề nếp &amp; thi đua lớp, kết nối phụ huynh.</div>
          <ul style={{ marginTop: 26, lineHeight: 2, fontSize: 15, opacity: .95, paddingLeft: 18 }}>
            <li>Ghi nhận thi đua, điểm danh nhanh</li>
            <li>Thu chi quỹ minh bạch, thông báo tới phụ huynh</li>
            <li>Sơ đồ lớp, radar học sinh, cảnh báo sớm</li>
          </ul>
        </div>
        <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}>
          {form}
          <Foot />
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 20 }}>
        <div className="card" style={{ width: '100%', maxWidth: 380, padding: 24 }}>{form}</div>
      </div>
      <Foot />
    </div>
  )
}

function Foot() {
  return <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, padding: 16 }}>QLCN — Quản lý chủ nhiệm</div>
}
const errBox: React.CSSProperties = { marginTop: 14, padding: '10px 12px', borderRadius: 10, background: 'color-mix(in srgb, var(--neg) 12%, #fff)', color: 'var(--neg)', fontSize: 14 }
