import { supabase } from './supabase'
import type { Profile } from './auth'

export interface Student { id: string; full_name: string; group_id: string | null }
export interface Criterion {
  id: string; name: string; points: number
  kind: 'cong' | 'tru'; requires_approval: boolean
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
    .select('id, name, points, kind, requires_approval')
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
