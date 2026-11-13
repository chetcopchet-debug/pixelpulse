// Is each model still running at Replicate? A provider can switch a model off ("discontinued"); Replicate then
// refuses every run of it. Nothing in the model's description says so, so the only way to know is the answer to
// a run request. This file keeps what was learned (in the usage counters, no new table) and can ask on purpose.
import { bump, FOREVER } from './usage.js';
import { getSupabase } from './supabase.js';
import { MODEL_TIERS } from './models.js';

const DEAD = 'model:dead:', SEEN = 'model:seen:', ERR = 'model:err:', DOWN = 'model:down:';
// Image models can be tried again for a few cents, so one that is down stays down until a real image succeeds.
const IMAGE_SLUGS = new Set(Object.values(MODEL_TIERS).map((t) => t.model));

export { isDiscontinued, readAnswer, refusedInput } from './modelHealthCore.js';
import { readAnswer, refusedInput, restingModels, restSlot, blamesRequest, providerBroken } from './modelHealthCore.js';

export async function markDead(slug) { cache = null; await bump(DEAD + slug, 1, 1, FOREVER).catch(() => {}); console.error('MODEL DISCONTINUED', slug); }
export async function markAlive(slug) { cache = null; await bump(DEAD + slug, -1, 1e9, FOREVER).catch(() => {}); await bump(SEEN + slug, 1, 1e9).catch(() => {}); }
// Replicate answered the question with an error of its own (500). Not "running" and not "discontinued": noted for the day.
export async function markTrouble(slug) { cache = null; await bump(ERR + slug, 1, 1e9).catch(() => {}); }

// An image model is "down": its runs fail for a reason of its own. It is shown as temporarily unavailable until a
// real image succeeds again (the daily check tries one, see app/api/cron/models). Asking Replicate "do you still
// run this?" is not enough here: Replicate says yes while every run fails inside the model.
export async function markDown(slug) { cache = null; await bump(DOWN + slug, 1, 1, FOREVER).catch(() => {}); console.error('MODEL DOWN', slug); }
export async function markUp(slug) { cache = null; await bump(DOWN + slug, -1, 1e9, FOREVER).catch(() => {}); console.log('MODEL BACK', slug); }

// A real run of a model just ended: it worked, or it failed (`why` is the provider's message). Three failures in a
// row with no success in between put the model to rest for a while (lib/modelHealthCore.js). An image model goes
// further: it is marked down, at once when the message says the provider's own access is broken, otherwise when
// it starts to rest. One success brings it back.
export async function noteRun(slug, ok, why) {
  if (!slug) return;
  try {
    if (ok) { const h = await modelHealth(); if (h.down.has(slug)) await markUp(slug); if (!h.failing.has(slug)) return; } // nothing more to clear
    else if (blamesRequest(why)) return;
    cache = null;
    await bump(`model:${ok ? 'ok' : 'fail'}:${slug}:${restSlot()}`, 1, 1e9);
    if (ok) return;
    console.error('MODEL RUN FAILED', slug, String(why || '').replace(/\s+/g, ' ').slice(0, 140));
    if (IMAGE_SLUGS.has(slug)) { const h = await modelHealth(); if (!h.down.has(slug) && (providerBroken(why) || h.resting[slug])) await markDown(slug); }
  } catch { /* health notes must never break a run */ }
}

// { dead: Set<slug>, down: Set<slug>, seen: { slug: 'YYYY-MM-DD' }, trouble: { slug: 'YYYY-MM-DD' }, resting: { slug: failures }, failing: Set<slug> }.
// Read at most once a minute per server instance.
let cache = null;
export async function modelHealth() {
  if (cache && Date.now() - cache.at < 60_000) return cache.v;
  const v = { dead: new Set(), down: new Set(), seen: {}, trouble: {}, resting: {}, failing: new Set() };
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.from('usage_counters').select('key, day, amount').like('key', 'model:%').order('day', { ascending: false }).limit(2000);
    if (!error) for (const r of data || []) {
      if (r.key.startsWith(DEAD)) { if (Number(r.amount) > 0) v.dead.add(r.key.slice(DEAD.length)); }
      else if (r.key.startsWith(DOWN)) { if (Number(r.amount) > 0) v.down.add(r.key.slice(DOWN.length)); }
      else if (r.key.startsWith(SEEN)) { const s = r.key.slice(SEEN.length); if (!v.seen[s]) v.seen[s] = String(r.day).slice(0, 10); }
      else if (r.key.startsWith(ERR)) { const s = r.key.slice(ERR.length); if (!v.trouble[s]) v.trouble[s] = String(r.day).slice(0, 10); }
    }
    if (!error) Object.assign(v, restingModels(data || []));
  }
  cache = { at: Date.now(), v };
  return v;
}
// Should a run of this model be refused right now? Switched off by its provider, or down.
export async function isDeadSlug(slug) { const h = await modelHealth().catch(() => null); return Boolean(h && (h.dead.has(slug) || h.down.has(slug))); }

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
