import { NextRequest } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { requireChurchAdminBySlug } from '@/lib/require-church-admin'
import { VALID_ROLES, VALID_STATUSES, isMasterRole, type Role, type MembershipStatus } from '@/lib/roles'

interface MembershipRow {
  id: string
  user_id: string
  role: string
  status: string
  joined_via: string | null
  created_at: string
}

/** GET /api/churches/[slug]/members — list all memberships with user info. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const guard = await requireChurchAdminBySlug(slug)
  if ('error' in guard) {
    return Response.json(
      { error: guard.error === 'not_found' ? 'Church not found' : 'Forbidden' },
      { status: guard.error === 'not_found' ? 404 : 403 },
    )
  }

  const admin = getSupabaseServer()
  const { data: memberships } = await admin
    .from('church_memberships')
    .select('id, user_id, role, status, joined_via, created_at')
    .eq('church_id', guard.churchId)
    .order('created_at', { ascending: true })

  if (!memberships?.length) return Response.json({ members: [] })

  // Fetch each user record in parallel. This scales with church size, not platform size
  // (the old `listUsers({ perPage: 1000 })` capped the whole platform at 1000 users).
  const userResults = await Promise.all(
    memberships.map((m: MembershipRow) => admin.auth.admin.getUserById(m.user_id)),
  )

  const members = memberships.map((m: MembershipRow, i: number) => {
    const u = userResults[i]?.data?.user
    return {
      id: m.id,
      userId: m.user_id,
      role: m.role,
      status: m.status,
      joinedVia: m.joined_via,
      createdAt: m.created_at,
      email: u?.email ?? '',
      name: (u?.user_metadata?.full_name ?? u?.user_metadata?.name ?? u?.email ?? 'Unknown'),
    }
  })

  return Response.json({ members })
}

/** PATCH /api/churches/[slug]/members — update a member's role and/or status. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const guard = await requireChurchAdminBySlug(slug)
  if ('error' in guard) {
    return Response.json(
      { error: guard.error === 'not_found' ? 'Church not found' : 'Forbidden' },
      { status: guard.error === 'not_found' ? 404 : 403 },
    )
  }

  const body = await req.json()
  const membershipId = body.membershipId as string | undefined
  const role = body.role as Role | undefined
  const status = body.status as MembershipStatus | undefined

  if (!membershipId) return Response.json({ error: 'Missing membershipId' }, { status: 400 })
  if (role && !(VALID_ROLES as readonly string[]).includes(role)) {
    return Response.json({ error: 'Invalid role' }, { status: 400 })
  }
  if (status && !(VALID_STATUSES as readonly string[]).includes(status)) {
    return Response.json({ error: 'Invalid status' }, { status: 400 })
  }

  const admin = getSupabaseServer()

  // Load the target membership so we can enforce hierarchy rules.
  const { data: target } = await admin
    .from('church_memberships')
    .select('id, user_id, role')
    .eq('id', membershipId)
    .eq('church_id', guard.churchId)
    .single()
  if (!target) return Response.json({ error: 'Membership not found' }, { status: 404 })

  // ── Hierarchy enforcement ─────────────────────────────────────────────────
  // 1. Nobody can change their own role/status (no self-demote, no self-promote).
  if (target.user_id === guard.admin.userId && (role || status)) {
    return Response.json(
      { error: "You can't change your own role. Ask another admin to do it." },
      { status: 403 },
    )
  }

  // 2. Only a master can promote someone to master or demote an existing master.
  const wouldTouchMaster = isMasterRole(role) || isMasterRole(target.role)
  if (wouldTouchMaster && !isMasterRole(guard.admin.role)) {
    return Response.json(
      { error: 'Only a master admin can grant or revoke the master role.' },
      { status: 403 },
    )
  }

  // 3. Last-master guard: don't allow demoting the only remaining master.
  if (isMasterRole(target.role) && role && !isMasterRole(role)) {
    const { count } = await admin
      .from('church_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('church_id', guard.churchId)
      .eq('role', 'master')
      .eq('status', 'approved')
    if ((count ?? 0) <= 1) {
      return Response.json(
        { error: 'Promote another member to master before demoting the last one.' },
        { status: 409 },
      )
    }
  }

  const updates: Record<string, string> = {}
  if (role) updates.role = role
  if (status) updates.status = status
  if (Object.keys(updates).length === 0) {
    return Response.json({ ok: true })
  }

  const { error } = await admin
    .from('church_memberships')
    .update(updates)
    .eq('id', membershipId)
    .eq('church_id', guard.churchId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
