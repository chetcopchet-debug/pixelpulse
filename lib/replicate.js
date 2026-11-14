import { isDiscontinued, markDead } from './modelHealth';
import { bump } from './usage';

// Replicate has no API for the account balance, but its refusals say when money is the reason. They are counted
// per day so /admin can warn the owner: 'low' = starts are being slowed because the balance is under $5,
// 'empty' = runs are refused because the credit is used up.
const LOW_BALANCE = /less than \$?\s?5(\.0+)? in credit/i;
const NO_BALANCE = /insufficient credit|out of credit|purchase credit|payment required/i;
async function noteBilling(res) {
  if (res.ok || (res.status !== 429 && res.status !== 402)) return;
  await noteBillingInfo(res.status, await res.clone().json().catch(() => ({})));
}
// The same, for a caller that already read the answer (the prompt translator starts its own runs).
export async function noteBillingInfo(status, info) {
  if (status !== 429 && status !== 402) return;
  const text = `${info?.title || ''} ${info?.detail || ''}`;
  if (status === 402 || NO_BALANCE.test(text)) await bump('replicate:empty', 1, 1e9).catch(() => {});
  else if (LOW_BALANCE.test(text)) await bump('replicate:low', 1, 1e9).catch(() => {});
}
// Today's counts of those refusals: { low, empty }.
export async function billingWarnings() {
  const read = (k) => bump(k, 0, 1e9).then((n) => Number(n) || 0, () => 0);
  return { low: await read('replicate:low'), empty: await read('replicate:empty') };
}
// Who the API token belongs to (also proves the token works). null if Replicate did not answer.
export async function replicateAccount() {
  if (!process.env.REPLICATE_API_TOKEN) return null;
  try {
    const r = await fetch('https://api.replicate.com/v1/account', { cache: 'no-store', headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` } });
    if (!r.ok) return { error: `Replicate answered ${r.status}` };
    const d = await r.json();
    return { name: d.username || d.name || 'unknown', type: d.type || '' };
  } catch { return null; }
}

// Starting a run can be refused with 429 ("Request was throttled") when the Replicate account is rate limited;
// accounts with less than $5 of credit are held to 6 starts a minute, one at a time. The answer says how long to
// wait, so wait that long (a few seconds) and try again instead of failing the person's request. `tries` counts all attempts;
// image routes keep it at 2 so one request still fits in a function's time limit.
export async function replicateStart(url, init, { tries = 2, maxWaitMs = 12_000 } = {}) {
  let res;
  for (let i = 0; i < tries; i++) {
    res = await fetch(url, { cache: 'no-store', ...init });
    await noteBilling(res);
    if (res.status !== 429 || i === tries - 1) return res;
    const info = await res.clone().json().catch(() => ({}));
    const wait = Math.min(maxWaitMs, (Number(info?.retry_after) || Number(res.headers.get('retry-after')) || 8) * 1000 + 600);
    console.error('Replicate throttled, waiting', wait, 'ms:', String(info?.detail || '').slice(0, 160));
    await new Promise((r) => setTimeout(r, wait));
  }
  return res;
}
export const THROTTLED_MSG = 'The model service is limiting how fast we can start runs right now. Wait a few seconds and try again.';

// Generic server-side Replicate runner (Prefer: wait + short polling).
// Pass `model` ("owner/name", official models endpoint) or `version` (64-hex id, community models).
export async function runReplicate({ model, version, input, budgetMs = 50_000 }) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return { error: 'config' };
  const url = version ? 'https://api.replicate.com/v1/predictions' : `https://api.replicate.com/v1/models/${model}/predictions`;
  const started = Date.now();
  let res;
  // The time given is kept: Replicate is asked to hold the request no longer than that, and the request itself
  // is dropped a moment after. (It used to be held for up to 30 seconds whatever the budget, which could carry a
  // caller past its own time limit, where nothing can be refunded any more.)
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), budgetMs + 1500);
  try {
    res = await replicateStart(url, {
      method: 'POST', signal: ctl.signal,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: `wait=${Math.max(1, Math.min(30, Math.floor(budgetMs / 1000)))}` },
      body: JSON.stringify(version ? { version, input } : { input }),
    }, { maxWaitMs: Math.min(12_000, Math.max(1000, budgetMs / 2)) });
  } catch (e) {
    if (e?.name === 'AbortError') return { error: 'timeout' };
    console.error('Replicate network error:', e); return { error: 'upstream' };
  } finally { clearTimeout(timer); }
  let p = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Replicate error:', res.status, p);
    if (model && isDiscontinued(res.status, p)) { await markDead(model); return { error: 'discontinued' }; }
    return { error: res.status === 429 ? 'throttled' : 'upstream' };
  }
  while (!['succeeded', 'failed', 'canceled'].includes(p.status) && p.urls?.get && Date.now() - started < budgetMs) {
    await new Promise((r) => setTimeout(r, 1200));
    const s = await fetch(p.urls.get, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }).catch(() => null);
    if (s && s.ok) p = await s.json();
  }
  if (p.status === 'succeeded') return { output: p.output };
  if (p.status === 'failed' || p.status === 'canceled') { console.error('Prediction failed:', p.error); return { error: 'failed', detail: String(p.error || '').replace(/\s+/g, ' ').slice(0, 240) }; }
  return { error: 'timeout' };
}

export const TOOLS = {
  // Official model, ~$0.002/image (T4). 2x upscale.
  sharpen: { model: 'nightmareai/real-esrgan', input: (image) => ({ image, scale: 2, face_enhance: false }) },
  // Community model, pinned version, ~$0.00047/run (T4).
  cutout: { version: 'a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc',
    input: (image) => ({ image, format: 'png', background_type: 'rgba' }) },
  // Edit an area. Both were run on what the site sends (a cut-out part of an image and its mask) and both
  // returned a picture of exactly that size.
  // First choice: Ideogram 4.5. Its mask is read the other way round: BLACK = change, white = keep.
  repaint: { model: 'ideogram-ai/ideogram-4-5', blackChanges: true,
    input: (image, mask, prompt) => ({ prompt, images: [image], mask, quality: 'medium', num_images: 1 }) },
  // Backup when the first choice fails: FLUX Fill Pro, $0.05/image. White mask = change.
  repaintBackup: { model: 'black-forest-labs/flux-fill-pro',
    input: (image, mask, prompt) => ({ image, mask, prompt, steps: 50, guidance: 60, output_format: 'png', safety_tolerance: 2, prompt_upsampling: false }) },
  // Official model, $0.04/image. Instruction edit ("make it night"), keeps the rest of the image.
  edit: { model: 'black-forest-labs/flux-kontext-pro',
    input: (image, prompt) => ({ prompt, input_image: image, aspect_ratio: 'match_input_image', output_format: 'png', safety_tolerance: 2, prompt_upsampling: false }) },
  // Official model, billed per token (fractions of a cent per call).
  amplify: { model: 'meta/meta-llama-3-8b-instruct' },
  // Prompt translation (any language -> English). Tried in this order; both were checked on a Hebrew prompt with
  // an on-image text in quotes, which the small Llama model got wrong. Billed per token, a fraction of a cent.
  translate: { models: ['openai/gpt-5-nano', 'google/gemini-3-flash'] },
  // The improve button, standard: Gemini 3 Flash ($0.50 / $3 per million tokens, Replicate model page), nano as backup.
  improve: { models: ['google/gemini-3-flash', 'openai/gpt-5-nano'] },
  // The improve button, Pro: the strongest language models on Replicate, the first that answers. Prices per
  // million tokens (input / output), read on each Replicate model page, Nov 2026: GPT-5 $1.25 / $10,
  // Claude Sonnet 5 $2 / $10, Gemini 3.1 Pro $2 / $12. One press is about 900 tokens in and 350 out:
  // $0.0046, $0.0053 and $0.006 at most, against the $0.0057 one credit stands for. `extra` keeps each model short.
  improvePro: { cost: 1, usd: 0.0057, models: ['anthropic/claude-sonnet-5', 'openai/gpt-5', 'google/gemini-3.1-pro'], // Sonnet first: on the test site it answered in about 8 seconds, GPT-5 in 12 or more
    extra: { 'openai/gpt-5': { reasoning_effort: 'low', max_completion_tokens: 900 }, 'google/gemini-3.1-pro': { thinking_level: 'low', max_output_tokens: 900 } } },
};

export const firstUrl = (out) => (Array.isArray(out) ? out[0] : typeof out === 'string' ? out : out?.url || null);
