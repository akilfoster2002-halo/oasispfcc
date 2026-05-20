import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { randomBytes } from 'crypto'

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous 0/O/1/I
const KEY_TTL_MS = 60 * 60 * 1000 // 1 hour

function generateKey() {
  const bytes = randomBytes(8)
  let key = ''
  for (let i = 0; i < 8; i++) {
    if (i === 4) key += '-'
    key += CHARS[bytes[i] % CHARS.length]
  }
  return key
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

async function getRequestingAdmin(churchId: string) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: m } = await adminClient()
    .from('church_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('church_id', churchId)
    .eq('status', 'approved')
    .single()
  if (!m || !['admin', 'pastor'].includes(m.role)) return null
  return { userId: user.id }
}

async function rotateKey(churchId: string) {
  const key = generateKey()
  const expiresAt = new Date(Date.now() + KEY_TTL_MS).toISOString()
  await adminClient()
    .from('churches')
    .update({ access_key: key, access_key_expires_at: expiresAt })
    .eq('id', churchId)
  return { key, expiresAt }
}

/** GET /api/churches/[slug]/access-key — returns current key, auto-rotates if expired */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const admin = adminClient()

  const { data: church } = await admin
    .from('churches')
    .select('id, access_key, access_key_expires_at')
    .eq('slug', slug)
    .single()

  if (!church) return Response.json({ error: 'Church not found' }, { status: 404 })

  const requester = await getRequestingAdmin(church.id)
  if (!requester) return Response.json({ error: 'Forbidden' }, { status: 403 })

  // Auto-rotate if missing or expired
  const expired = !church.access_key || !church.access_key_expires_at
    || new Date(church.access_key_expires_at) <= new Date()

  let key = church.access_key
  let expiresAt = church.access_key_expires_at

  if (expired) {
    const rotated = await rotateKey(church.id)
    key = rotated.key
    expiresAt = rotated.expiresAt
  }

  const minutesLeft = Math.max(0, Math.floor((new Date(expiresAt!).getTime() - Date.now()) / 60000))
  return Response.json({ key, expiresAt, minutesLeft })
}

/** POST /api/churches/[slug]/access-key — force-regenerate the key */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const { data: church } = await adminClient()
    .from('churches')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!church) return Response.json({ error: 'Church not found' }, { status: 404 })

  const requester = await getRequestingAdmin(church.id)
  if (!requester) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { key, expiresAt } = await rotateKey(church.id)
  const minutesLeft = 60
  return Response.json({ key, expiresAt, minutesLeft })
}
