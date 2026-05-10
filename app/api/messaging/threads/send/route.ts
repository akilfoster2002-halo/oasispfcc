import { sendSMS } from '@/lib/clearstream'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { phone, body } = await req.json() as { phone: string; body: string }
    if (!phone || !body) return Response.json({ error: 'phone and body required' }, { status: 400 })
    const result = await sendSMS(phone, body)
    return Response.json({ ok: true, id: result.id })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
