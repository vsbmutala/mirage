/**
 * Minimal in-memory sliding-window rate limiter. Suitable for the prototype;
 * replace with Redis/Upstash for multi-instance deployments.
 */
const buckets = new Map<string, number[]>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const windowStart = now - windowMs;
  const arr = (buckets.get(key) ?? []).filter((t) => t > windowStart);
  if (arr.length >= limit) {
    const retryAfter = Math.ceil((arr[0] + windowMs - now) / 1000);
    buckets.set(key, arr);
    return { ok: false, retryAfter };
  }
  arr.push(now);
  buckets.set(key, arr);
  return { ok: true, retryAfter: 0 };
}

export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "local";
}
