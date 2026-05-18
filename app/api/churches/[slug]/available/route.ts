import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

/** GET /api/churches/[slug]/available — check if a church ID is taken */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  if (!/^[a-z0-9-]{3,40}$/.test(slug)) {
    return Response.json({ available: false, reason: 'invalid_format' })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data } = await supabase
    .from('churches')
    .select('id')
    .eq('slug', slug)
    .single()

  return Response.json({ available: !data })
}
