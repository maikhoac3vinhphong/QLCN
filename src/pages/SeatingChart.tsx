import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { errText } from '../lib/err'
import { getSeating, saveSeating, type SeatStudent } from '../lib/db'

const DESKS = 6, PER_DESK = 2, SEATS = DESKS * PER_DESK // 12 chỗ / dãy
const PALETTE = ['#0d9488', '#3b6fd6', '#c98a1e', '#7a5cc9']

interface Grp { id: string; name: string; color: string | null; position: number }

export default function SeatingChart({ classId }: { classId: string }) {
  const [groups, setGroups] = useState<Grp[]>([])
  const [byId, setById] = useState<Map<string, SeatStudent>>(new Map())
  const [layout, setLayout] = useState<Record<string, (string | null)[]>>({})
  const [locked, setLocked] = useState<Set<string>>(new Set())
  const [unseated, setUnseated] = useState<string[]>([])
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
        const { data: gs } = await supabase.from('groups').select('id, name, color, position').eq('class_id', classId).order('position')
        const grps = (gs ?? []) as Grp[]
        const sts = await getSeating(classId)
        const map = new Map(sts.map((s) => [s.id, s]))
        const lay: Record<string, (string | null)[]> = {}
        grps.forEach((g) => (lay[g.id] = Array(SEATS).fill(null)))
        const overflow: Record<string, string[]> = {}
        const noGroup: string[] = []
        // đặt theo seat_index nếu hợp lệ
        for (const s of sts) {
          if (!s.group_id || !lay[s.group_id]) { noGroup.push(s.id); continue }
          if (s.seat_index != null && s.seat_index >= 0 && s.seat_index < SEATS && !lay[s.group_id][s.seat_index]) {
            lay[s.group_id][s.seat_index] = s.id
          } else { (overflow[s.group_id] ??= []).push(s.id) }
        }
        // lấp phần còn lại vào chỗ trống của tổ
        const stillOut: string[] = [...noGroup]
        for (const g of grps) {
          for (const sid of (overflow[g.id] ?? [])) {
            const free = lay[g.id].findIndex((x) => x === null)
            if (free >= 0) lay[g.id][free] = sid; else stillOut.push(sid)
          }
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
    if (gid !== sgid && !allowCross) { flash('Bật "Đổi chỗ giữa các tổ" để chuyển sang tổ khác.'); return }
    if (occ && isLocked(occ)) { flash('Chỗ này đang khóa.'); return }
    const next = { ...layout, [sgid]: [...layout[sgid]], [gid]: [...layout[gid]] }
    next[sgid][sidx] = occ // đổi chỗ (occ có thể null)
    next[gid][idx] = selected
    setLayout(next); setDirty(true); setSelected(null)
  }

  function toggleLock() {
    if (!selected) return
    setLocked((p) => { const n = new Set(p); n.has(selected) ? n.delete(selected) : n.add(selected); return n })
    setDirty(true)
  }

  function shuffle() {
    const next: Record<string, (string | null)[]> = {}
    for (const g of groups) {
      const slots = [...layout[g.id]]
      const freeIdx = slots.map((s, i) => (s && isLocked(s)) ? -1 : i).filter((i) => i >= 0)
      const movable = freeIdx.map((i) => slots[i]).filter(Boolean) as string[]
      for (let i = movable.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[movable[i], movable[j]] = [movable[j], movable[i]] }
      freeIdx.forEach((i) => (slots[i] = null))
      movable.forEach((sid, k) => (slots[freeIdx[k]] = sid))
      next[g.id] = slots
    }
    setLayout(next); setDirty(true); setSelected(null)
  }

  async function save() {
    setBusy(true); setErr(null)
    try {
      const rows: { id: string; group_id: string | null; seat_index: number | null; seat_locked: boolean }[] = []
      for (const g of groups) layout[g.id].forEach((sid, idx) => { if (sid) rows.push({ id: sid, group_id: g.id, seat_index: idx, seat_locked: isLocked(sid) }) })
      await saveSeating(rows)
      setDirty(false); flash('Đã chốt sơ đồ.')
    } catch (e) { setErr(errText(e)) } finally { setBusy(false) }
  }

  const colorOf = (g: Grp, i: number) => g.color || PALETTE[i % PALETTE.length]
  const selName = selected ? byId.get(selected)?.full_name : null

  if (loading) return <Center>Đang tải…</Center>
  if (err) return <div style={box('var(--neg)')}>{err}</div>
  if (groups.length === 0) return <Center>Lớp chưa có tổ. Vào Chia tổ &amp; vai trước.</Center>

  return (
    <div style={{ paddingBottom: selected ? 76 : 20 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <button className="btn" onClick={shuffle}>Xáo ngẫu nhiên</button>
        <button className="btn" style={{ borderColor: allowCross ? 'var(--primary)' : 'var(--line)', color: allowCross ? 'var(--primary)' : 'var(--ink)' }} onClick={() => setAllowCross((v) => !v)}>
          Đổi chỗ giữa các tổ: {allowCross ? 'BẬT' : 'TẮT'}
        </button>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} disabled={!dirty || busy} onClick={save}>{busy ? 'Đang lưu…' : 'Chốt sơ đồ'}</button>
      </div>
      {msg && <div style={box('var(--primary)')}>{msg}</div>}
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 12px', lineHeight: 1.5 }}>
        Chạm một học sinh rồi chạm chỗ muốn chuyển tới (chỗ trống hoặc để đổi với bạn khác). Chỗ có 🔒 là đã khóa cố định.
      </p>

      <div style={{ textAlign: 'center', fontWeight: 700, letterSpacing: 2, color: 'var(--muted)', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 0', marginBottom: 14, background: 'var(--surface)' }}>BẢNG</div>

      <div style={{ display: 'grid', gap: 14 }}>
        {groups.map((g, gi) => {
          const col = colorOf(g, gi)
          return (
            <div key={g.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: col }} />
                <span style={{ fontWeight: 600, fontSize: 14 }}>{g.name}</span>
              </div>
              <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
                <div style={{ display: 'flex', gap: 12, minWidth: 'max-content' }}>
                  {Array.from({ length: DESKS }).map((_, d) => (
                    <div key={d} style={{ display: 'flex', gap: 4, background: 'color-mix(in srgb, var(--line) 40%, #fff)', padding: 4, borderRadius: 8 }}>
                      {Array.from({ length: PER_DESK }).map((_, k) => {
                        const idx = d * PER_DESK + k
                        const sid = layout[g.id][idx]
                        const st = sid ? byId.get(sid) : null
                        const sel = sid && sid === selected
                        const lock = sid ? isLocked(sid) : false
                        return (
                          <button key={idx} onClick={() => tapSeat(g.id, idx)} style={{
                            width: 82, minHeight: 46, borderRadius: 7, fontSize: 12, fontWeight: 500, padding: '4px 6px',
                            border: `1.5px solid ${sel ? 'var(--primary)' : sid ? col : 'var(--line)'}`,
                            background: sel ? 'color-mix(in srgb, var(--primary) 16%, #fff)' : sid ? `color-mix(in srgb, ${col} 8%, #fff)` : 'var(--surface)',
                            color: sid ? 'var(--ink)' : 'var(--muted)', lineHeight: 1.2, textAlign: 'center', cursor: 'pointer'
                          }}>
                            {st ? <>{lock && '🔒 '}{shortName(st.full_name)}</> : '·'}
                          </button>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {unseated.length > 0 && (
        <div style={{ marginTop: 14, fontSize: 13, color: 'var(--warn)' }}>
          Chưa xếp chỗ ({unseated.length}): {unseated.map((id) => byId.get(id)?.full_name).join(', ')}. Hãy gán tổ ở "Chia tổ &amp; vai".
        </div>
      )}

      {selected && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 60, display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px', background: 'var(--ink)', color: '#fff' }}>
          <span style={{ flex: 1, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Đang chọn: <b>{selName}</b></span>
          <button className="btn" style={{ minHeight: 36 }} onClick={toggleLock}>{selected && isLocked(selected) ? 'Mở khóa' : 'Khóa chỗ'}</button>
          <button className="btn" style={{ minHeight: 36 }} onClick={() => setSelected(null)}>Bỏ chọn</button>
        </div>
      )}
    </div>
  )
}

function shortName(full: string) { const p = full.trim().split(/\s+/); return p.length <= 2 ? full : p[0][0] + '. ' + p.slice(-2).join(' ') }
function Center({ children }: { children: React.ReactNode }) { return <div style={{ display: 'grid', placeItems: 'center', minHeight: 160, color: 'var(--muted)', textAlign: 'center', padding: 20 }}>{children}</div> }
const box = (c: string): React.CSSProperties => ({ padding: '10px 12px', borderRadius: 10, background: `color-mix(in srgb, ${c} 12%, #fff)`, color: c, fontSize: 14, marginBottom: 10 })
