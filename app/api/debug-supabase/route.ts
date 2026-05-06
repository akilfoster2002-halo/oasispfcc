import { getSupabaseServer } from '@/lib/supabase-server'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const info: Record<string, unknown> = {
    urlPresent:  !!url,
    keyPresent:  !!key,
    urlPrefix:   url?.substring(0, 35),
  }
  try {
    const supabase = getSupabaseServer()
    const { count, error } = await supabase
      .from('meetings')
      .select('*', { count: 'exact', head: true })
    info.supabaseError = error?.message ?? null
    info.count = count
  } catch (e) {
    info.thrown = e instanceof Error ? e.message : String(e)
  }
  return Response.json(info)
}
