import { SupabaseClient } from '@supabase/supabase-js'

export type UserRole = 'master' | 'group'

export interface UserProfile {
  id: string
  role: UserRole
  group_id: string | null
}

/** Server-side helper — pass the supabase admin/server client */
export async function getUserProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserProfile | null> {
  const { data } = await supabase
    .from('user_profiles')
    .select('id, role, group_id')
    .eq('id', userId)
    .single()
  return data ?? null
}

/**
 * Returns person UUIDs that have attended events in the given group.
 * Pass the result to `.in('person_id', ids)`.
 */
export async function getGroupPersonIds(
  supabase: SupabaseClient,
  groupId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from('attendance')
    .select('person_id, events!inner(group_id)')
    .eq('events.group_id', groupId)
  if (!data) return []
  return [...new Set(data.map((r: { person_id: string }) => r.person_id))]
}
