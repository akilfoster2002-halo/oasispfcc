import { SupabaseClient } from '@supabase/supabase-js'

export type MembershipRole = 'admin' | 'pastor' | 'leader' | 'volunteer' | 'member'
export type MembershipStatus = 'pending' | 'approved' | 'rejected' | 'suspended'

export interface Church {
  id: string
  name: string
  slug: string
  created_at: string
}

export interface ChurchMembership {
  id: string
  user_id: string
  church_id: string
  role: MembershipRole
  status: MembershipStatus
  joined_via: string
  created_at: string
  church?: Church
}

export async function getChurchBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<Church | null> {
  const { data } = await supabase
    .from('churches')
    .select('*')
    .eq('slug', slug)
    .single()
  return data ?? null
}

export async function getUserMemberships(
  supabase: SupabaseClient,
  userId: string,
): Promise<ChurchMembership[]> {
  const { data } = await supabase
    .from('church_memberships')
    .select('*, church:churches(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  return data ?? []
}

export async function getMembership(
  supabase: SupabaseClient,
  userId: string,
  churchId: string,
): Promise<ChurchMembership | null> {
  const { data } = await supabase
    .from('church_memberships')
    .select('*')
    .eq('user_id', userId)
    .eq('church_id', churchId)
    .single()
  return data ?? null
}

export async function createMembership(
  supabase: SupabaseClient,
  userId: string,
  churchId: string,
  role: MembershipRole = 'member',
  status: MembershipStatus,
  joinedVia: string = 'invite_link',
): Promise<ChurchMembership | null> {
  const { data } = await supabase
    .from('church_memberships')
    .upsert({
      user_id: userId,
      church_id: churchId,
      role,
      status,
      joined_via: joinedVia,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,church_id' })
    .select()
    .single()
  return data ?? null
}

/** Returns the approved memberships for a user, with church data embedded. */
export async function getApprovedMemberships(
  supabase: SupabaseClient,
  userId: string,
): Promise<ChurchMembership[]> {
  const { data } = await supabase
    .from('church_memberships')
    .select('*, church:churches(*)')
    .eq('user_id', userId)
    .eq('status', 'approved')
  return data ?? []
}
