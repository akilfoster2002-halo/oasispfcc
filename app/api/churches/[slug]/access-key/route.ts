import { NextRequest } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { requireChurchAdminBySlug } from '@/lib/require-church-admin'
import { generateAccessKey, KEY_TTL_MS, minutesLeftUntil } from '@/lib/access-key'

/**
 * Atomic rotate. The `eq('access_key_expires_at', priorExpiresAt)` guards against the
 * race where two admins fetch an expired key at the same time — only one update lands,
 * and the loser's response tells them to refetch.
 *
 * Pass `priorExpiresAt: null` to force-rotate from POST without caring about the prior value.
 */
async function rotateKey(churchId: string, priorExpiresAt: string | null) {
  const key = generateAccessKey()
  const expiresAt = new Date(Date.now() + KEY_TTL_MS).toISOString()
  const admin = getSupabaseServer()

  let q = admin
    .from('churches')
    .update({ access_key: key, access_key_expires_at: expiresAt })
    .eq('id', churchId)
  if (priorExpiresAt !== null) {
    q = q.eq('access_key_expires_at', priorExpiresAt)
  }
  // .select() so we know how many rows actually changed.
  const { data } = await q.select('access_key, access_key_expires_at')
  if (!data || data.length === 0) {
    // Someone else rotated first — return whatever's now current.
    const { data: current } = await admin
      .from('churches')
      .select('access_key, access_key_expires_at')
      .eq('id', churchId)
      .single()
    return {
      key: current?.access_key as string,
      expiresAt: current?.access_key_expires_at as string,
    }
  }
  return { key, expiresAt }
}

/** GET /api/churches/[slug]/access-key — read-only.
 *  Returns the current key or, if expired/missing, rotates once and returns the new one.
 *  Rotation is still done here (so the UI doesn't need a separate call on first load),
 *  but it's done atomically via conditional update so simultaneous GETs converge.
 */
const PAID_PLANS = new Set(['starter', 'growth', 'intelligence'])

async function checkPlan(churchId: string): Promise<boolean> {
  const { data } = await getSupabaseServer()
    .from('churches')
    .select('plan, plan_status')
    .eq('id', churchId)
    .single()
  return !!data && PAID_PLANS.has(data.plan) && data.plan_status === 'active'
}

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

  if (!await checkPlan(guard.churchId)) {
    return Response.json({ error: 'upgrade_required' }, { status: 403 })
  }

  const admin = getSupabaseServer()
  const { data: church } = await admin
    .from('churches')
    .select('access_key, access_key_expires_at')
    .eq('id', guard.churchId)
    .single()

  if (!church) return Response.json({ error: 'Church not found' }, { status: 404 })

  const expired =
    !church.access_key ||
    !church.access_key_expires_at ||
    new Date(church.access_key_expires_at) <= new Date()

  let key = church.access_key
  let expiresAt = church.access_key_expires_at

  if (expired) {
    // Pass the prior value so concurrent rotations don't double-rotate.
    const rotated = await rotateKey(guard.churchId, church.access_key_expires_at ?? null)
    key = rotated.key
    expiresAt = rotated.expiresAt
  }

  return Response.json({
    key,
    expiresAt,
    minutesLeft: minutesLeftUntil(expiresAt!),
  })
}

/** POST /api/churches/[slug]/access-key — force-rotate. */
export async function POST(
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

  if (!await checkPlan(guard.churchId)) {
    return Response.json({ error: 'upgrade_required' }, { status: 403 })
  }

  const { key, expiresAt } = await rotateKey(guard.churchId, null)
  return Response.json({
    key,
    expiresAt,
    minutesLeft: minutesLeftUntil(expiresAt),
  })
}
