// Resolve the calling user from their session cookies and confirm they are
// an admin/pastor/master of the given church. Used by every church-scoped API route.

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseServer } from '@/lib/supabase-server'
import { ADMIN_ROLES, type Role } from '@/lib/roles'

export interface ChurchAdmin {
  userId: string
  role: Role
  membershipId: string
}

/**
 * Returns the admin record or null if the caller isn't signed in / isn't an
 * admin of this church. API routes should respond with 403 on null.
 */
export async function requireChurchAdmin(churchId: string): Promise<ChurchAdmin | null> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = getSupabaseServer()
  const [{ data: m }, { data: profile }] = await Promise.all([
    admin
      .from('church_memberships')
      .select('id, role')
      .eq('user_id', user.id)
      .eq('church_id', churchId)
      .eq('status', 'approved')
      .single(),
    admin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single(),
  ])

  if (!m) return null
  // user_profiles.role === 'master' is a global admin flag — always allow
  const effectiveRole = profile?.role === 'master' ? 'master' : m.role
  if (!(ADMIN_ROLES as readonly string[]).includes(effectiveRole)) return null
  return { userId: user.id, role: effectiveRole as Role, membershipId: m.id }
}

/** Convenience: also resolve the church id from slug. Returns null on either failure. */
export async function requireChurchAdminBySlug(slug: string): Promise<
  | { admin: ChurchAdmin; churchId: string }
  | { error: 'not_found' | 'forbidden' }
> {
  const { data: church } = await getSupabaseServer()
    .from('churches')
    .select('id')
    .eq('slug', slug)
    .single()
  if (!church) return { error: 'not_found' }

  const admin = await requireChurchAdmin(church.id)
  if (!admin) return { error: 'forbidden' }
  return { admin, churchId: church.id }
}
