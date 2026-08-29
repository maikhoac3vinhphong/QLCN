import { useState } from 'react'
import { signInWithUsername } from '../lib/auth'

export default function Login({ onSignedIn }: { onSignedIn: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    if (!username || !password) {
      setErr('Nhập tên đăng nhập và mật khẩu.')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      await signInWithUsername(username, password)
      onSignedIn()
    } catch {
      // Không lộ chi tiết (username có tồn tại hay không) — tôn trọng quyền riêng tư.
      setErr('Sai tên đăng nhập hoặc mật khẩu.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={wrap}>
      <div className="card" style={box}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={logo}>QLCN</div>
          <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>
            Quản lý nề nếp &amp; thi đua lớp
          </div>
        </div>

        <label className="label" htmlFor="u">Tên đăng nhập</label>
        <input
          id="u"
          className="input"
          autoComplete="username"
          autoCapitalize="none"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />

        <div style={{ height: 14 }} />

        <label className="label" htmlFor="p">Mật khẩu</label>
        <input
          id="p"
          className="input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />

        {err && <div style={errBox}>{err}</div>}

        <button className="btn btn-primary" style={{ width: '100%', marginTop: 18 }} disabled={busy} onClick={submit}>
          {busy ? 'Đang vào…' : 'Đăng nhập'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: 'var(--muted)' }}>
          Đăng nhập bằng QR sẽ có ở bản sau.
        </div>
      </div>
    </div>
  )
}

const wrap: React.CSSProperties = {
  minHeight: '100dvh',
  display: 'grid',
  placeItems: 'center',
  padding: 20
}
const box: React.CSSProperties = { width: '100%', maxWidth: 380, padding: 24 }
const logo: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 26,
  letterSpacing: 1,
  color: 'var(--primary)'
}
const errBox: React.CSSProperties = {
  marginTop: 14,
  padding: '10px 12px',
  borderRadius: 10,
  background: 'color-mix(in srgb, var(--neg) 12%, #fff)',
  color: 'var(--neg)',
  fontSize: 14
}
