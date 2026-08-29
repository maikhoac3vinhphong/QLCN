import { useState } from 'react'
import type { Profile } from '../lib/auth'
import { signOut } from '../lib/auth'
import NetBadge from '../lib/NetBadge'
import Record from './Record'
import Attendance from './Attendance'
import Leaderboard from './Leaderboard'
import Tools from './Tools'

type TabId = 'home' | 'record' | 'attend' | 'board' | 'tools'

const TAB_LABEL: Record<TabId, string> = {
  home: 'Trang chủ', record: 'Ghi nhận', attend: 'Điểm danh', board: 'Thi đua', tools: 'Tiện ích'
}

function tabsFor(role: Profile['role']): TabId[] {
  switch (role) {
    case 'gvcn': return ['home', 'record', 'attend', 'board', 'tools']
    case 'totruong': return ['record', 'attend', 'board', 'home']
    default: return ['board', 'home'] // hs, phhs (trang riêng thêm sau)
  }
}

export default function Shell({ profile, classId, onSignedOut }: { profile: Profile; classId: string; onSignedOut: () => void }) {
  const tabs = tabsFor(profile.role)
  const [tab, setTab] = useState<TabId>(tabs[0])

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--line)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 5 }}>
        <span style={{ fontWeight: 700, color: 'var(--primary)' }}>QLCN</span>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{TAB_LABEL[tab]}</span>
        <NetBadge />
      </header>

      <main style={{ flex: 1, maxWidth: 680, width: '100%', margin: '0 auto', padding: '14px 14px 0' }}>
        {tab === 'record' && <Record profile={profile} classId={classId} />}
        {tab === 'attend' && <Attendance profile={profile} classId={classId} />}
        {tab === 'board' && <Leaderboard classId={classId} />}
        {tab === 'tools' && <Tools profile={profile} classId={classId} />}
        {tab === 'home' && <Home profile={profile} onSignedOut={onSignedOut} />}
      </main>

      <nav style={{ position: 'sticky', bottom: 0, display: 'flex', borderTop: '1px solid var(--line)', background: 'var(--surface)', zIndex: 5 }}>
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            padding: '8px 0', background: 'transparent', border: 'none',
            color: tab === t ? 'var(--primary)' : 'var(--muted)', fontSize: 11, fontWeight: 500
          }}>
            <Icon id={t} active={tab === t} />
            {TAB_LABEL[t]}
          </button>
        ))}
      </nav>
    </div>
  )
}

function Home({ profile, onSignedOut }: { profile: Profile; onSignedOut: () => void }) {
  return (
    <div className="card" style={{ padding: 22 }}>
      <div style={{ fontSize: 20, fontWeight: 600 }}>Xin chào, {profile.full_name}</div>
      <div style={{ color: 'var(--muted)', marginTop: 4 }}>Chúc bạn một ngày dạy học vui.</div>
      <p style={{ color: 'var(--muted)', marginTop: 16, fontSize: 14, lineHeight: 1.6 }}>
        Vào tab <b>Tiện ích</b> để thêm học sinh, thêm tiêu chí hay duyệt điểm. Thu chi quỹ, thông báo,
        sơ đồ lớp sẽ được thêm ở các bản kế tiếp.
      </p>
      <button className="btn" style={{ marginTop: 16 }} onClick={async () => { await signOut(); onSignedOut() }}>Đăng xuất</button>
    </div>
  )
}

function Icon({ id, active }: { id: TabId; active: boolean }) {
  const s = { width: 22, height: 22, fill: 'none', stroke: active ? 'var(--primary)' : 'var(--muted)', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (id === 'record') return <svg viewBox="0 0 24 24" {...s}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
  if (id === 'attend') return <svg viewBox="0 0 24 24" {...s}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4M9 15l2 2 4-4" /></svg>
  if (id === 'board') return <svg viewBox="0 0 24 24" {...s}><path d="M4 20V10M10 20V4M16 20v-8M22 20H2" /></svg>
  if (id === 'tools') return <svg viewBox="0 0 24 24" {...s}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
  return <svg viewBox="0 0 24 24" {...s}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>
}
