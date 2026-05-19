import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// GET /api/forms/[id]/events
// Returns the form's church name + recent events (for the public form page event picker)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: formId } = await params

  // Get the form + its church
  const { data: form, error: formErr } = await db()
    .from('forms')
    .select('id, name, church_id, churches(name, slug)')
    .eq('id', formId)
    .single()

  if (formErr || !form) return Response.json({ error: 'Form not found' }, { status: 404 })

  // Get recent events for that church (last 60 days + next 14 days)
  const since = new Date()
  since.setDate(since.getDate() - 60)
  const until = new Date()
  until.setDate(until.getDate() + 14)

  const { data: events } = await db()
    .from('events')
    .select('id, name, event_date, service_type, groups(name)')
    .eq('church_id', form.church_id)
    .gte('event_date', since.toISOString().split('T')[0])
    .lte('event_date', until.toISOString().split('T')[0])
    .order('event_date', { ascending: false })
    .limit(40)

  return Response.json({
    form: { id: form.id, name: (form as any).name },
    church: (form as any).churches,
    events: events ?? [],
  })
}
