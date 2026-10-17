// Persistent counters via Supabase (migration 003). Falls back to in-memory if the SQL isn't installed yet.
import { getSupabase } from './supabase';

const mem = new Map();
let dbReady = null; // null unknown, false missing, true ok
const today = () => new Date().toISOString().slice(0, 10);

function memBump(key, amount, limit) {
  const k = `${today()}|${key}`;
  const cur = mem.get(k) || 0;
  if (amount > 0 && cur + amount > limit) return null;
  const n = Math.max(0, cur + amount);
  mem.set(k, n);
  if (mem.size > 20000) for (const kk of mem.keys()) if (!kk.startsWith(today())) mem.delete(kk);
  return n;
}

// Returns new total, or null if the limit would be exceeded.
export async function bump(key, amount, limit) {
  const supabase = getSupabase();
  if (supabase && dbReady !== false) {
    const { data, error } = await supabase.rpc('bump_usage', { p_key: key, p_day: today(), p_amount: amount, p_limit: limit });
    if (!error) { dbReady = true; return data === null ? null : Number(data); }
    if (/bump_usage|function|schema cache|PGRST202|42883/i.test(`${error.message} ${error.code}`)) dbReady = false;
    else console.error('bump_usage error:', error);
  }
  return memBump(key, amount, limit);
}

export const usageBackend = () => (dbReady ? 'supabase' : 'memory');

// ---- Global daily spend circuit breaker ----
export const DAILY_SPEND_CAP_USD = Math.max(0, Number(process.env.DAILY_SPEND_CAP_USD) || 5);
export const PAUSED_MSG = 'PixelPulse is taking a breather — today\'s free creation budget is used up. Please come back tomorrow!';

// Reserve estimated spend. Admin is counted but never blocked. Returns { ok, release() }.
export async function reserveSpend(usd, { admin = false } = {}) {
  const amt = Math.round(usd * 10000) / 10000;
  if (!amt) return { ok: true, release: async () => {} };
  const r = await bump('spend', amt, admin ? 1e9 : DAILY_SPEND_CAP_USD);
  if (r === null) return { ok: false, release: async () => {} };
  return { ok: true, release: async () => { await bump('spend', -amt, 1e9); } };
}
