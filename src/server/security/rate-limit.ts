/**
 * In-memory sliding-window rate limiter.
 *
 * On serverless (Vercel) each instance has its own memory — documented in the README
 * as a known limitation; set `RATE_LIMIT_REDIS_URL` to move to a shared store later.
 * For local/production self-hosted Node this is fully sufficient.
 */

interface Bucket {
  timestamps: number[];
}

const store = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number, windowMs: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of store) {
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
    if (bucket.timestamps.length === 0) store.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now, windowMs);
  let bucket = store.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    store.set(key, bucket);
  }
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0]!;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return { ok: false, remaining: 0, retryAfterSec };
  }
  bucket.timestamps.push(now);
  return { ok: true, remaining: limit - bucket.timestamps.length, retryAfterSec: 0 };
}

export const RATE_LIMITS = {
  oauthStart: { limit: 20, windowMs: 60_000 },
  oauthCallback: { limit: 20, windowMs: 60_000 },
  write: { limit: 60, windowMs: 60_000 },
  read: { limit: 300, windowMs: 60_000 },
  search: { limit: 60, windowMs: 60_000 },
  authSensitive: { limit: 5, windowMs: 60_000 },
  integration: { limit: 120, windowMs: 60_000 },
} as const;
