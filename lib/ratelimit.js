// Fixed-window rate limiter backed by Supabase usage_counters (bump_usage), shared by all server instances.
// Falls back to in-memory counting only if the database function is unreachable (handled inside bump()).
import { bump } from './usage';

export async function rateLimit(key, limit, windowMs) {
  const win = Math.floor(Date.now() / windowMs);
  const r = await bump(`rl:${key}:${windowMs}:${win}`, 1, limit).catch(() => 0);
  return r !== null;
}
