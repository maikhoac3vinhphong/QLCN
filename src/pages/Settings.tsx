import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { errText } from '../lib/err'
import { parseStudents } from '../lib/parseStudents'
import { provisionStudents, type ProvisionResult } from '../lib/api'
import { getCriteria, type Criterion } from '../lib/db'

export default function Settings({ classId }: { classId: string }) {
  const [cls, setCls] = useState<{ name: string; school_year: string } | null>(null)
  const [criteria, setCriteria] = useState<Criterion[]>([])
  const [raw, setRaw] = useState('')
  const parsed = useMemo(() => parseStudents(raw), [raw])
  const [creds, setCreds] = useState<ProvisionResult[] | null>(null)
  const [busyProv, setBusyProv] = useState(false)
  const [critText, setCritText] = useState('')
  const [busyCrit, setBusyCrit] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  async function load() {
    try {
      const { data } = await supabase.from('classes').select('name, school_year').eq('id', classId).single()
      setCls(data as { name: string; school_year: string })
      setCriteria(await getCriteria(classId))
    } catch (e) { setErr(errText(e)) }
  }
  useEffect(() => { load() }, [classId])

  async function provision() {
    if (parsed.length === 0) return
    setBusyProv(true); setErr(null); setOk(null)
    try {
      const { results } = await provisionStudents(classId, parsed)
      setCreds(results)
      const created = results.filter((r) => r.username).length
      const skipped = results.filter((r) => r.skipped).length
      setOk(`Đã tạo ${created} tài khoản` + (skipped ? `, bỏ qua ${skipped} (đã có).` : '.'))
      setRaw('')
    } catch (e) { setErr(errText(e)) } finally { setBusyProv(false) }
  }

  function downloadCreds() {
    if (!creds) return
    const rows = creds.filter((c) => c.username).map((c) => `${csv(c.full_name)},${c.username},${c.password}`)
    const blob = new Blob([`Họ tên,Tên đăng nhập,Mật khẩu\n${rows.join('\n')}`], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `taikhoan-${cls?.name || 'lop'}.csv`; a.click()
  }

  async function addCriteria() {
    const rows = critText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
      const [name, pts] = l.split('|').map((x) => x.trim())
      return { name, points: parseInt(pts, 10) }
    }).filter((r) => r.name && !Number.isNaN(r.points))
    if (rows.length === 0) { setErr('Mỗi dòng: tên | điểm.'); return }
    setBusyCrit(true); setErr(null); setOk(null)
    try {
      await supabase.from('criteria').insert(rows.map((r) => ({
        class_id: classId, name: r.name, points: r.points, requires_approval: r.points <= -5
      })))
      setCritText(''); setOk(`Đã thêm ${rows.length} tiêu chí.`)
      setCriteria(await getCriteria(classId))
    } catch (e) { setErr(errText(e)) } finally { setBusyCrit(false) }
  }

  return (
    <div style={{ display: 'grid', gap: 14, paddingBottom: 20 }}>
      {err && <div style={box('var(--neg)')}>{err}</div>}
      {ok && <div style={box('var(--pos)')}>{ok}</div>}

      <section className="card" style={pad}>
        <h3 style={h3}>Thông tin lớp</h3>
        {cls ? <p style={{ margin: 0, color: 'var(--muted)' }}>Lớp <b style={{ color: 'var(--ink)' }}>{cls.name}</b> · Năm học {cls.school_year}</p>
             : <p style={{ margin: 0, color: 'var(--muted)' }}>Đang tải…</p>}
      </section>

      <section className="card" style={pad}>
        <h3 style={h3}>Thêm học sinh</h3>
        <p style={hint}>Dán từ Excel: mỗi dòng một HS, 3 cột Họ tên · Giới tính · Mã HS (Tab). HS đã có mã sẽ được bỏ qua.</p>
        {!creds ? (
          <>
            <textarea className="input" style={ta} placeholder={'Nguyễn Văn An\tNam\t8A101'} value={raw} onChange={(e) => setRaw(e.target.value)} />
            {parsed.length > 0 && <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 8 }}>Nhận diện {parsed.length} học sinh.</div>}
            <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={busyProv || parsed.length === 0} onClick={provision}>
              {busyProv ? 'Đang tạo…' : `Tạo tài khoản (${parsed.length})`}
            </button>
          </>
        ) : (
          <>
            <div style={{ padding: 12, borderRadius: 10, background: 'var(--primary-050)', marginBottom: 10, fontSize: 14 }}>
              Tải danh sách và phát cho HS — mật khẩu chỉ hiện lần này.
            </div>
            <button className="btn" onClick={downloadCreds}>⬇ Tải danh sách tài khoản (.csv)</button>
            <div style={{ maxHeight: 220, overflow: 'auto', marginTop: 10, border: '1px solid var(--line)', borderRadius: 10 }}>
              <table style={table}>
                <thead><tr><th style={th}>Họ tên</th><th style={th}>Tên ĐN</th><th style={th}>Mật khẩu</th></tr></thead>
                <tbody>{creds.map((c, i) => (
                  <tr key={i}><td style={td}>{c.full_name}</td><td style={td}>{c.username ?? '—'}</td>
                    <td style={td}>{c.password ?? <span style={{ color: 'var(--muted)' }}>{c.skipped ?? c.error}</span>}</td></tr>
                ))}</tbody>
              </table>
            </div>
            <button className="btn" style={{ marginTop: 10 }} onClick={() => setCreds(null)}>Thêm đợt khác</button>
          </>
        )}
      </section>

      <section className="card" style={pad}>
        <h3 style={h3}>Tiêu chí ({criteria.length})</h3>
        {criteria.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {criteria.map((c) => {
              const col = c.kind === 'cong' ? 'var(--pos)' : 'var(--neg)'
              return <span key={c.id} style={{ fontSize: 13, padding: '4px 10px', borderRadius: 999, border: `1px solid ${col}`, color: col }}>
                {c.name} {c.points > 0 ? '+' + c.points : c.points}{c.requires_approval ? ' · duyệt' : ''}
              </span>
            })}
          </div>
        )}
        <p style={hint}>Thêm tiêu chí mới — mỗi dòng: tên | điểm. Trừ từ 5 trở lên sẽ cần duyệt.</p>
        <textarea className="input" style={ta} placeholder={'Giúp bạn học | 2\nNói chuyện riêng | -1'} value={critText} onChange={(e) => setCritText(e.target.value)} />
        <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={busyCrit} onClick={addCriteria}>
          {busyCrit ? 'Đang thêm…' : 'Thêm tiêu chí'}
        </button>
      </section>
    </div>
  )
}

const csv = (s: string) => /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
const pad: React.CSSProperties = { padding: 18 }
const h3: React.CSSProperties = { margin: '0 0 10px', fontSize: 17 }
const hint: React.CSSProperties = { color: 'var(--muted)', fontSize: 14, margin: '0 0 10px', lineHeight: 1.5 }
const ta: React.CSSProperties = { minHeight: 110, padding: 12, resize: 'vertical', fontFamily: 'inherit' }
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 14 }
const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', position: 'sticky', top: 0, background: 'var(--surface)', borderBottom: '1px solid var(--line)', fontWeight: 600 }
const td: React.CSSProperties = { padding: '7px 10px', borderBottom: '1px solid var(--line)' }
const box = (c: string): React.CSSProperties => ({ padding: '10px 12px', borderRadius: 10, background: `color-mix(in srgb, ${c} 12%, #fff)`, color: c, fontSize: 14 })
