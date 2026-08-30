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

type Sub = 'hub' | 'approve' | 'settings' | 'groups' | 'fund' | 'announce' | 'newsletter' | 'parents' | 'seating' | 'warnings' | 'newyear'

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
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 10, paddingBottom: 20 }}>
      <HubCard title="Chờ duyệt" desc="Duyệt các khoản trừ nặng do tổ trưởng nhập" onClick={() => setSub('approve')} />
      <HubCard title="Thiết lập lớp" desc="Thông tin lớp, thêm học sinh, thêm tiêu chí" onClick={() => setSub('settings')} />
      <HubCard title="Chia tổ & vai" desc="Gán tổ, chọn tổ trưởng và thủ quỹ" onClick={() => setSub('groups')} />
      <HubCard title="Thu chi quỹ" desc="Đặt mức đóng, thu theo tuần, sổ & tổng kết" onClick={() => setSub('fund')} />
      <HubCard title="Thông báo" desc="Gửi thông báo cho học sinh / phụ huynh" onClick={() => setSub('announce')} />
      <HubCard title="Bản tin phụ huynh" desc="Soạn & gửi bản tin tuần" onClick={() => setSub('newsletter')} />
      <HubCard title="Phụ huynh" desc="Tạo & phát link theo dõi cho phụ huynh" onClick={() => setSub('parents')} />
      <HubCard title="Sơ đồ lớp" desc="Xếp chỗ ngồi: chạm đổi chỗ, khóa chỗ, xáo tổ" onClick={() => setSub('seating')} />
      <HubCard title="Cảnh báo sớm" desc="HS cần quan tâm (muộn nhiều, điểm giảm)" onClick={() => setSub('warnings')} />
      <HubCard title="Khởi tạo năm mới" desc="Nhân bản khung lớp sang năm học mới" onClick={() => setSub('newyear')} />
    </div>
  )
}

function HubCard({ title, desc, onClick, soon }: { title: string; desc: string; onClick?: () => void; soon?: boolean }) {
  return (
    <button onClick={soon ? undefined : onClick} disabled={soon} className="card" style={{
      textAlign: 'left', padding: '16px 18px', border: '1px solid var(--line)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      opacity: soon ? .6 : 1, cursor: soon ? 'default' : 'pointer', background: 'var(--surface)'
    }}>
      <span>
        <span style={{ fontWeight: 600, fontSize: 16 }}>{title}</span>
        <span style={{ display: 'block', color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>{desc}</span>
      </span>
      <span style={{ color: 'var(--muted)', fontSize: 13, whiteSpace: 'nowrap' }}>{soon ? 'Sắp có' : '›'}</span>
    </button>
  )
}