// Small in-process rate limiter.
//
// This is good-enough protection against signup brute-forcing on a single
// Node instance. If/when this app runs multi-instance behind a load balancer,
// swap this for Redis/Upstash. The call sites won't have to change.

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export interface RateLimitOptions {
  /** Unique key — typically `${route}:${ip}` or `${route}:${ip}:${email}`. */
  key: string
  /** Max attempts allowed in the window. */
  limit: number
  /** Window length in milliseconds. */
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  /** Milliseconds until the bucket resets. */
  retryAfterMs: number
}

export function rateLimit({ key, limit, windowMs }: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, retryAfterMs: windowMs }
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: existing.resetAt - now }
  }

  existing.count += 1
  return { allowed: true, remaining: limit - existing.count, retryAfterMs: existing.resetAt - now }
}

/** Best-effort client IP from a Next.js Request. Falls back to a constant so we still rate-limit. */
export function clientIpFrom(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

// Periodically prune stale buckets so the map doesn't grow without bound.
// Only enable in long-lived runtimes (skip in tests/edge).
if (typeof setInterval === 'function' && process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    const now = Date.now()
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k)
    }
  }, 5 * 60 * 1000).unref?.()
}
