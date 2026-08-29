import { useEffect, useState } from 'react'

// Chỉ báo trạng thái mạng. Ngày 4 sẽ gắn thêm số việc đang chờ đồng bộ.
export default function NetBadge() {
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  const bg = online
    ? 'color-mix(in srgb, var(--pos) 14%, #fff)'
    : 'color-mix(in srgb, var(--warn) 16%, #fff)'
  const fg = online ? 'var(--pos)' : 'var(--warn)'

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px',
      borderRadius: 999, background: bg, color: fg, fontSize: 13, fontWeight: 500 }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: fg }} />
      {online ? 'Trực tuyến' : 'Offline · sẽ đồng bộ'}
    </span>
  )
}
