import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { errText } from '../lib/err'
import { getSeating, saveSeating, setSeatingMode, type SeatStudent } from '../lib/db'

const SEATS = 12                 // mỗi tổ 12 chỗ
const PALETTE = ['#0d9488', '#3b6fd6', '#c98a1e', '#7a5cc9']
type Mode = 'day' | 'zone'

interface Grp { id: string; name: string; color: string | null; position: number }

export default function SeatingChart({ classId }: { classId: string }) {
  const [groups, setGroups] = useState<Grp[]>([])
  const [byId, setById] = useState<Map<string, SeatStudent>>(new Map())
  const [layout, setLayout] = useState<Record<string, (string | null)[]>>({})
  const [locked, setLocked] = useState<Set<string>>(new Set())
  const [unseated, setUnseated] = useState<string[]>([])
  const [mode, setMode] = useState<Mode>('day')
  const [allowCross, setAllowCross] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 1800) }

  useEffect(() => {
    (async () => {
      try {
        const { data: cls } = await supabase.from('classes').select('seating_mode').eq('id', classId).maybeSingle()
        if (cls?.seating_mode === 'zone') setMode('zone')
        const { data: gs } = await supabase.from('groups').select('id, name, color, position').eq('class_id', classId).order('position')
        const grps = (gs ?? []) as Grp[]
        const sts = await getSeating(classId)
        const map = new Map(sts.map((s) => [s.id, s]))
        const lay: Record<string, (string | null)[]> = {}
        grps.forEach((g) => (lay[g.id] = Array(SEATS).fill(null)))
        const overflow: Record<string, string[]> = {}; const noGroup: string[] = []
        for (const s of sts) {
          if (!s.group_id || !lay[s.group_id]) { noGroup.push(s.id); continue }
          if (s.seat_index != null && s.seat_index >= 0 && s.seat_index < SEATS && !lay[s.group_id][s.seat_index]) lay[s.group_id][s.seat_index] = s.id
          else (overflow[s.group_id] ??= []).push(s.id)
        }
        const stillOut = [...noGroup]
        for (const g of grps) for (const sid of (overflow[g.id] ?? [])) {
          const free = lay[g.id].findIndex((x) => x === null)
          if (free >= 0) lay[g.id][free] = sid; else stillOut.push(sid)
        }
        setGroups(grps); setById(map); setLayout(lay)
        setLocked(new Set(sts.filter((s) => s.seat_locked).map((s) => s.id)))
        setUnseated(stillOut)
      } catch (e) { setErr(errText(e)) } finally { setLoading(false) }
    })()
  }, [classId])

  const isLocked = (id: string) => locked.has(id)
  function findPos(id: string): [string, number] | null {
    for (const g of groups) { const i = layout[g.id].indexOf(id); if (i >= 0) return [g.id, i] }
    return null
  }
  function tapSeat(gid: string, idx: number) {
    const occ = layout[gid][idx]
    if (!selected) { if (occ && !isLocked(occ)) setSelected(occ); return }
    if (occ === selected) { setSelected(null); return }
    const pos = findPos(selected); if (!pos) { setSelected(null); return }
    const [sgid, sidx] = pos
    if (isLocked(selected)) { setSelected(null); return }
    if (gid !== sgid && !allowCross) { flash('Bật "Đổi chỗ giữa các tổ" để chuyển tổ khác.'); return }
    if (occ && isLocked(occ)) { flash('Chỗ này đang khóa.'); return }
    const next = { ...layout, [sgid]: [...layout[sgid]], [gid]: [...layout[gid]] }
    next[sgid][sidx] = occ; next[gid][idx] = selected
    setLayout(next); setDirty(true); setSelected(null)
  }
  function toggleLock() {
    if (!selected) return
    setLocked((p) => { const n = new Set(p); n.has(selected) ? n.delete(selected) : n.add(selected); return n }); setDirty(true)
  }
  function shuffle() {
    const next: Record<string, (string | null)[]> = {}
    for (const g of groups) {
      const slots = [...layout[g.id]]
      const freeIdx = slots.map((x, i) => (x && isLocked(x)) ? -1 : i).filter((i) => i >= 0)
      const movable = freeIdx.map((i) => slots[i]).filter(Boolean) as string[]
      for (let i = movable.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[movable[i], movable[j]] = [movable[j], movable[i]] }
      freeIdx.forEach((i) => (slots[i] = null)); movable.forEach((sid, k) => (slots[freeIdx[k]] = sid))
      next[g.id] = slots
    }
    setLayout(next); setDirty(true); setSelected(null)
  }
  function switchMode(m: Mode) { if (m !== mode) { setMode(m); setDirty(true); setSelected(null) } }
  async function save() {
    setBusy(true); setErr(null)
    try {
      const rows: { id: string; group_id: string | null; seat_index: number | null; seat_locked: boolean }[] = []
      for (const g of groups) layout[g.id].forEach((sid, idx) => { if (sid) rows.push({ id: sid, group_id: g.id, seat_index: idx, seat_locked: isLocked(sid) }) })
      await saveSeating(rows); await setSeatingMode(classId, mode)
      setDirty(false); flash('Đã chốt sơ đồ.')
    } catch (e) { setErr(errText(e)) } finally { setBusy(false) }
  }

  const colorOf = (i: number) => groups[i]?.color || PALETTE[i % PALETTE.length]
  const selName = selected ? byId.get(selected)?.full_name : null

  if (loading) return <Center>Đang tải…</Center>
  if (err) return <div style={box('var(--neg)')}>{err}</div>
  if (groups.length === 0) return <Center>Lớp chưa có tổ. Vào Chia tổ &amp; vai trước.</Center>

  // Chip cho một chỗ
  const seat = (gid: string, gi: number, idx: number) => {
    const sid = layout[gid][idx]; const st = sid ? byId.get(sid) : null
    const sel = sid && sid === selected; const lock = sid ? isLocked(sid) : false; const col = colorOf(gi)
    return (
      <button key={idx} onClick={() => tapSeat(gid, idx)} style={{
        width: 78, minHeight: 44, borderRadius: 7, fontSize: 11.5, fontWeight: 500, padding: '4px 5px',
        border: `1.5px solid ${sel ? 'var(--primary)' : sid ? col : 'var(--line)'}`,
        background: sel ? 'color-mix(in srgb, var(--primary) 16%, #fff)' : sid ? `color-mix(in srgb, ${col} 9%, #fff)` : 'var(--surface)',
        color: sid ? 'var(--ink)' : 'var(--muted)', lineHeight: 1.15, textAlign: 'center', cursor: 'pointer'
      }}>{st ? <>{lock && '🔒 '}{shortName(st.full_name)}</> : '·'}</button>
    )
  }
  const desk = (gid: string, gi: number, a: number, b: number) => (
    <div key={a} style={{ display: 'flex', gap: 3, background: 'color-mix(in srgb, var(--line) 40%, #fff)', padding: 3, borderRadius: 7 }}>
      {seat(gid, gi, a)}{seat(gid, gi, b)}
    </div>
  )
  const blockHeader = (gi: number) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, justifyContent: 'center' }}>
      <span style={{ width: 9, height: 9, borderRadius: 999, background: colorOf(gi) }} />
      <span style={{ fontWeight: 600, fontSize: 13 }}>{groups[gi].name}</span>
    </div>
  )
  // Khối 1 tổ theo dãy: 6 hàng × 1 bàn
  const dayBlock = (gi: number) => {
    const g = groups[gi]
    return (
      <div key={g.id} style={{ border: `1.5px solid color-mix(in srgb, ${colorOf(gi)} 45%, var(--line))`, borderRadius: 10, padding: 8 }}>
        {blockHeader(gi)}
        <div style={{ display: 'grid', gap: 6 }}>
          {Array.from({ length: 6 }).map((_, r) => desk(g.id, gi, r * 2, r * 2 + 1))}
        </div>
      </div>
    )
  }
  // Khối 1 tổ theo khu vực: 3 hàng × 2 bàn
  const zoneBlock = (gi: number) => {
    const g = groups[gi]
    return (
      <div key={g.id} style={{ border: `1.5px solid color-mix(in srgb, ${colorOf(gi)} 45%, var(--line))`, borderRadius: 10, padding: 8 }}>
        {blockHeader(gi)}
        <div style={{ display: 'grid', gap: 6 }}>
          {Array.from({ length: 3 }).map((_, r) => (
            <div key={r} style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              {desk(g.id, gi, r * 4 + 0, r * 4 + 1)}{desk(g.id, gi, r * 4 + 2, r * 4 + 3)}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: selected ? 76 : 20 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <button className="btn" onClick={shuffle}>Xáo ngẫu nhiên</button>
        <button className="btn" style={{ borderColor: allowCross ? 'var(--primary)' : 'var(--line)', color: allowCross ? 'var(--primary)' : 'var(--ink)' }} onClick={() => setAllowCross((v) => !v)}>
          Đổi chỗ giữa các tổ: {allowCross ? 'BẬT' : 'TẮT'}
        </button>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} disabled={!dirty || busy} onClick={save}>{busy ? 'Đang lưu…' : 'Chốt sơ đồ'}</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, color: 'var(--muted)', alignSelf: 'center' }}>Cách chia:</span>
        <Seg active={mode === 'day'} onClick={() => switchMode('day')}>Theo dãy</Seg>
        <Seg active={mode === 'zone'} onClick={() => switchMode('zone')}>Theo khu vực</Seg>
      </div>
      {msg && <div style={box('var(--primary)')}>{msg}</div>}
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 12px', lineHeight: 1.5 }}>
        Chạm một HS rồi chạm chỗ muốn chuyển tới. Chỗ 🔒 là đã khóa cố định (chọn HS → nút Khóa chỗ).
      </p>

      <div style={{ textAlign: 'center', fontWeight: 700, letterSpacing: 2, color: 'var(--muted)', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 0', marginBottom: 14, background: 'var(--surface)' }}>BẢNG</div>

      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        {mode === 'day' ? (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', minWidth: 'max-content' }}>
            {groups.map((_, gi) => dayBlock(gi))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, minWidth: 'max-content', justifyContent: 'center' }}>
            {groups.map((_, gi) => zoneBlock(gi))}
          </div>
        )}
      </div>

      {unseated.length > 0 && (
        <div style={{ marginTop: 14, fontSize: 13, color: 'var(--warn)' }}>
          Chưa xếp chỗ ({unseated.length}): {unseated.map((id) => byId.get(id)?.full_name).join(', ')}. Hãy gán tổ ở "Chia tổ &amp; vai".
        </div>
      )}

      {selected && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 60, display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px', background: 'var(--ink)', color: '#fff', zIndex: 30 }}>
          <span style={{ flex: 1, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Đang chọn: <b>{selName}</b></span>
          <button className="btn" style={{ minHeight: 36 }} onClick={toggleLock}>{selected && isLocked(selected) ? 'Mở khóa' : 'Khóa chỗ'}</button>
          <button className="btn" style={{ minHeight: 36 }} onClick={() => setSelected(null)}>Bỏ chọn</button>
        </div>
      )}
    </div>
  )
}

function Seg({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} style={{ minHeight: 36, padding: '0 14px', borderRadius: 999, fontSize: 14, fontWeight: 500, border: `1px solid ${active ? 'var(--primary)' : 'var(--line)'}`, background: active ? 'var(--primary)' : 'var(--surface)', color: active ? '#fff' : 'var(--ink)' }}>{children}</button>
}
function shortName(full: string) { const p = full.trim().split(/\s+/); return p.length <= 2 ? full : p[0][0] + '. ' + p.slice(-2).join(' ') }
function Center({ children }: { children: React.ReactNode }) { return <div style={{ display: 'grid', placeItems: 'center', minHeight: 160, color: 'var(--muted)', textAlign: 'center', padding: 20 }}>{children}</div> }
const box = (c: string): React.CSSProperties => ({ padding: '10px 12px', borderRadius: 10, background: `color-mix(in srgb, ${c} 12%, #fff)`, color: c, fontSize: 14, marginBottom: 10 })
