import { useEffect, useState } from 'react'
import { signInWithUsername } from '../lib/auth'
import { errText } from '../lib/err'
import { parentLinkInfo, claimParent } from '../lib/db'

export default function ParentClaim({ token }: { token: string }) {
  const [info, setInfo] = useState<{ full_name: string; claimed: boolean } | null | 'loading' | 'invalid'>('loading')
  const [name, setName] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    parentLinkInfo(token).then((r) => setInfo(r ?? 'invalid')).catch(() => setInfo('invalid'))
  }, [token])

  async function submit() {
    if (pw.length < 4) { setErr('Mật khẩu tối thiểu 4 ký tự.'); return }
    if (pw !== pw2) { setErr('Hai lần nhập mật khẩu chưa khớp.'); return }
    setBusy(true); setErr(null)
    try {
      const res = await claimParent(token, pw, name.trim() || null)
      if (res.username) {
        await signInWithUsername(res.username, pw)
        window.location.href = '/'   // vào trang phụ huynh
      } else { setErr('Không lấy được tài khoản. Thử lại.') }
    } catch (e) { setErr(errText(e)) } finally { setBusy(false) }
  }

  return (
    <div style={wrap}>
      <div className="card" style={box}>
        <div style={{ fontWeight: 700, fontSize: 22, color: 'var(--primary)', marginBottom: 4 }}>QLCN</div>

        {info === 'loading' && <p style={{ color: 'var(--muted)' }}>Đang kiểm tra link…</p>}
        {info === 'invalid' && <p style={{ color: 'var(--neg)' }}>Link không hợp lệ hoặc đã hết hạn. Vui lòng xin lại link từ giáo viên chủ nhiệm.</p>}

        {info && typeof info === 'object' && info.claimed && (
          <>
            <p>Link này đã được kích hoạt trước đó.</p>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 10 }} onClick={() => (window.location.href = '/')}>Đến trang đăng nhập</button>
          </>
        )}

        {info && typeof info === 'object' && !info.claimed && (
          <>
            <p style={{ marginTop: 0 }}>Theo dõi tình hình học tập của <b>{info.full_name}</b>. Đặt mật khẩu để nhận và đăng nhập lần sau.</p>
            <label className="label">Tên phụ huynh (tuỳ chọn)</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Phụ huynh em An" />
            <div style={{ height: 10 }} />
            <label className="label">Mật khẩu</label>
            <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
            <div style={{ height: 10 }} />
            <label className="label">Nhập lại mật khẩu</label>
            <input className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
            {err && <div style={errBox}>{err}</div>}
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} disabled={busy} onClick={submit}>
              {busy ? 'Đang xử lý…' : 'Nhận con & vào theo dõi'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

const wrap: React.CSSProperties = { minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 20 }
const box: React.CSSProperties = { width: '100%', maxWidth: 400, padding: 24 }
const errBox: React.CSSProperties = { marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'color-mix(in srgb, var(--neg) 12%, #fff)', color: 'var(--neg)', fontSize: 14 }
