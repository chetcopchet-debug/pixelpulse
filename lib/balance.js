// An estimate of the Replicate balance. Replicate's API does not give the balance, so the owner types it in
// after adding credit, and from then on the site subtracts what it counts as spent (the same daily totals the
// limits use: creations on free credits, paid work, translating and improving).
// It is an estimate: the site counts each run at its list price, and Replicate's real charge can differ a little.
// Kept in the counters table the site already has, as three lasting counters: the amount typed in, the day it
// was typed in, and what had already been counted that day at that moment.
import { bump, FOREVER, FREE_SPEND_KEY, PAID_SPEND_KEY, HELP_SPEND_KEY } from './usage';
import { getSupabase } from './supabase';

export const LOW_BALANCE_USD = 6; // /admin warns below this
const KEYS = { usd: 'replbal:usd', day: 'replbal:day', base: 'replbal:base' };
const dayNum = (d = new Date()) => Number(d.toISOString().slice(0, 10).replace(/-/g, ''));
const dayText = (n) => { const s = String(n); return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`; };

// Pure: what is left. entered: the amount typed in; counted: everything counted since the start of that day;
// base: what had been counted that day before the amount was typed in.
export function estimateLeft(entered, counted, base) {
  const spent = Math.max(0, (Number(counted) || 0) - (Number(base) || 0));
  return { spent: Math.round(spent * 100) / 100, left: Math.round(((Number(entered) || 0) - spent) * 100) / 100 };
}

const read = async (key) => Number(await bump(key, 0, 1e12, FOREVER).catch(() => 0)) || 0;
const setTo = async (key, value) => { const cur = await read(key); if (value !== cur) await bump(key, value - cur, 1e12, FOREVER); };
// Everything the site counted as spent from the start of day `fromDay` (yyyy-mm-dd, UTC) until now.
async function countedSince(fromDay) {
  const sb = getSupabase();
  if (!sb) return 0;
  const { data, error } = await sb.from('usage_counters').select('amount').in('key', [FREE_SPEND_KEY, PAID_SPEND_KEY, HELP_SPEND_KEY]).gte('day', fromDay).lt('day', '9000-01-01').limit(5000);
  if (error) { console.error('balance estimate:', error.message); return 0; }
  return (data || []).reduce((a, r) => a + (Number(r.amount) || 0), 0);
}

// The owner typed in the balance (after adding credit, or to correct the estimate).
export async function setBalance(usd) {
  const today = dayNum();
  const base = await countedSince(dayText(today));
  await setTo(KEYS.usd, Math.round(usd * 100) / 100); await setTo(KEYS.day, today); await setTo(KEYS.base, Math.round(base * 10000) / 10000);
}
// null when no balance was ever typed in. Otherwise { entered, since, spent, left, low }.
export async function balanceEstimate() {
  const day = await read(KEYS.day);
  if (!day) return null;
  const [entered, base] = [await read(KEYS.usd), await read(KEYS.base)];
  const out = estimateLeft(entered, await countedSince(dayText(day)), base);
  return { entered, since: dayText(day), ...out, low: out.left < LOW_BALANCE_USD };
}
