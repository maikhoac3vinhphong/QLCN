import type { Profile } from '../lib/auth'
import { signOut } from '../lib/auth'
import NetBadge from '../lib/NetBadge'

const ROLE_LABEL: Record<Profile['role'], string> = {
  gvcn: 'Giáo viên chủ nhiệm',
  totruong: 'Tổ trưởng',
  hs: 'Học sinh',
  phhs: 'Phụ huynh'
}

// Stub tạm: xác nhận đăng nhập + phân vai chạy đúng. UI thật sẽ thay từ Ngày 2.
export default function RoleHome({ profile, onSignedOut }: { profile: Profile; onSignedOut: () => void }) {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--primary)' }}>QLCN</div>
        <NetBadge />
      </div>

      <div className="card" style={{ padding: 22 }}>
        <div style={{ fontSize: 22, fontWeight: 600 }}>Xin chào, {profile.full_name}</div>
        <div style={{ color: 'var(--muted)', marginTop: 4 }}>
          Vai trò: <strong style={{ color: 'var(--ink)' }}>{ROLE_LABEL[profile.role]}</strong>
        </div>
        <p style={{ color: 'var(--muted)', marginTop: 16, lineHeight: 1.6 }}>
          Đăng nhập &amp; phân vai đã chạy. Các màn hình theo vai (Ghi nhận, Thi đua, Điểm danh, Tiện ích…)
          sẽ được thêm vào từ Ngày 2.
        </p>
        <button className="btn" style={{ marginTop: 18 }} onClick={async () => { await signOut(); onSignedOut() }}>
          Đăng xuất
        </button>
      </div>
    </div>
  )
}
