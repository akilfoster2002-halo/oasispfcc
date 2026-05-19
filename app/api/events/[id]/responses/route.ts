import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// GET /api/events/[id]/responses
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params

  const { data, error } = await db()
    .from('form_responses')
    .select('id, form_id, form_name, submitted_by, responses, created_at, forms(name, fields)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

// POST /api/events/[id]/responses
// Body: { form_id, church_id, submitted_by?, responses }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params
  const body = await req.json()
  const { form_id, church_id, submitted_by, responses } = body

  if (!form_id || !church_id || !responses) {
    return Response.json({ error: 'form_id, church_id, and responses are required' }, { status: 400 })
  }

  // Fetch the form to snapshot its name
  const { data: form, error: formErr } = await db()
    .from('forms')
    .select('name')
    .eq('id', form_id)
    .single()

  if (formErr || !form) {
    return Response.json({ error: 'Form not found' }, { status: 404 })
  }

  const { data, error } = await db()
    .from('form_responses')
    .insert({
      form_id,
      event_id: eventId,
      church_id,
      submitted_by: submitted_by || null,
      form_name: form.name,
      responses,
    })
    .select('id')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
