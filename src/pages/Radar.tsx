import { AXES } from '../lib/axes'

// values: điểm 0..100 theo từng mặt (key).
export default function Radar({ values, size = 260 }: { values: Record<string, number>; size?: number }) {
  const cx = size / 2, cy = size / 2
  const R = size / 2 - 34
  const n = AXES.length
  const angle = (i: number) => (-90 + i * (360 / n)) * Math.PI / 180
  const pt = (i: number, r: number) => [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))]

  const rings = [0.25, 0.5, 0.75, 1]
  const ringPoly = (f: number) => AXES.map((_, i) => pt(i, R * f).join(',')).join(' ')
  const dataPoly = AXES.map((a, i) => pt(i, R * Math.max(0, Math.min(100, values[a.key] ?? 0)) / 100).join(',')).join(' ')

  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', maxWidth: size, display: 'block', margin: '0 auto' }}>
      {rings.map((f, k) => <polygon key={k} points={ringPoly(f)} fill="none" stroke="var(--line)" strokeWidth={1} />)}
      {AXES.map((_, i) => { const [x, y] = pt(i, R); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line)" strokeWidth={1} /> })}
      <polygon points={dataPoly} fill="color-mix(in srgb, var(--primary) 22%, transparent)" stroke="var(--primary)" strokeWidth={2} />
      {AXES.map((a, i) => {
        const [x, y] = pt(i, R + 18)
        return <text key={a.key} x={x} y={y} fontSize={12} fontWeight={600} fill="var(--muted)"
          textAnchor={x < cx - 4 ? 'end' : x > cx + 4 ? 'start' : 'middle'}
          dominantBaseline={y < cy ? 'auto' : 'hanging'}>{a.label}</text>
      })}
    </svg>
  )
}
