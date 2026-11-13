// Persistent counters via Supabase (migration 003). Falls back to in-memory if the SQL isn't installed yet.
import { getSupabase } from './supabase';

const mem = new Map();
let dbReady = null; // null unknown, false missing, true ok
const today = () => new Date().toISOString().slice(0, 10);
export const FOREVER = '9999-12-31'; // "day" for counters that never reset (the guest trial)

function memBump(key, amount, limit, day) {
  const k = `${day || today()}|${key}`;
  const cur = mem.get(k) || 0;
  if (amount > 0 && cur + amount > limit) return null;
  const n = Math.max(0, cur + amount);
  mem.set(k, n);
  if (mem.size > 20000) for (const kk of mem.keys()) if (!kk.startsWith(today()) && !kk.startsWith(FOREVER)) mem.delete(kk);
  return n;
}

// Returns new total, or null if the limit would be exceeded. `day` defaults to today (UTC); pass FOREVER for a lifetime counter.
export async function bump(key, amount, limit, day) {
  const supabase = getSupabase();
  if (supabase && dbReady !== false) {
    const { data, error } = await supabase.rpc('bump_usage', { p_key: key, p_day: day || today(), p_amount: amount, p_limit: limit });
    if (!error) { dbReady = true; return data === null ? null : Number(data); }
    if (/bump_usage|function|schema cache|PGRST202|42883/i.test(`${error.message} ${error.code}`)) dbReady = false;
    else console.error('bump_usage error:', error);
  }
  return memBump(key, amount, limit, day);
}

export const usageBackend = () => (dbReady ? 'supabase' : 'memory');

// ---- Global daily spend circuit breaker ----
export const DAILY_SPEND_CAP_USD = Math.max(0, Number(process.env.DAILY_SPEND_CAP_USD) || 5);
export const PAUSED_MSG = 'Yelvo is taking a breather — today\'s free creation budget is used up. Please come back tomorrow! / התקציב היומי נגמר, נסו שוב מחר.';

// Reserve estimated spend. Returns { ok, release() }.
// The cap is a budget for what the site gives away: creations made with free credits. Only those are counted
// against it ('spend'). Work that is paid for (bought credits, the admin) and the small helpers around a creation
// are counted apart ('spend:paid') and never blocked, so a busy day of paid work does not use up the free budget
// and a full free budget stops nothing that was paid for. `admin`: this spend is of that second kind.
export const PAID_SPEND_KEY = 'spend:paid';
export async function reserveSpend(usd, { admin = false } = {}) {
  const amt = Math.round(usd * 10000) / 10000;
  if (!amt) return { ok: true, release: async () => {} };
  const key = admin ? PAID_SPEND_KEY : 'spend';
  const r = await bump(key, amt, admin ? 1e9 : DAILY_SPEND_CAP_USD);
  if (r === null) return { ok: false, release: async () => {} };
  return { ok: true, release: async () => { await bump(key, -amt, 1e9); } };
}
