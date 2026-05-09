import { getSupabaseServer } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getSupabaseServer()

  const [{ data: conv, error }, { data: messages }] = await Promise.all([
    supabase.from('conversations').select('*, attendees(name, phone, breeze_id)').eq('id', id).single(),
    supabase.from('sms_messages').select('*').eq('conversation_id', id).order('created_at', { ascending: true }),
  ])

  if (error || !conv) return Response.json({ error: 'Not found' }, { status: 404 })

  // Get attendance history if linked to an attendee
  let attendanceHistory: unknown[] = []
  if (conv.attendee_id) {
    const { data } = await supabase
      .from('attendance')
      .select('id, status, meetings(meeting_date, meeting_type, name, groups(name))')
      .eq('attendee_id', conv.attendee_id)
      .eq('status', 'present')
      .order('meetings(meeting_date)', { ascending: false })
      .limit(10)
    attendanceHistory = data ?? []
  }

  return Response.json({ ...conv, messages: messages ?? [], attendanceHistory })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json() as { status?: string; assigned_leader?: string; ai_summary?: string; is_sensitive?: boolean }
  const supabase = getSupabaseServer()

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.status !== undefined)           updates.status = body.status
  if (body.assigned_leader !== undefined)  updates.assigned_leader = body.assigned_leader
  if (body.ai_summary !== undefined)       updates.ai_summary = body.ai_summary
  if (body.is_sensitive !== undefined)     updates.is_sensitive = body.is_sensitive

  const { error } = await supabase.from('conversations').update(updates).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
