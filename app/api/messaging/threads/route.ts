import { listThreads } from '@/lib/clearstream'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const threads = await listThreads()
    return Response.json(threads)
  } catch (err) {
    console.error('[threads]', err)
    return Response.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
