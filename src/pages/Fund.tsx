import { useEffect, useMemo, useState } from 'react'
import type { Profile } from '../lib/auth'
import { errText } from '../lib/err'
import {
  getStudents, getFundConfig, setFundConfig, getWeekPaid, recordThu, recordChi,
  getTransactions, deleteTransaction, fundSummary, isoWeek, type Student, type FundTx
} from '../lib/db'

const fmt = (n: number) => (n ?? 0).toLocaleString('vi-VN') + ' đ'
type Tab = 'thu' | 'chi' | 'so'

export default function Fund({ profile, classId, canConfig }: { profile: Profile; classId: string; canConfig: boolean }) {
  const [tab, setTab] = useState<Tab>('thu')
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const notify = (m: string) => { setOk(m); setErr(null); setTimeout(() => setOk(null), 2500) }
  const fail = (e: unknown) => { setErr(errText(e)); setOk(null) }

  return (
    <div style={{ display: 'grid', gap: 14, paddingBottom: 20 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <TabBtn active={tab === 'thu'} onClick={() => setTab('thu')}>Thu tuần</TabBtn>
        <TabBtn active={tab === 'chi'} onClick={() => setTab('chi')}>Chi</TabBtn>
        <TabBtn active={tab === 'so'} onClick={() => setTab('so')}>Sổ &amp; tổng kết</TabBtn>
      </div>
      {err && <div style={box('var(--neg)')}>{err}</div>}
      {ok && <div style={box('var(--pos)')}>{ok}</div>}
      {tab === 'thu' && <ThuTuan profile={profile} classId={classId} canConfig={canConfig} onOk={notify} onErr={fail} />}
      {tab === 'chi' && <Chi profile={profile} classId={classId} onOk={notify} onErr={fail} />}
      {tab === 'so' && <SoTongKet classId={classId} onErr={fail} />}
    </div>
  )
}

function ThuTuan({ profile, classId, canConfig, onOk, onErr }: { profile: Profile; classId: string; canConfig: boolean; onOk: (m: string) => void; onErr: (e: unknown) => void }) {
  const [week, setWeek] = useState(isoWeek())
  const [students, setStudents] = useState<Student[]>([])
  const [paid, setPaid] = useState<Set<string>>(new Set())
  const [weekly, setWeekly] = useState<number>(0)
  const [editAmt, setEditAmt] = useState<string>('')
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const [st, p, cfg] = await Promise.all([getStudents(classId), getWeekPaid(classId, week), getFundConfig(classId)])
      setStudents(st); setPaid(p); setWeekly(cfg?.weekly_amount ?? 0); setEditAmt(String(cfg?.weekly_amount ?? ''))
    } catch (e) { onErr(e) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [classId, week])

  async function saveAmount() {
    const v = parseInt(editAmt, 10)
    if (Number.isNaN(v) || v < 0) { onErr('Số tiền không hợp lệ.'); return }
    try { await setFundConfig(classId, v, null); setWeekly(v); onOk('Đã đặt mức đóng/tuần.') } catch (e) { onErr(e) }
  }
  async function togglePaid(s: Student) {
    if (paid.has(s.id)) return // đã đóng — sửa nhầm thì xoá ở tab Sổ
    if (weekly <= 0) { onErr('Hãy đặt mức đóng/tuần trước.'); return }
    try {
      await recordThu({ classId, studentId: s.id, amount: weekly, week, note: null, recordedBy: profile.id })
      setPaid((p) => new Set(p).add(s.id)); onOk(`Đã thu ${s.full_name}`)
    } catch (e) { onErr(e) }
  }

  const collected = paid.size
  if (loading) return <Center>Đang tải…</Center>

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ padding: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label className="label" style={{ marginBottom: 2 }}>Tuần</label>
          <input className="input" style={{ maxWidth: 130 }} value={week} onChange={(e) => setWeek(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="label" style={{ marginBottom: 2 }}>Mức đóng/tuần</label>
          {canConfig ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <input className="input" type="number" inputMode="numeric" value={editAmt} onChange={(e) => setEditAmt(e.target.value)} placeholder="VD 5000" />
              <button className="btn" onClick={saveAmount}>Lưu</button>
            </div>
          ) : <div style={{ padding: '10px 0', fontWeight: 600 }}>{fmt(weekly)}</div>}
        </div>
      </div>

      <div style={{ fontSize: 14, color: 'var(--muted)' }}>Đã thu <b style={{ color: 'var(--pos)' }}>{collected}</b>/{students.length} · thu về {fmt(collected * weekly)}</div>

      <div style={{ display: 'grid', gap: 8 }}>
        {students.map((s) => {
          const isPaid = paid.has(s.id)
          return (
            <button key={s.id} onClick={() => togglePaid(s)} disabled={isPaid} className="card" style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px',
              textAlign: 'left', cursor: isPaid ? 'default' : 'pointer',
              border: `1px solid ${isPaid ? 'var(--pos)' : 'var(--line)'}`,
              background: isPaid ? 'color-mix(in srgb, var(--pos) 8%, #fff)' : 'var(--surface)'
            }}>
              <span style={{ fontWeight: 500 }}>{s.full_name}</span>
              <span style={{ fontWeight: 600, color: isPaid ? 'var(--pos)' : 'var(--muted)' }}>{isPaid ? '✓ Đã đóng' : 'Thu'}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Chi({ profile, classId, onOk, onErr }: { profile: Profile; classId: string; onOk: (m: string) => void; onErr: (e: unknown) => void }) {
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    const v = parseInt(amount, 10)
    if (Number.isNaN(v) || v <= 0) { onErr('Số tiền không hợp lệ.'); return }
    if (!category.trim()) { onErr('Nhập nội dung chi.'); return }
    setBusy(true)
    try {
      await recordChi({ classId, amount: v, category: category.trim(), note: note.trim() || null, recordedBy: profile.id })
      setAmount(''); setCategory(''); setNote(''); onOk('Đã ghi khoản chi.')
    } catch (e) { onErr(e) } finally { setBusy(false) }
  }

  return (
    <div className="card" style={{ padding: 18, display: 'grid', gap: 12 }}>
      <div><label className="label">Số tiền</label><input className="input" type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="VD 50000" /></div>
      <div><label className="label">Nội dung chi</label><input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="VD: mua nước, in ấn…" /></div>
      <div><label className="label">Ghi chú (tuỳ chọn)</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
      <button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? 'Đang ghi…' : 'Ghi khoản chi'}</button>
    </div>
  )
}

function SoTongKet({ classId, onErr }: { classId: string; onErr: (e: unknown) => void }) {
  const [range, setRange] = useState<'week' | 'month' | 'all'>('month')
  const [sum, setSum] = useState({ total_thu: 0, total_chi: 0, balance: 0 })
  const [txs, setTxs] = useState<FundTx[]>([])
  const [loading, setLoading] = useState(true)

  const bounds = useMemo(() => {
    const now = new Date(); const to = now.toISOString().slice(0, 10)
    let from = '2000-01-01'
    if (range === 'week') { const d = new Date(now); d.setDate(d.getDate() - 7); from = d.toISOString().slice(0, 10) }
    if (range === 'month') { const d = new Date(now.getFullYear(), now.getMonth(), 1); from = d.toISOString().slice(0, 10) }
    return { from, to }
  }, [range])

  async function load() {
    setLoading(true)
    try {
      const [s, t] = await Promise.all([fundSummary(classId, bounds.from, bounds.to), getTransactions(classId)])
      setSum(s); setTxs(t)
    } catch (e) { onErr(e) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [classId, range])

  async function del(id: string) {
    try { await deleteTransaction(id); setTxs((p) => p.filter((x) => x.id !== id)); load() } catch (e) { onErr(e) }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {(['week', 'month', 'all'] as const).map((r) => (
          <TabBtn key={r} active={range === r} onClick={() => setRange(r)}>{r === 'week' ? '7 ngày' : r === 'month' ? 'Tháng này' : 'Tất cả'}</TabBtn>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Stat label="Thu" value={fmt(sum.total_thu)} color="var(--pos)" />
        <Stat label="Chi" value={fmt(sum.total_chi)} color="var(--neg)" />
        <Stat label="Tồn quỹ" value={fmt(sum.balance)} color="var(--primary)" />
      </div>
      <h3 style={{ margin: '4px 0 0', fontSize: 16 }}>Sổ giao dịch gần đây</h3>
      {loading ? <Center>Đang tải…</Center> : txs.length === 0 ? <Center>Chưa có giao dịch.</Center> : (
        <div style={{ display: 'grid', gap: 6 }}>
          {txs.map((t) => (
            <div key={t.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
              <span style={{ flex: 1 }}>
                <b style={{ color: t.kind === 'thu' ? 'var(--pos)' : 'var(--neg)' }}>{t.kind === 'thu' ? '+' : '−'}{fmt(t.amount)}</b>
                <span style={{ display: 'block', fontSize: 13, color: 'var(--muted)' }}>
                  {t.kind === 'thu' ? (t.student_name ?? 'Thu chung') + (t.week ? ` · ${t.week}` : '') : (t.category ?? 'Chi')}
                </span>
              </span>
              <button onClick={() => del(t.id)} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 13 }}>Xóa</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return <div className="card" style={{ flex: 1, padding: '12px 10px', textAlign: 'center' }}>
    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</div>
    <div style={{ fontWeight: 700, color, marginTop: 2, fontSize: 15 }}>{value}</div>
  </div>
}
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} style={{ minHeight: 38, padding: '0 14px', borderRadius: 999, fontSize: 14, fontWeight: 500, border: `1px solid ${active ? 'var(--primary)' : 'var(--line)'}`, background: active ? 'var(--primary)' : 'var(--surface)', color: active ? '#fff' : 'var(--ink)' }}>{children}</button>
}
function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', placeItems: 'center', minHeight: 160, color: 'var(--muted)', textAlign: 'center', padding: 20 }}>{children}</div>
}
const box = (c: string): React.CSSProperties => ({ padding: '10px 12px', borderRadius: 10, background: `color-mix(in srgb, ${c} 12%, #fff)`, color: c, fontSize: 14 })
