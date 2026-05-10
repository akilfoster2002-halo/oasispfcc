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
 * Returns a Supabase filter expression for scoping attendee_id to a group.
 * Pass the result to `.in('attendee_id', ids)` after fetching with this helper.
 */
export async function getGroupAttendeeIds(
  supabase: SupabaseClient,
  groupId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from('attendance')
    .select('attendee_id, meetings!inner(group_id)')
    .eq('meetings.group_id', groupId)
  if (!data) return []
  return [...new Set(data.map((r: { attendee_id: string }) => r.attendee_id))]
}
