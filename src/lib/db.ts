import { supabase } from './supabase'
import type { Profile } from './auth'

export interface Student { id: string; full_name: string; group_id: string | null }
export interface Criterion {
  id: string; name: string; points: number
  kind: 'cong' | 'tru'; requires_approval: boolean; category: string | null
}
export interface Group { id: string; name: string; position: number }
export interface LeaderRow { student_id: string; display_name: string; group_id: string | null; total: number; rank: number }
export interface GroupRow { group_id: string; group_name: string; total: number }
export interface PendingRow {
  id: string; points: number; note: string | null; created_at: string
  student_name: string; criterion_name: string
}

// Lớp đang làm việc của user hiện tại.
export async function resolveClassId(profile: Profile): Promise<string | null> {
  if (profile.role === 'gvcn') {
    const { data } = await supabase.from('classes').select('id').order('created_at', { ascending: false }).limit(1)
    return data?.[0]?.id ?? null
  }
  const { data } = await supabase.from('students').select('class_id').limit(1)
  return data?.[0]?.class_id ?? null
}

export async function getGroups(classId: string): Promise<Group[]> {
  const { data } = await supabase.from('groups').select('id, name, position').eq('class_id', classId).order('position')
  return (data ?? []) as Group[]
}

export async function getStudents(classId: string): Promise<Student[]> {
  const { data, error } = await supabase.from('students')
    .select('id, full_name, group_id').eq('class_id', classId).order('full_name')
  if (error) throw error
  return (data ?? []) as Student[]
}

export async function getCriteria(classId: string): Promise<Criterion[]> {
  const { data, error } = await supabase.from('criteria')
    .select('id, name, points, kind, requires_approval, category')
    .eq('class_id', classId).eq('active', true).order('points', { ascending: false })
  if (error) throw error
  return (data ?? []) as Criterion[]
}

export async function getStudentTotals(classId: string): Promise<Map<string, number>> {
  const { data, error } = await supabase.rpc('student_totals', { p_class_id: classId })
  if (error) throw error
  const m = new Map<string, number>()
  for (const r of (data ?? []) as { student_id: string; total: number }[]) m.set(r.student_id, r.total)
  return m
}

export async function addRecord(p: { classId: string; studentId: string; criterionId: string; points: number; recordedBy: string }) {
  const { error } = await supabase.from('records').insert({
    class_id: p.classId, student_id: p.studentId, criterion_id: p.criterionId,
    points: p.points, recorded_by: p.recordedBy
  })
  if (error) throw error
}

export async function getLeaderboard(classId: string): Promise<LeaderRow[]> {
  const { data, error } = await supabase.rpc('leaderboard', { p_class_id: classId })
  if (error) throw error
  return ((data ?? []) as LeaderRow[]).sort((a, b) => a.rank - b.rank)
}

export async function getGroupTotals(classId: string): Promise<GroupRow[]> {
  const { data, error } = await supabase.rpc('group_totals', { p_class_id: classId })
  if (error) throw error
  return (data ?? []) as GroupRow[]
}

export async function getPending(classId: string): Promise<PendingRow[]> {
  const { data, error } = await supabase.from('records')
    .select('id, points, note, created_at, students(full_name), criteria(name)')
    .eq('class_id', classId).eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) throw error
  // Supabase trả quan hệ dạng object; chuẩn hoá về phẳng.
  return (data ?? []).map((r: any) => ({
    id: r.id, points: r.points, note: r.note, created_at: r.created_at,
    student_name: r.students?.full_name ?? '—', criterion_name: r.criteria?.name ?? '—'
  }))
}

export async function decideRecord(id: string, approve: boolean, deciderId: string) {
  const { error } = await supabase.from('records').update({
    status: approve ? 'applied' : 'rejected',
    decided_by: deciderId, decided_at: new Date().toISOString()
  }).eq('id', id)
  if (error) throw error
}

// ---------- Điểm danh ----------
export type AttStatus = 'present' | 'late' | 'excused' | 'absent'

export async function getAttendance(classId: string, date: string): Promise<Map<string, AttStatus>> {
  const { data, error } = await supabase.from('attendance')
    .select('student_id, status').eq('class_id', classId).eq('date', date)
  if (error) throw error
  const m = new Map<string, AttStatus>()
  for (const r of (data ?? []) as { student_id: string; status: AttStatus }[]) m.set(r.student_id, r.status)
  return m
}

export async function setAttendance(p: { classId: string; studentId: string; date: string; status: AttStatus; recordedBy: string }) {
  const { error } = await supabase.from('attendance').upsert({
    class_id: p.classId, student_id: p.studentId, date: p.date, status: p.status, recorded_by: p.recordedBy
  }, { onConflict: 'student_id,date' })
  if (error) throw error
}

export async function setAttendanceBulk(rows: { classId: string; studentId: string; date: string; status: AttStatus; recordedBy: string }[]) {
  if (rows.length === 0) return
  const { error } = await supabase.from('attendance').upsert(
    rows.map((r) => ({ class_id: r.classId, student_id: r.studentId, date: r.date, status: r.status, recorded_by: r.recordedBy })),
    { onConflict: 'student_id,date' }
  )
  if (error) throw error
}

// ---------- Chia tổ & vai ----------
export interface GroupFull { id: string; name: string; position: number; leader_student_id: string | null }
export interface StudentFull { id: string; full_name: string; group_id: string | null; is_treasurer: boolean; user_id: string | null }

export async function getGroupsFull(classId: string): Promise<GroupFull[]> {
  const { data, error } = await supabase.from('groups')
    .select('id, name, position, leader_student_id').eq('class_id', classId).order('position')
  if (error) throw error
  return (data ?? []) as GroupFull[]
}

export async function getStudentsFull(classId: string): Promise<StudentFull[]> {
  const { data, error } = await supabase.from('students')
    .select('id, full_name, group_id, is_treasurer, user_id').eq('class_id', classId).order('full_name')
  if (error) throw error
  return (data ?? []) as StudentFull[]
}

export async function saveGroupsRoles(classId: string, p: {
  groupOf: Record<string, string | null>
  leaderOf: Record<string, string | null>
  treasurerId: string | null
  students: StudentFull[]
  groups: GroupFull[]
}) {
  // 1) Gán tổ — gộp theo từng tổ để ít truy vấn.
  const byGroup = new Map<string, string[]>(); const noGroup: string[] = []
  for (const [sid, gid] of Object.entries(p.groupOf)) {
    if (gid) { const a = byGroup.get(gid) ?? []; a.push(sid); byGroup.set(gid, a) } else noGroup.push(sid)
  }
  for (const [gid, ids] of byGroup) {
    const { error } = await supabase.from('students').update({ group_id: gid }).in('id', ids); if (error) throw error
  }
  if (noGroup.length) { const { error } = await supabase.from('students').update({ group_id: null }).in('id', noGroup); if (error) throw error }

  // 2) Tổ trưởng: đặt leader cho từng tổ + nâng/hạ vai profile.
  const userIdOf = new Map(p.students.map((s) => [s.id, s.user_id]))
  const oldLeaders = new Set(p.groups.map((g) => g.leader_student_id).filter(Boolean) as string[])
  const newLeaders = new Set(Object.values(p.leaderOf).filter(Boolean) as string[])
  for (const g of p.groups) {
    const { error } = await supabase.from('groups').update({ leader_student_id: p.leaderOf[g.id] ?? null }).eq('id', g.id); if (error) throw error
  }
  for (const sid of oldLeaders) if (!newLeaders.has(sid)) {
    const uid = userIdOf.get(sid); if (uid) { const { error } = await supabase.from('profiles').update({ role: 'hs' }).eq('id', uid); if (error) throw error }
  }
  for (const sid of newLeaders) {
    const uid = userIdOf.get(sid); if (uid) { const { error } = await supabase.from('profiles').update({ role: 'totruong' }).eq('id', uid); if (error) throw error }
  }

  // 3) Thủ quỹ: xoá cờ cũ, đặt cờ mới.
  { const { error } = await supabase.from('students').update({ is_treasurer: false }).eq('class_id', classId).eq('is_treasurer', true); if (error) throw error }
  if (p.treasurerId) { const { error } = await supabase.from('students').update({ is_treasurer: true }).eq('id', p.treasurerId); if (error) throw error }
}

// ---------- Tuần ISO ----------
export function isoWeek(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const week = 1 + Math.round(((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

// ---------- Thu chi quỹ ----------
export interface FundTx {
  id: string; kind: 'thu' | 'chi'; amount: number; student_id: string | null
  week: string | null; category: string | null; note: string | null; created_at: string
  student_name?: string
}

export async function getFundConfig(classId: string): Promise<{ weekly_amount: number; note: string | null } | null> {
  const { data } = await supabase.from('fund_config').select('weekly_amount, note').eq('class_id', classId).maybeSingle()
  return data as { weekly_amount: number; note: string | null } | null
}
export async function setFundConfig(classId: string, weekly_amount: number, note: string | null) {
  const { error } = await supabase.from('fund_config').upsert({ class_id: classId, weekly_amount, note }, { onConflict: 'class_id' })
  if (error) throw error
}
export async function getWeekPaid(classId: string, week: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('fund_transactions')
    .select('student_id').eq('class_id', classId).eq('kind', 'thu').eq('week', week)
  if (error) throw error
  return new Set((data ?? []).map((r) => r.student_id).filter(Boolean) as string[])
}
export async function recordThu(p: { classId: string; studentId: string | null; amount: number; week: string | null; note: string | null; recordedBy: string }) {
  const { error } = await supabase.from('fund_transactions').insert({
    class_id: p.classId, kind: 'thu', amount: p.amount, student_id: p.studentId, week: p.week, note: p.note, recorded_by: p.recordedBy
  })
  if (error) throw error
}
export async function recordChi(p: { classId: string; amount: number; category: string | null; note: string | null; recordedBy: string }) {
  const { error } = await supabase.from('fund_transactions').insert({
    class_id: p.classId, kind: 'chi', amount: p.amount, category: p.category, note: p.note, recorded_by: p.recordedBy
  })
  if (error) throw error
}
export async function getTransactions(classId: string, limit = 60): Promise<FundTx[]> {
  const { data, error } = await supabase.from('fund_transactions')
    .select('id, kind, amount, student_id, week, category, note, created_at, students(full_name)')
    .eq('class_id', classId).order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return (data ?? []).map((r: any) => ({ ...r, student_name: r.students?.full_name }))
}
export async function deleteTransaction(id: string) {
  const { error } = await supabase.from('fund_transactions').delete().eq('id', id)
  if (error) throw error
}
export async function fundSummary(classId: string, from: string, to: string): Promise<{ total_thu: number; total_chi: number; balance: number }> {
  const { data, error } = await supabase.rpc('fund_summary', { p_class_id: classId, p_from: from, p_to: to })
  if (error) throw error
  const r = (data ?? [])[0] ?? { total_thu: 0, total_chi: 0, balance: 0 }
  return r
}
export async function amITreasurer(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase.from('students').select('is_treasurer').eq('user_id', user.id).maybeSingle()
  return !!(data as { is_treasurer?: boolean } | null)?.is_treasurer
}

// ---------- Thông báo & bản tin ----------
export async function sendAnnouncement(classId: string, title: string, body: string, audience: 'hs' | 'phhs' | 'both', studentIds: string[] | null): Promise<number> {
  const { data, error } = await supabase.rpc('send_announcement', {
    p_class_id: classId, p_title: title, p_body: body, p_audience: audience, p_student_ids: studentIds
  })
  if (error) throw error
  return data as number
}
export async function sendNewsletter(classId: string, week: string, text: string, toHs: boolean): Promise<number> {
  const { data, error } = await supabase.rpc('send_weekly_report', {
    p_class_id: classId, p_week: week, p_text: text, p_to_hs: toHs
  })
  if (error) throw error
  return data as number
}

// ---------- Thông báo cá nhân (feed) ----------
export interface Notif { id: string; type: string | null; title: string; body: string | null; read: boolean; created_at: string }
export async function getNotifications(limit = 50): Promise<Notif[]> {
  const { data, error } = await supabase.from('notifications').select('id, type, title, body, read, created_at').order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return (data ?? []) as Notif[]
}
export async function getUnreadCount(): Promise<number> {
  const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('read', false)
  return count ?? 0
}
export async function markAllRead() {
  await supabase.from('notifications').update({ read: true }).eq('read', false)
}

// ---------- Onboarding & trang phụ huynh ----------
export interface ParentLink { student_id: string; full_name: string; student_code: string | null; token: string; claimed: boolean }

export async function ensureParentLinks(classId: string): Promise<ParentLink[]> {
  const { data, error } = await supabase.rpc('ensure_parent_links', { p_class_id: classId })
  if (error) throw error
  return (data ?? []) as ParentLink[]
}

export async function parentLinkInfo(token: string): Promise<{ full_name: string; claimed: boolean } | null> {
  const { data, error } = await supabase.rpc('parent_link_info', { p_token: token })
  if (error) throw error
  return (data ?? [])[0] ?? null
}

export async function claimParent(token: string, password: string, parent_name: string | null) {
  const { data, error } = await supabase.functions.invoke('claim-parent', { body: { token, password, parent_name } })
  if (error) throw error
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error)
  return data as { ok?: boolean; already?: boolean; username: string | null }
}

export interface ChildRecord { id: string; points: number; created_at: string; criterion_name: string; kind: 'cong' | 'tru' }
export async function getChildRecords(studentId: string, from: string, to: string): Promise<ChildRecord[]> {
  const { data, error } = await supabase.from('records')
    .select('id, points, created_at, criteria(name, kind)')
    .eq('student_id', studentId).eq('status', 'applied')
    .gte('created_at', from).lte('created_at', to)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r: any) => ({ id: r.id, points: r.points, created_at: r.created_at, criterion_name: r.criteria?.name ?? '—', kind: r.criteria?.kind ?? 'cong' }))
}

export async function getChildAttendance(studentId: string, from: string, to: string): Promise<{ date: string; status: AttStatus }[]> {
  const { data, error } = await supabase.from('attendance')
    .select('date, status').eq('student_id', studentId).gte('date', from).lte('date', to).order('date', { ascending: false })
  if (error) throw error
  return (data ?? []) as { date: string; status: AttStatus }[]
}

export async function sendParentFeedback(classId: string, studentId: string, text: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Chưa đăng nhập.')
  const { error } = await supabase.from('parent_feedback').insert({
    class_id: classId, student_id: studentId, parent_user_id: user.id, text
  })
  if (error) throw error
}

// ---------- Trang học sinh ----------
export async function getMyStudent(): Promise<{ id: string; full_name: string; group_id: string | null; class_id: string } | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('students').select('id, full_name, group_id, class_id').eq('user_id', user.id).maybeSingle()
  return (data as { id: string; full_name: string; group_id: string | null; class_id: string } | null) ?? null
}

// Điểm ròng theo từng mặt (category) từ các ghi nhận đã áp dụng.
export async function getAxisNet(studentId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('records')
    .select('points, criteria(category)').eq('student_id', studentId).eq('status', 'applied')
  if (error) throw error
  const net: Record<string, number> = {}
  for (const r of (data ?? []) as any[]) {
    const cat = r.criteria?.category
    if (!cat) continue
    net[cat] = (net[cat] ?? 0) + r.points
  }
  return net
}

export async function updateCriterionCategory(id: string, category: string | null) {
  const { error } = await supabase.from('criteria').update({ category }).eq('id', id)
  if (error) throw error
}

// ---------- Sơ đồ lớp ----------
export interface SeatStudent { id: string; full_name: string; group_id: string | null; seat_index: number | null; seat_locked: boolean }
export async function getSeating(classId: string): Promise<SeatStudent[]> {
  const { data, error } = await supabase.from('students')
    .select('id, full_name, group_id, seat_index, seat_locked').eq('class_id', classId).order('full_name')
  if (error) throw error
  return (data ?? []) as SeatStudent[]
}
export async function saveSeating(rows: { id: string; group_id: string | null; seat_index: number | null; seat_locked: boolean }[]) {
  await Promise.all(rows.map((r) =>
    supabase.from('students').update({ group_id: r.group_id, seat_index: r.seat_index, seat_locked: r.seat_locked }).eq('id', r.id)
  ))
}
