// Server-side video job lifecycle (migration 010 `video_jobs`). A paid video is saved (or refunded) by whichever
// arrives first: the Replicate webhook, the client poll, or the daily sweep cron. Each transition is claimed atomically
// in video_jobs, so a refund or a save happens exactly once. If the table is missing (migration not run yet), the old
// per-day usage_counters locks are used as a fallback.
import crypto from 'crypto';
import { bump } from './usage';
import { grantPaid } from './paid';
import { persistBytes } from './generation';
import { effectById } from './effects';
import { SITE_URL } from './site';

export const fileFor = (pred) => crypto.createHash('sha256').update(`anim.${pred}`).digest('hex').slice(0, 32);
export const pathFor = (pred) => `i/${fileFor(pred)}.mp4`;
export const ITEM_COLS = 'id, public_url, prompt, style, aspect_ratio, remix_of, is_public, likes, model';
export const toItem = (r) => ({ ...r, model: r.model || 'animate', is_public: Boolean(r.is_public), likes: r.likes || 0 });
const SAVE_LOCK_MS = 3 * 60_000;
const missingTable = (e) => /video_jobs|42P01|PGRST205/i.test(`${e?.message} ${e?.code}`);

// Public HTTPS URL Replicate should call when a prediction completes (null = polling only, e.g. local dev).
export function webhookUrl(env = process.env) {
  const base = (env.REPLICATE_WEBHOOK_BASE_URL || env.NEXT_PUBLIC_SITE_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : '') || SITE_URL || '').replace(/\/+$/, '');
  return /^https:\/\/[^/]+/.test(base) && !/localhost|127\.0\.0\.1/.test(base) ? `${base}/api/webhooks/replicate` : null;
}
export function webhookFields(env = process.env) {
  const url = webhookUrl(env);
  return url ? { webhook: url, webhook_events_filter: ['completed'] } : {};
}

// Replicate webhooks follow the Standard Webhooks spec: HMAC-SHA256 over "id.timestamp.body" with the base64 part of
// the "whsec_..." secret; header "webhook-signature" holds space-separated "v1,<base64>" entries.
export function verifyReplicateSignature({ id, timestamp, signature, body, secret, now = Date.now(), toleranceSec = 300 }) {
  if (!secret || !id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > toleranceSec) return false;
  const key = Buffer.from(String(secret).replace(/^whsec_/, ''), 'base64');
  const expected = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest();
  return String(signature).split(' ').some((part) => {
    const [ver, sig] = part.split(',');
    if (ver !== 'v1' || !sig) return false;
    const got = Buffer.from(sig, 'base64');
    return got.length === expected.length && crypto.timingSafeEqual(got, expected);
  });
}

// Job fields <-> DB row. Fields: p pred id, u uid, s source image, c paid credits, e effect, t t2v model, pr prompt, r ratio.
export const rowToJob = (r) => ({ p: r.pred_id, u: r.uid, s: r.source_id || null, c: r.cost || 0, e: r.effect || undefined, t: r.t2v_model || undefined, pr: r.prompt || undefined, r: r.ratio || undefined });
export const jobToRow = (j) => ({ pred_id: j.p, uid: j.u, source_id: j.s || null, cost: j.c || 0, effect: j.e || null, t2v_model: j.t || null, prompt: j.pr || null, ratio: j.r || null, status: 'processing' });

export async function recordJob(sb, job) {
  if (!sb) return false;
  const { error } = await sb.from('video_jobs').upsert(jobToRow(job), { onConflict: 'pred_id', ignoreDuplicates: true });
  if (error) { if (!missingTable(error)) console.error('video_jobs insert', error.message); return false; }
  return true;
}

// Atomically move a job from one of `from` statuses to `to`. Returns true if THIS caller won the transition.
async function claim(sb, pred, from, to, fallbackKey, extra = {}) {
  const { data: row, error } = await sb.from('video_jobs').select('status, updated_at').eq('pred_id', pred).maybeSingle();
  if (error || !row) { // no table / job created before migration 010: old per-day lock
    if (error && !missingTable(error)) console.error('video_jobs claim', error.message);
    return (await bump(fallbackKey, 1, 1)) !== null;
  }
  let q = sb.from('video_jobs').update({ status: to, updated_at: new Date().toISOString(), ...extra }).eq('pred_id', pred);
  const stale = row.status === 'saving' && Date.parse(row.updated_at) < Date.now() - SAVE_LOCK_MS;
  if (stale && from.includes('processing')) q = q.in('status', [...from, 'saving']).eq('updated_at', row.updated_at);
  else q = q.in('status', from);
  const { data, error: ue } = await q.select('pred_id');
  if (ue) { console.error('video_jobs update', ue.message); return false; }
  return Array.isArray(data) && data.length > 0;
}
async function release(sb, pred, fallbackKey) {
  const { error } = await sb.from('video_jobs').update({ status: 'processing', updated_at: new Date().toISOString() }).eq('pred_id', pred).eq('status', 'saving');
  if (error) await bump(fallbackKey, -1, 1e9).catch(() => {});
  else await bump(fallbackKey, -1, 1e9).catch(() => {});
}
async function refundOnce(sb, job, reason) {
  const won = await claim(sb, job.p, ['processing', 'saving'], 'refunded', `animref:${job.p}`, { error: String(reason || '').slice(0, 200) });
  if (won && job.c > 0) await grantPaid(job.u, job.c).catch((e) => console.error('video refund', e));
  return won;
}

export async function fetchPrediction(pred, token = process.env.REPLICATE_API_TOKEN) {
  const r = await fetch(`https://api.replicate.com/v1/predictions/${encodeURIComponent(pred)}`, { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
  return r && r.ok ? r.json().catch(() => null) : null;
}
export async function cancelPrediction(pred, token = process.env.REPLICATE_API_TOKEN) {
  if (!pred || !token) return;
  await fetch(`https://api.replicate.com/v1/predictions/${encodeURIComponent(pred)}/cancel`, { method: 'POST', cache: 'no-store', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
}

// Drive one job forward given the latest prediction object. Returns { status: processing|done|failed, item?, error? }.
export async function advanceJob(sb, job, p) {
  const path = pathFor(job.p);
  const existing = async () => { const { data } = await sb.from('images').select(ITEM_COLS).eq('storage_path', path).maybeSingle(); return data; };
  const have = await existing();
  if (have) { await sb.from('video_jobs').update({ status: 'done', image_id: have.id, updated_at: new Date().toISOString() }).eq('pred_id', job.p).neq('status', 'done').then(() => {}, () => {}); return { status: 'done', item: toItem(have) }; }
  const failMsg = `The video failed${job.c ? ', your credits were refunded' : ''}.`;
  if (!p) return { status: 'processing' };
  if (p.status === 'failed' || p.status === 'canceled') {
    await refundOnce(sb, job, p.error || p.status);
    return { status: 'failed', error: failMsg };
  }
  if (p.status !== 'succeeded') return { status: 'processing' };
  const url = Array.isArray(p.output) ? p.output[0] : typeof p.output === 'string' ? p.output : null;
  if (!url) { await refundOnce(sb, job, 'no output'); return { status: 'failed', error: failMsg }; }
  if (!await claim(sb, job.p, ['processing'], 'saving', `animsave:${job.p}`)) {
    const { data: st } = await sb.from('video_jobs').select('status').eq('pred_id', job.p).maybeSingle();
    if (st?.status === 'refunded') return { status: 'failed', error: failMsg };
    return { status: 'processing' }; // someone else is saving it
  }
  try {
    const v = await fetch(url, { cache: 'no-store' });
    if (!v.ok) throw new Error(`download ${v.status}`);
    const bytes = Buffer.from(await v.arrayBuffer());
    const { data: src0 } = job.s ? await sb.from('images').select('prompt, style, aspect_ratio').eq('id', job.s).maybeSingle() : { data: null };
    const fx = job.e ? effectById(job.e) : null;
    const src = fx ? { prompt: `✦ Pulse Effect: ${fx.name}`, style: 'None', aspect_ratio: '9:16' } : (src0 || (job.pr ? { prompt: job.pr, style: 'None', aspect_ratio: job.r || '16:9' } : null));
    const stored = await persistBytes({ bytes, contentType: 'video/mp4', prompt: src?.prompt || 'Animated image', style: src?.style || 'None',
      ratio: src?.aspect_ratio || '1:1', creatorId: job.u, remixOf: job.s || null, tier: job.e ? `effect:${job.e}` : job.t ? `video:${job.t}` : 'animate', fixedName: fileFor(job.p) });
    if (!stored?.id) throw new Error(stored?.error || 'save failed');
    await sb.from('video_jobs').update({ status: 'done', image_id: stored.id, updated_at: new Date().toISOString() }).eq('pred_id', job.p).then(() => {}, () => {});
    const row = await existing();
    return { status: 'done', item: toItem(row || { id: stored.id, public_url: stored.url, prompt: src?.prompt, style: src?.style, aspect_ratio: src?.aspect_ratio, remix_of: job.s }) };
  } catch (e) {
    console.error('video save', e?.message || e);
    await release(sb, job.p, `animsave:${job.p}`);
    return { status: 'processing' };
  }
}

// Daily safety net: finish or refund jobs that nobody polled and whose webhook never arrived.
export async function sweepJobs(sb, { olderThanMs = 10 * 60_000, giveUpMs = 6 * 3600_000, limit = 50, fetchPred = fetchPrediction } = {}) {
  const out = { checked: 0, done: 0, refunded: 0 };
  const { data: rows, error } = await sb.from('video_jobs').select('*').in('status', ['processing', 'saving'])
    .lt('created_at', new Date(Date.now() - olderThanMs).toISOString()).order('created_at').limit(limit);
  if (error) { if (!missingTable(error)) console.error('sweep', error.message); return out; }
  for (const r of rows || []) {
    out.checked++;
    const job = rowToJob(r);
    let p = await fetchPred(job.p);
    // Replicate deletes predictions after ~1h; an old job that cannot be fetched is refunded.
    if (!p && Date.parse(r.created_at) < Date.now() - giveUpMs) p = { status: 'failed', error: 'expired' };
    const res = await advanceJob(sb, job, p);
    if (res.status === 'done') out.done++;
    if (res.status === 'failed') out.refunded++;
  }
  return out;
}
