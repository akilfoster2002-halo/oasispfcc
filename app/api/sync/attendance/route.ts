import { syncAllFeeds } from '@/lib/sync-calendars'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 min timeout (Render supports this)

export async function POST(req: Request) {
  // Verify secret token
  const auth = req.headers.get('authorization') ?? ''
  const secret = process.env.SYNC_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date().toISOString().split('T')[0]
  const threeWeeksAgo = (() => {
    const d = new Date()
    d.setDate(d.getDate() - 21)
    return d.toISOString().split('T')[0]
  })()

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') ?? threeWeeksAgo
  const to   = searchParams.get('to')   ?? today

  console.log(`[sync/attendance] Running full sync ${from} → ${to}`)

  try {
    const results = await syncAllFeeds(from, to, msg => console.log(msg))

    const totals = results.reduce(
      (acc, r) => ({
        meetingsCreated: acc.meetingsCreated + r.meetingsCreated,
        attendanceAdded: acc.attendanceAdded + r.attendanceAdded,
        errors: acc.errors + r.errors,
      }),
      { meetingsCreated: 0, attendanceAdded: 0, errors: 0 }
    )

    // Log any per-event errors so they appear in Render logs
    for (const r of results) {
      for (const e of r.errorDetails) console.error(`[sync/attendance] ${e}`)
    }

    console.log(`[sync/attendance] Done — ${totals.meetingsCreated} meetings, ${totals.attendanceAdded} attendance, ${totals.errors} errors`)
    return Response.json({ ok: true, from, to, results, totals })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[sync/attendance] Error:', msg)
    return Response.json({ error: msg }, { status: 500 })
  }
}
