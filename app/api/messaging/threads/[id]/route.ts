import { getThreadReplies } from '@/lib/clearstream'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const replies = await getThreadReplies(id)
    return Response.json(replies)
  } catch (err) {
    console.error('[thread-replies]', err)
    return Response.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { phone, body } = await req.json() as { phone: string; body: string }

  if (!phone || !body) return Response.json({ error: 'phone and body required' }, { status: 400 })

  const { sendSMS } = await import('@/lib/clearstream')
  try {
    const result = await sendSMS(phone, body)
    return Response.json({ ok: true, id: result.id })
  } catch (err) {
    console.error('[thread-reply]', err)
    return Response.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
