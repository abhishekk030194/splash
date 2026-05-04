/**
 * Simple in-memory IP rate limiter for Next.js API routes.
 *
 * Lives at the serverless-function level — resets on cold starts,
 * which is acceptable for a small-scale app. Upgrade to Upstash Redis
 * if you need persistent rate limiting across instances at scale.
 */

interface Record {
  count: number
  resetAt: number
}

const store = new Map<string, Record>()

// Clean up expired entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now()
  for (const [key, rec] of store) {
    if (now > rec.resetAt) store.delete(key)
  }
}, 5 * 60 * 1000)

/**
 * Returns true if the request is allowed, false if rate limit exceeded.
 *
 * @param key       Unique identifier — typically `"route:ip"`
 * @param limit     Max requests allowed in the window
 * @param windowMs  Window duration in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const rec = store.get(key)

  if (!rec || now > rec.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (rec.count >= limit) return false

  rec.count++
  return true
}

/** Extract the real client IP from Next.js request headers */
export function getIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}
