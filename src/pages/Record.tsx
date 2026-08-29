import { useEffect, useMemo, useRef, useState } from 'react'
import type { Profile } from '../lib/auth'
import { addRecord, getCriteria, getGroups, getStudents, getStudentTotals, type Criterion, type Group, type Student } from '../lib/db'
import { errText } from '../lib/err'

interface Pending {
  key: string; studentId: string; label: string; delta: number; requiresApproval: boolean
}

export default function Record({ profile, classId }: { profile: Profile; classId: string }) {
  const [students, setStudents] = useState<Student[]>([])
  const [criteria, setCriteria] = useState<Criterion[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [totals, setTotals] = useState<Map<string, number>>(new Map())
  const [openId, setOpenId] = useState<string | null>(null)
  const [groupFilter, setGroupFilter] = useState<string>('all')
  const [pending, setPending] = useState<Pending[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    (async () => {
      try {
        const [st, cr, gr, to] = await Promise.all([
          getStudents(classId), getCriteria(classId), getGroups(classId), getStudentTotals(classId)
        ])
        setStudents(st); setCriteria(cr); setGroups(gr); setTotals(to)
      } catch (e) { setErr(errText(e)) } finally { setLoading(false) }
    })()
    return () => { Object.values(timers.current).forEach(clearTimeout) }
  }, [classId])

  const cong = useMemo(() => criteria.filter((c) => c.kind === 'cong'), [criteria])
  const tru = useMemo(() => criteria.filter((c) => c.kind === 'tru'), [criteria])
  const shown = useMemo(
    () => groupFilter === 'all' ? students : students.filter((s) => s.group_id === groupFilter),
    [students, groupFilter]
  )

  function bump(id: string, d: number) {
    setTotals((prev) => { const m = new Map(prev); m.set(id, (m.get(id) ?? 0) + d); return m })
  }

  function tap(s: Student, c: Criterion) {
    const key = crypto.randomUUID()
    const delta = c.requires_approval ? 0 : c.points
    bump(s.id, delta) // cập nhật tổng ngay (nếu cần duyệt thì không đổi tổng)
    const p: Pending = {
      key, studentId: s.id, delta, requiresApproval: c.requires_approval,
      label: `${s.full_name}: ${c.name} ${c.points > 0 ? '+' + c.points : c.points}`
    }
    setPending((prev) => [...prev, p])
    timers.current[key] = setTimeout(() => commit(p, c, s), 5000)
  }

  async function commit(p: Pending, c: Criterion, s: Student) {
    delete timers.current[p.key]
    setPending((prev) => prev.filter((x) => x.key !== p.key))
    try {
      await addRecord({ classId, studentId: s.id, criterionId: c.id, points: c.points, recordedBy: profile.id })
    } catch (e) {
      bump(s.id, -p.delta) // hoàn lại nếu ghi lỗi
      setErr('Ghi nhận lỗi: ' + (errText(e)))
    }
  }

  function undo(p: Pending) {
    clearTimeout(timers.current[p.key]); delete timers.current[p.key]
    bump(p.studentId, -p.delta)
    setPending((prev) => prev.filter((x) => x.key !== p.key))
  }

  if (loading) return <Center>Đang tải…</Center>
  if (err) return <div style={errBox}>{err}</div>
  if (students.length === 0) return <Center>Lớp chưa có học sinh. Hãy thiết lập lớp trước.</Center>
  if (criteria.length === 0) return <Center>Lớp chưa có tiêu chí. Thêm tiêu chí trong thiết lập lớp.</Center>

  return (
    <div style={{ paddingBottom: pending.length ? 90 : 20 }}>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 0 12px' }}>
        <Chip active={groupFilter === 'all'} onClick={() => setGroupFilter('all')}>Tất cả</Chip>
        {groups.map((g) => <Chip key={g.id} active={groupFilter === g.id} onClick={() => setGroupFilter(g.id)}>{g.name}</Chip>)}
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {shown.map((s) => {
          const total = totals.get(s.id) ?? 0
          const open = openId === s.id
          return (
            <div key={s.id} className="card" style={{ overflow: 'hidden' }}>
              <button onClick={() => setOpenId(open ? null : s.id)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px', background: 'transparent', border: 'none', textAlign: 'left' }}>
                <span style={{ fontWeight: 500, fontSize: 16 }}>{s.full_name}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <b style={{ fontSize: 16, color: total > 0 ? 'var(--pos)' : total < 0 ? 'var(--neg)' : 'var(--muted)' }}>{total}</b>
                  <span style={{ color: 'var(--muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
                </span>
              </button>

              {open && (
                <div style={{ padding: '0 12px 14px' }}>
                  <Section title="Cộng" color="var(--pos)">
                    {cong.map((c) => <CritBtn key={c.id} c={c} tone="pos" onClick={() => tap(s, c)} />)}
                  </Section>
                  {tru.length > 0 && (
                    <Section title="Trừ" color="var(--neg)">
                      {tru.map((c) => <CritBtn key={c.id} c={c} tone="neg" onClick={() => tap(s, c)} />)}
                    </Section>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Hàng chờ Hoàn tác 5 giây */}
      {pending.length > 0 && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 68, display: 'grid', gap: 6, padding: '0 12px', pointerEvents: 'none' }}>
          {pending.slice(-3).map((p) => (
            <div key={p.key} style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, background: 'var(--ink)', color: '#fff', borderRadius: 12, padding: '10px 14px', boxShadow: 'var(--shadow)' }}>
              <span style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.requiresApproval ? '⏳ Gửi GVCN duyệt — ' : '✓ '}{p.label}
              </span>
              <button onClick={() => undo(p)} style={{ background: 'transparent', border: 'none', color: '#5eead4', fontWeight: 600, fontSize: 14 }}>Hoàn tác</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{children}</div>
    </div>
  )
}

function CritBtn({ c, tone, onClick }: { c: Criterion; tone: 'pos' | 'neg'; onClick: () => void }) {
  const col = tone === 'pos' ? 'var(--pos)' : 'var(--neg)'
  return (
    <button onClick={onClick} style={{
      minHeight: 40, padding: '0 14px', borderRadius: 999, fontSize: 14, fontWeight: 500,
      border: `1px solid ${col}`, color: col,
      background: `color-mix(in srgb, ${col} 10%, #fff)`
    }}>
      {c.name} <b>{c.points > 0 ? '+' + c.points : c.points}</b>
    </button>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      whiteSpace: 'nowrap', minHeight: 36, padding: '0 14px', borderRadius: 999, fontSize: 14, fontWeight: 500,
      border: `1px solid ${active ? 'var(--primary)' : 'var(--line)'}`,
      background: active ? 'var(--primary)' : 'var(--surface)', color: active ? '#fff' : 'var(--ink)'
    }}>{children}</button>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', placeItems: 'center', minHeight: 240, color: 'var(--muted)', textAlign: 'center', padding: 20 }}>{children}</div>
}
const errBox: React.CSSProperties = { padding: '10px 12px', borderRadius: 10, background: 'color-mix(in srgb, var(--neg) 12%, #fff)', color: 'var(--neg)', fontSize: 14, margin: 12 }
