import { useEffect, useState } from 'react'
import { pushSupported, isPushEnabled, enablePush } from '../lib/push'

export default function PushToggle() {
  const [state, setState] = useState<'loading' | 'on' | 'off' | 'unsupported'>('loading')
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!pushSupported()) { setState('unsupported'); return }
    isPushEnabled().then((on) => setState(on ? 'on' : 'off')).catch(() => setState('off'))
  }, [])

  async function turnOn() {
    setMsg(null)
    const r = await enablePush()
    if (r === 'ok') { setState('on'); setMsg('Đã bật thông báo đẩy trên thiết bị này.') }
    else if (r === 'denied') setMsg('Bạn đã từ chối quyền thông báo. Bật lại trong cài đặt trình duyệt.')
    else if (r === 'unsupported') setMsg('Thiết bị/trình duyệt chưa hỗ trợ.')
    else if (r === 'no-key') setMsg('Chưa cấu hình khóa VAPID (VITE_VAPID_PUBLIC_KEY).')
    else setMsg('Không bật được. Trên iPhone, hãy thêm app vào Màn hình chính trước rồi thử lại.')
  }

  if (state === 'loading') return null
  return (
    <div className="card" style={{ padding: 16, marginTop: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 15 }}>Thông báo đẩy</div>
      {state === 'unsupported' ? (
        <p style={{ color: 'var(--muted)', fontSize: 13, margin: '6px 0 0' }}>Thiết bị này chưa hỗ trợ thông báo đẩy.</p>
      ) : state === 'on' ? (
        <p style={{ color: 'var(--pos)', fontSize: 14, margin: '6px 0 0' }}>✓ Đang bật trên thiết bị này.</p>
      ) : (
        <>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: '6px 0 10px' }}>Nhận thông báo ngay cả khi không mở app. Trên iPhone cần thêm app vào Màn hình chính trước.</p>
          <button className="btn btn-primary" onClick={turnOn}>Bật thông báo đẩy</button>
        </>
      )}
      {msg && <p style={{ fontSize: 13, marginTop: 8, color: 'var(--muted)' }}>{msg}</p>}
    </div>
  )
}
