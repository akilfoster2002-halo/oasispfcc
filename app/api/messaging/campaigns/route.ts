import { getSupabaseServer } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = getSupabaseServer()
  const { data, error } = await supabase
    .from('campaigns')
    .select('*, campaign_recipients(count)')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      name: string
      command?: string
      recipients: { attendee_id?: string; name: string; phone: string; generated_message: string }[]
    }

    const supabase = getSupabaseServer()

    const { data: campaign, error: ce } = await supabase
      .from('campaigns')
      .insert({ name: body.name, command: body.command ?? null, total_recipients: body.recipients.length })
      .select()
      .single()
    if (ce) return Response.json({ error: ce.message }, { status: 500 })

    if (body.recipients.length > 0) {
      const rows = body.recipients.map(r => ({
        campaign_id: campaign.id,
        attendee_id: r.attendee_id ?? null,
        name: r.name,
        phone: r.phone,
        generated_message: r.generated_message,
      }))
      const { error: re } = await supabase.from('campaign_recipients').insert(rows)
      if (re) return Response.json({ error: re.message }, { status: 500 })
    }

    return Response.json(campaign, { status: 201 })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
