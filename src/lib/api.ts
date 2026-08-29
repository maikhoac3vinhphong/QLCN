import { supabase } from './supabase'
import type { ParsedStudent } from './parseStudents'

export interface ProvisionResult {
  full_name: string
  username?: string
  password?: string
  skipped?: string
  error?: string
}

export async function provisionStudents(class_id: string, students: ParsedStudent[]) {
  const { data, error } = await supabase.functions.invoke('provision-students', {
    body: { class_id, students }
  })
  if (error) throw error
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error)
  return data as { ok: boolean; results: ProvisionResult[] }
}
