// 5 mặt đánh giá cho biểu đồ radar trang học sinh.
export const AXES = [
  { key: 'hoc_tap', label: 'Học tập' },
  { key: 'chuyen_can', label: 'Chuyên cần' },
  { key: 'ky_luat', label: 'Kỷ luật' },
  { key: 'tich_cuc', label: 'Tích cực' },
  { key: 'hop_tac', label: 'Hợp tác' }
] as const

export type AxisKey = typeof AXES[number]['key']
export const AXIS_LABEL: Record<string, string> = Object.fromEntries(AXES.map((a) => [a.key, a.label]))
