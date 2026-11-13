// How to read Replicate's answer to a run request. No dependencies, so it is shared and tested on its own.

// Does this answer to "start a run" mean the model is gone for good?
export function isDiscontinued(status, body) {
  const text = `${body?.title || ''} ${body?.detail || ''} ${typeof body?.error === 'string' ? body.error : ''}`;
  if (status === 404) return true; // Replicate has no model by this name any more
  return status === 422 && /version disabled|currently disabled|discontinued|deprecated|no longer (available|supported)|retired/i.test(text);
}
// What an answer says about a model: 'dead' | 'alive' | 'limited' (asked too fast) | 'unknown'.
export function readAnswer(status, body) {
  if (isDiscontinued(status, body)) return 'dead';
  if (status === 201 || status === 200) return 'alive';                 // Replicate took the request
  if (status === 422) return 'alive';                                   // it looked at the input and refused it: the model is there
  if (status === 429) return 'limited';
  return 'unknown';
}
// An input that can never produce anything: no prompt, and every other value replaced by one the model rejects.
export function refusedInput(sample) {
  const out = { __check__: '__check__' };
  for (const [k, v] of Object.entries(sample || {})) {
    if (k === 'prompt') continue;
    out[k] = typeof v === 'string' ? '__check__' : typeof v === 'number' ? -987 : v;
  }
  return out;
}

// ---- A model that keeps failing rests for a while ----
// Real runs are counted in half-hour slots: failures the model itself caused, and successes. A model with three
// or more failures and not one success in the current and the previous slot is "resting": the site hides it, so
// nobody is sent to something that is broken right now. It comes back by itself when the slots have passed
// (30 to 60 minutes), and at once if a run of it succeeds.
export const REST_AFTER = 3;
export const REST_SLOT_MS = 30 * 60_000;
export const restSlot = (t = Date.now()) => Math.floor(t / REST_SLOT_MS);
// A run that failed because of what was asked for (blocked content) says nothing about the model's health.
export const blamesRequest = (text) => /safety|sensitive|nsfw|content policy|moderat|flagged|prohibited|not allowed|violat|inappropriate|blocked|copyright|public figure|real person|sexual/i.test(String(text || ''));
// A failure that says the provider's own access is broken (Replicate's key at OpenAI or Anthropic was revoked).
// Every run will fail the same way until they repair it, so there is no reason to wait for three.
export const providerBroken = (text) => /token_invalidated|authentication ?error|invalid[_ ]api[_ ]key|incorrect api key|api key (is )?(invalid|revoked|expired)|unauthorized/i.test(String(text || ''));
// rows: [{ key, amount }] of the counters `model:fail:<slug>:<slot>` and `model:ok:<slug>:<slot>`.
// Returns { resting: { slug: failures }, failing: Set<slug> } (failing = any failure in the two slots).
export function restingModels(rows, now = Date.now()) {
  const slot = restSlot(now), fail = {}, ok = {};
  for (const r of rows || []) {
    const m = /^model:(fail|ok):(.+):(\d+)$/.exec(r.key || '');
    if (!m || (Number(m[3]) !== slot && Number(m[3]) !== slot - 1)) continue;
    const into = m[1] === 'fail' ? fail : ok;
    into[m[2]] = (into[m[2]] || 0) + Math.max(0, Number(r.amount) || 0);
  }
  const resting = {};
  for (const [slug, n] of Object.entries(fail)) if (n >= REST_AFTER && !ok[slug]) resting[slug] = n;
  return { resting, failing: new Set(Object.keys(fail).filter((k) => fail[k] > 0)) };
}
