import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

/** GET /api/churches/[slug] — public endpoint for the join landing page */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const supabase = adminClient()

  const { data: church, error } = await supabase
    .from('churches')
    .select('id, name, slug, created_at')
    .eq('slug', slug)
    .single()

  if (error || !church) {
    return Response.json({ error: 'Church not found' }, { status: 404 })
  }

  return Response.json({ church })
}
