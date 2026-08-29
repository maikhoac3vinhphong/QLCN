import { useEffect, useRef, useState } from 'react'
import { getNotifications, getUnreadCount, markAllRead, type Notif } from '../lib/db'

export default function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState<Notif[]>([])
  const wrap = useRef<HTMLDivElement>(null)

  async function refreshCount() { try { setUnread(await getUnreadCount()) } catch { /* im lặng */ } }
  useEffect(() => {
    refreshCount()
    const t = setInterval(refreshCount, 20000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  async function toggle() {
    const next = !open; setOpen(next)
    if (next) {
      try { setItems(await getNotifications()); await markAllRead(); setUnread(0) } catch { /* im lặng */ }
    }
  }

  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      <button onClick={toggle} aria-label="Thông báo" style={{ background: 'transparent', border: 'none', position: 'relative', padding: 4, display: 'grid', placeItems: 'center' }}>
        <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, fill: 'none', stroke: 'var(--ink)', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && <span style={{ position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, background: 'var(--neg)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="card" style={{ position: 'absolute', right: 0, top: 40, width: 300, maxHeight: 380, overflow: 'auto', zIndex: 20, padding: 6 }}>
          <div style={{ padding: '8px 10px', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>Thông báo</div>
          {items.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>Chưa có thông báo.</div>
          ) : items.map((n) => (
            <div key={n.id} style={{ padding: '10px 10px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{n.title}</div>
              {n.body && <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{n.body}</div>}
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{new Date(n.created_at).toLocaleString('vi-VN')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
