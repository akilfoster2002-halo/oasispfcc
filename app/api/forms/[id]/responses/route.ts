import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// GET /api/forms/[id]/responses — all submissions for a form
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: formId } = await params

  const { data, error } = await db()
    .from('form_responses')
    .select('id, submitted_by, responses, created_at, events(name, event_date)')
    .eq('form_id', formId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}
