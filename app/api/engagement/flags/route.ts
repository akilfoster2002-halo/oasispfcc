import { getSupabaseServer } from '@/lib/supabase-server'
import { computeEngagementFlags } from '@/lib/engagement'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const groupId = searchParams.get('groupId') || null
    const supabase = getSupabaseServer()
    const flags = await computeEngagementFlags(supabase, groupId)
    return Response.json(flags)
  } catch (err) {
    console.error('[engagement/flags]', err)
    return Response.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
