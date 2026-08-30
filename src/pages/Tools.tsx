import { useState } from 'react'
import type { Profile } from '../lib/auth'
import Approvals from './Approvals'
import Settings from './Settings'
import GroupsRoles from './GroupsRoles'
import Fund from './Fund'
import Compose from './Compose'
import ParentLinks from './ParentLinks'
import SeatingChart from './SeatingChart'
import EarlyWarnings from './EarlyWarnings'
import NewYear from './NewYear'
import StudentManage from './StudentManage'

type Sub = 'hub' | 'approve' | 'settings' | 'groups' | 'fund' | 'announce' | 'newsletter' | 'parents' | 'seating' | 'warnings' | 'newyear' | 'manage'

export default function Tools({ profile, classId }: { profile: Profile; classId: string }) {
  const [sub, setSub] = useState<Sub>('hub')

  if (sub !== 'hub') {
    return (
      <div>
        <button className="btn" style={{ minHeight: 38, marginBottom: 12 }} onClick={() => setSub('hub')}>← Tiện ích</button>
        {sub === 'approve' && <Approvals profile={profile} classId={classId} />}
        {sub === 'settings' && <Settings classId={classId} />}
        {sub === 'groups' && <GroupsRoles classId={classId} />}
        {sub === 'fund' && <Fund profile={profile} classId={classId} canConfig />}
        {sub === 'announce' && <Compose classId={classId} mode="announcement" />}
        {sub === 'newsletter' && <Compose classId={classId} mode="newsletter" />}
        {sub === 'parents' && <ParentLinks classId={classId} />}
        {sub === 'seating' && <SeatingChart classId={classId} />}
        {sub === 'warnings' && <EarlyWarnings classId={classId} />}
        {sub === 'newyear' && <NewYear classId={classId} />}
        {sub === 'manage' && <StudentManage classId={classId} />}
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', paddingBottom: 20 }}>
      {TOOLS.map((t) => (
        <button key={t.sub} onClick={() => setSub(t.sub)} className="card" style={{
          textAlign: 'left', padding: 16, cursor: 'pointer',
          border: `1px solid color-mix(in srgb, ${t.color} 35%, var(--line))`,
          background: `color-mix(in srgb, ${t.color} 6%, #fff)`, display: 'flex', flexDirection: 'column', gap: 8
        }}>
          <span style={{ width: 38, height: 38, borderRadius: 10, background: `color-mix(in srgb, ${t.color} 16%, #fff)`, color: t.color, display: 'grid', placeItems: 'center' }}>
            <ToolIcon sub={t.sub} color={t.color} />
          </span>
          <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{t.title}</span>
          <span style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.4 }}>{t.desc}</span>
        </button>
      ))}
    </div>
  )
}

interface ToolDef { sub: Exclude<Sub, 'hub'>; title: string; desc: string; color: string }
const TOOLS: ToolDef[] = [
  { sub: 'approve', title: 'Chờ duyệt', desc: 'Duyệt khoản trừ nặng', color: '#b07d0a' },
  { sub: 'settings', title: 'Thiết lập lớp', desc: 'Thông tin lớp, thêm HS, tiêu chí', color: '#0d9488' },
  { sub: 'manage', title: 'Quản lý học sinh', desc: 'Sửa, đổi mật khẩu, cho thôi học', color: '#1f9e8a' },
  { sub: 'groups', title: 'Chia tổ & vai', desc: 'Gán tổ, tổ trưởng, thủ quỹ', color: '#5b6ee0' },
  { sub: 'fund', title: 'Thu chi quỹ', desc: 'Mức đóng, thu tuần, tổng kết', color: '#2f8f4e' },
  { sub: 'announce', title: 'Thông báo', desc: 'Gửi học sinh / phụ huynh', color: '#0f7f9e' },
  { sub: 'newsletter', title: 'Bản tin phụ huynh', desc: 'Soạn & gửi bản tin tuần', color: '#7a5cc9' },
  { sub: 'parents', title: 'Phụ huynh', desc: 'Link & QR theo dõi con', color: '#c05f7a' },
  { sub: 'seating', title: 'Sơ đồ lớp', desc: 'Xếp chỗ, khóa chỗ, xáo tổ', color: '#0ea5b7' },
  { sub: 'warnings', title: 'Cảnh báo sớm', desc: 'HS cần quan tâm', color: '#c26a5a' },
  { sub: 'newyear', title: 'Khởi tạo năm mới', desc: 'Nhân bản khung lớp', color: '#c98a1e' }
]

function ToolIcon({ sub, color }: { sub: string; color: string }) {
  const s = { width: 20, height: 20, fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (sub) {
    case 'approve': return <svg viewBox="0 0 24 24" {...s}><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" /></svg>
    case 'settings': return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2 2M16.4 16.4l2 2M18.4 5.6l-2 2M7.6 16.4l-2 2" /></svg>
    case 'manage': return <svg viewBox="0 0 24 24" {...s}><circle cx="9" cy="8" r="3" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 8h5M18.5 5.5v5" /></svg>
    case 'groups': return <svg viewBox="0 0 24 24" {...s}><circle cx="8" cy="9" r="2.4" /><circle cx="16" cy="9" r="2.4" /><path d="M3.5 19a4.5 4.5 0 0 1 9 0M11.5 19a4.5 4.5 0 0 1 9 0" /></svg>
    case 'fund': return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4" /></svg>
    case 'announce': return <svg viewBox="0 0 24 24" {...s}><path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1Z" /><path d="M16 9a4 4 0 0 1 0 6" /></svg>
    case 'newsletter': return <svg viewBox="0 0 24 24" {...s}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
    case 'parents': return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="8" r="3.2" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></svg>
    case 'seating': return <svg viewBox="0 0 24 24" {...s}><rect x="3" y="4" width="7" height="7" rx="1.5" /><rect x="14" y="4" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="6" rx="1.5" /><rect x="14" y="14" width="7" height="6" rx="1.5" /></svg>
    case 'warnings': return <svg viewBox="0 0 24 24" {...s}><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17v.5" /></svg>
    case 'newyear': return <svg viewBox="0 0 24 24" {...s}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 10h18M12 14v4M10 16h4" /></svg>
    default: return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="8" /></svg>
  }
}
