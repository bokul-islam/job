/**
 * Simple in-memory sliding-window rate limiter.
 * Suitable for a single-instance MVP. For multi-instance production,
 * back this with Redis or Cloudflare Workers KV.
 */
type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
  if (bucket.timestamps.length >= limit) {
    buckets.set(key, bucket);
    const retryAfter = Math.ceil((windowMs - (now - bucket.timestamps[0])) / 1000);
    return { ok: false, retryAfter };
  }
  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return { ok: true };
}

export function assertRateLimit(key: string, limit: number, windowMs: number) {
  const { ok, retryAfter } = rateLimit(key, limit, windowMs);
  if (!ok) {
    throw new Error(`Too many requests. Please try again in ${retryAfter ?? 60} seconds.`);
  }
}
