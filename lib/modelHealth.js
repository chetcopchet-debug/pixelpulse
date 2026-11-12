// Is each model still running at Replicate? A provider can switch a model off ("discontinued"); Replicate then
// refuses every run of it. Nothing in the model's description says so, so the only way to know is the answer to
// a run request. This file keeps what was learned (in the usage counters, no new table) and can ask on purpose.
import { bump, FOREVER } from './usage.js';
import { getSupabase } from './supabase.js';

const DEAD = 'model:dead:', SEEN = 'model:seen:', ERR = 'model:err:';

export { isDiscontinued, readAnswer, refusedInput } from './modelHealthCore.js';
import { readAnswer, refusedInput } from './modelHealthCore.js';

export async function markDead(slug) { cache = null; await bump(DEAD + slug, 1, 1, FOREVER).catch(() => {}); console.error('MODEL DISCONTINUED', slug); }
export async function markAlive(slug) { cache = null; await bump(DEAD + slug, -1, 1e9, FOREVER).catch(() => {}); await bump(SEEN + slug, 1, 1e9).catch(() => {}); }
// Replicate answered the question with an error of its own (500). Not "running" and not "discontinued": noted for the day.
export async function markTrouble(slug) { cache = null; await bump(ERR + slug, 1, 1e9).catch(() => {}); }

// { dead: Set<slug>, seen: { slug: 'YYYY-MM-DD' }, trouble: { slug: 'YYYY-MM-DD' } }. Read at most once a minute per server instance.
let cache = null;
export async function modelHealth() {
  if (cache && Date.now() - cache.at < 60_000) return cache.v;
  const v = { dead: new Set(), seen: {}, trouble: {} };
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.from('usage_counters').select('key, day, amount').like('key', 'model:%').order('day', { ascending: false }).limit(2000);
    if (!error) for (const r of data || []) {
      if (r.key.startsWith(DEAD)) { if (Number(r.amount) > 0) v.dead.add(r.key.slice(DEAD.length)); }
      else if (r.key.startsWith(SEEN)) { const s = r.key.slice(SEEN.length); if (!v.seen[s]) v.seen[s] = String(r.day).slice(0, 10); }
      else if (r.key.startsWith(ERR)) { const s = r.key.slice(ERR.length); if (!v.trouble[s]) v.trouble[s] = String(r.day).slice(0, 10); }
    }
  }
  cache = { at: Date.now(), v };
  return v;
}
export async function isDeadSlug(slug) { return (await modelHealth().catch(() => ({ dead: new Set() }))).dead.has(slug); }

// Asks Replicate about one model. Nothing is generated: the input is one the model refuses, and if Replicate
// queues it anyway (a few models check the input later) the request is cancelled at once.
export async function probe(slug, sample, { tries = 3, token = process.env.REPLICATE_API_TOKEN } = {}) {
  if (!token) return { state: 'unknown', detail: 'no Replicate token' };
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  let last = { state: 'unknown', detail: 'no answer' };
  for (let t = 0; t < tries; t++) {
    let res, d = {};
    try {
      res = await fetch(`https://api.replicate.com/v1/models/${slug}/predictions`, { method: 'POST', headers, cache: 'no-store', body: JSON.stringify({ input: refusedInput(sample) }) });
      d = await res.json().catch(() => ({}));
    } catch { last = { state: 'unknown', detail: 'could not reach Replicate' }; continue; }
    if (d?.urls?.cancel) await fetch(d.urls.cancel, { method: 'POST', headers }).catch(() => {});
    const state = readAnswer(res.status, d);
    last = { state, status: res.status, detail: state === 'dead' ? String(d.detail || d.title || 'discontinued').replace(/\s+/g, ' ').slice(0, 200) : state === 'limited' ? 'Replicate is limiting how fast we can ask' : state === 'unknown' ? `Replicate answered with an error of its own (${res.status}). This may pass; a real run may fail meanwhile.` : '' };
    if (state !== 'limited') break;
    await new Promise((r) => setTimeout(r, Math.min(12, (Number(d.retry_after) || 10) + 1) * 1000));
  }
  if (last.state === 'dead') await markDead(slug); else if (last.state === 'alive') await markAlive(slug); else if (last.state === 'unknown' && last.status >= 500) await markTrouble(slug);
  return last;
}
