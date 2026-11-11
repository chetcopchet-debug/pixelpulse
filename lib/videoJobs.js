// Video jobs are finished by the SERVER, not by the browser tab.
// Replicate calls /api/webhooks/replicate when a video is done; the same finalizeJob() also runs when the
// browser polls or when the creator's library asks for pending jobs. Whoever gets there first saves the MP4
// (or refunds a failed run) exactly once. Closing the tab can no longer lose a paid video.
import crypto from 'crypto';
import { getSupabase } from './supabase.js';
import { bump, FOREVER } from './usage.js';
import { grantPaid } from './paid.js';
import { persistBytes } from './generation.js';
import { BUCKET } from './supabase.js';
import { effectById } from './effects.js';

export const ITEM_COLS = 'id, public_url, prompt, style, aspect_ratio, remix_of, is_public, likes, model';
export const toItem = (r) => ({ ...r, model: r.model || 'animate', is_public: Boolean(r.is_public), likes: r.likes || 0 });
export const fileFor = (pred) => crypto.createHash('sha256').update(`anim.${pred}`).digest('hex').slice(0, 32);
const SAVE_CLAIM_MS = 120_000; // a save claim expires after 2 minutes, so a crashed save can be retried
const missingTable = (e) => /video_jobs|42P01|PGRST205|schema cache/i.test(`${e?.message} ${e?.code}`);

export { outputUrl, jobOutcome, jobKind, jobFromRow, webhookFields, PREDICTION_ID_RE } from './videoJobCore.js';
import { outputUrl, jobOutcome, jobKind, PREDICTION_ID_RE, looksLikeVideo, hasVideoSignature, describeBytes, MIN_VIDEO_BYTES, MAX_SAVE_TRIES } from './videoJobCore.js';

// ---- database (best effort: everything still works before migration 010 is installed) ----
export async function recordJob(job) {
  const sb = getSupabase(); if (!sb || !job?.p) return;
  const { error } = await sb.from('video_jobs').upsert({
    prediction_id: job.p, uid: job.u, source_id: job.s || null, cost: job.c || 0, kind: jobKind(job),
    prompt: job.pr ? String(job.pr).slice(0, 600) : null, aspect_ratio: job.r || null,
  }, { onConflict: 'prediction_id', ignoreDuplicates: true });
  if (error && !missingTable(error)) console.error('video_jobs insert', error.message);
}
async function markJob(sb, pred, patch) {
  const { error } = await sb.from('video_jobs').update({ ...patch, finished_at: new Date().toISOString() }).eq('prediction_id', pred);
  if (error && !missingTable(error)) console.error('video_jobs update', error.message);
}
// A creator's unfinished jobs from the last 7 days (newest first). Empty before migration 010.
// The window is long on purpose: a job nobody looked at for a day must still end as saved or refunded.
export async function pendingJobs(uid, limit = 6) {
  const sb = getSupabase(); if (!sb || !uid) return [];
  const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  const { data, error } = await sb.from('video_jobs').select('prediction_id, uid, source_id, cost, kind, prompt, aspect_ratio, created_at')
    .eq('uid', uid).eq('status', 'processing').gte('created_at', since).order('created_at', { ascending: false }).limit(limit);
  if (error) { if (!missingTable(error)) console.error('video_jobs pending', error.message); return []; }
  return data || [];
}

// ---- checking a stored video ----
// Reads the first bytes of the public file the way a browser would. { ok: true, size, type } when it is a
// reachable video; { ok: false, why } when it is missing, empty or not a video; `unsure` when the check itself
// could not run (network), so nobody is refunded or deleted on a hiccup.
export async function verifyStored(url, expectedSize) {
  let r;
  try { r = await fetch(url, { cache: 'no-store', headers: { Range: 'bytes=0-63' } }); }
  catch (e) { return { ok: false, unsure: true, why: `could not reach the file (${String(e?.message || e).slice(0, 80)})` }; }
  if (r.status >= 500) return { ok: false, unsure: true, why: `storage answered ${r.status}` };
  if (r.status !== 200 && r.status !== 206) return { ok: false, why: `storage answered ${r.status}` };
  const head = Buffer.from(await r.arrayBuffer().catch(() => new ArrayBuffer(0)));
  const type = r.headers.get('content-type') || '';
  const size = Number((r.headers.get('content-range') || '').split('/')[1]) || (r.status === 200 ? head.length : 0);
  if (!hasVideoSignature(head)) return { ok: false, why: `stored file is not a video (${describeBytes(head, type)})` };
  if (size && size < MIN_VIDEO_BYTES) return { ok: false, why: `stored file is only ${size} bytes` };
  if (size && expectedSize && size !== expectedSize) return { ok: false, why: `stored ${size} bytes, expected ${expectedSize}` };
  return { ok: true, size, type };
}

// Give the credits back (once) and close the job as failed.
async function failJob(sb, job, reason) {
  const { data: seen } = await sb.from('video_jobs').select('status').eq('prediction_id', job.p).maybeSingle();
  if (seen?.status === 'failed') return { status: 'failed', charged: job.c || 0 }; // already handled: never refund twice
  // Refund exactly once, no matter who notices first (webhook, poll or library).
  if (job.c > 0 && await bump(`animref:${job.p}`, 1, 1) !== null) await grantPaid(job.u, job.c).catch((e) => console.error('video refund', e));
  console.error('video failed', job.p, reason);
  await markJob(sb, job.p, { status: 'failed', error: String(reason || 'failed').slice(0, 300), refunded: job.c > 0 });
  return { status: 'failed', charged: job.c || 0 };
}
const noteError = (sb, pred, msg) => sb.from('video_jobs').update({ error: String(msg).slice(0, 300) }).eq('prediction_id', pred).then(() => {}, () => {});

// Remove a saved video that turned out to be unusable (row and file).
export async function removeSavedVideo(sb, id, path) {
  if (id) await sb.from('images').delete().eq('id', id).then(() => {}, () => {});
  if (path) await sb.storage.from(BUCKET).remove([path]).catch(() => {});
}

// ---- the one place a video job is completed ----
// job: { p, u, s, c, e?, t?, pr?, r? }. Returns { status: 'processing' | 'done' | 'failed', item?, charged?, lost? }.
// A job only ends as 'done' when the file in storage has been read back and is a video. Everything else ends,
// sooner or later, as 'failed' with the credits returned: a failed run, a result that is gone, a save that keeps failing.
export async function finalizeJob(job) {
  const sb = getSupabase();
  if (!sb || !job?.p || !PREDICTION_ID_RE.test(String(job.p)) || !process.env.REPLICATE_API_TOKEN) return { status: 'processing' };
  const name = fileFor(job.p), path = `i/${name}.mp4`;
  const saved = async () => {
    const { data } = await sb.from('images').select(ITEM_COLS).eq('storage_path', path).maybeSingle();
    return data ? toItem(data) : null;
  };
  const already = await saved();
  if (already) { await markJob(sb, job.p, { status: 'done', image_id: already.id }); return { status: 'done', item: already }; }
  // A job that was closed as failed stays failed: the credits are back, so the video must not be saved afterwards.
  const { data: closed } = await sb.from('video_jobs').select('status, error').eq('prediction_id', job.p).maybeSingle();
  if (closed?.status === 'failed') return { status: 'failed', charged: job.c || 0, lost: /could not be saved|no longer/i.test(closed.error || '') };

  const r = await fetch(`https://api.replicate.com/v1/predictions/${encodeURIComponent(job.p)}`, {
    cache: 'no-store', headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` },
  }).catch(() => null);
  if (r && r.status === 404) return { ...(await failJob(sb, job, 'The model provider no longer has this run.')), lost: true };
  const p = r && r.ok ? await r.json().catch(() => null) : null;
  const outcome = jobOutcome(p);
  if (outcome === 'unknown' || outcome === 'processing') return { status: 'processing' };
  if (outcome === 'failed') return failJob(sb, job, p?.error || `run ${p?.status || 'failed'}`);

  const claim = `animsave:${job.p}:${Math.floor(Date.now() / SAVE_CLAIM_MS)}`;
  if (await bump(claim, 1, 1) === null) return { status: 'processing' }; // someone else is saving it right now
  const tries = Number(await bump(`animtry:${job.p}`, 1, 1e9, FOREVER).catch(() => 1)) || 1;
  const lose = async (why) => ({ ...(await failJob(sb, job, why)), lost: true });
  try {
    const v = await fetch(outputUrl(p), { cache: 'no-store' });
    // The provider keeps results for about an hour. Once the file is gone it will not come back.
    if ([403, 404, 410].includes(v.status)) return await lose(`The finished video is no longer available from the model provider (download ${v.status}).`);
    if (!v.ok) throw new Error(`download ${v.status}`);
    const bytes = Buffer.from(await v.arrayBuffer());
    if (!looksLikeVideo(bytes)) throw new Error(`the download is not a video (${describeBytes(bytes, v.headers.get('content-type'))})`);
    const { data: src0 } = job.s ? await sb.from('images').select('prompt, style, aspect_ratio').eq('id', job.s).maybeSingle() : { data: null };
    const fx = job.e ? effectById(job.e) : null;
    const src = fx ? { prompt: `✦ Pulse Effect: ${fx.name}`, style: 'None', aspect_ratio: '9:16' }
      : (src0 || (job.pr ? { prompt: job.pr, style: 'None', aspect_ratio: job.r || '16:9' } : null));
    const stored = await persistBytes({
      bytes, contentType: 'video/mp4', prompt: src?.prompt || 'Animated image', style: src?.style || 'None',
      ratio: src?.aspect_ratio || '1:1', creatorId: job.u, remixOf: job.s || null, tier: jobKind(job), fixedName: name,
    });
    if (!stored?.id) throw new Error(stored?.error || 'save failed');
    // Read the stored file back before calling it a success.
    const check = await verifyStored(stored.url, bytes.length);
    if (!check.ok) { await removeSavedVideo(sb, stored.id, path); throw new Error(check.why); }
    await markJob(sb, job.p, { status: 'done', image_id: stored.id, error: null });
    const item = (await saved()) || toItem({ id: stored.id, public_url: stored.url, prompt: src?.prompt, style: src?.style, aspect_ratio: src?.aspect_ratio, remix_of: job.s });
    return { status: 'done', item };
  } catch (e) {
    const msg = String(e?.message || e);
    console.error('video save', job.p, `try ${tries}`, msg);
    await noteError(sb, job.p, `save try ${tries}: ${msg}`);
    if (tries >= MAX_SAVE_TRIES) return await lose(`The video was made but could not be saved after ${tries} tries: ${msg}`);
    await bump(claim, -1, 1e9).catch(() => {});
    return { status: 'processing' };
  }
}

// The newest video jobs, for the admin page (what happened to each run, in plain words).
export async function recentJobs(limit = 10) {
  const sb = getSupabase(); if (!sb) return [];
  const { data, error } = await sb.from('video_jobs').select('prediction_id, kind, status, cost, refunded, error, image_id, created_at, finished_at').order('created_at', { ascending: false }).limit(limit);
  if (error) { if (!missingTable(error)) console.error('video_jobs recent', error.message); return []; }
  const ids = (data || []).map((j) => j.image_id).filter(Boolean);
  const { data: imgs } = ids.length ? await sb.from('images').select('id, public_url').in('id', ids) : { data: [] };
  const urlOf = new Map((imgs || []).map((i) => [i.id, i.public_url]));
  return Promise.all((data || []).map(async (j, n) => {
    const url = j.image_id ? urlOf.get(j.image_id) : null;
    // Read back the newest few saved files, so a broken file shows up here and not only in a player.
    const file = j.status === 'done' ? (url ? (n < 6 ? await verifyStored(url) : null) : { ok: false, why: 'the saved video was deleted' }) : null;
    return { id: j.prediction_id.slice(0, 10), kind: j.kind, status: j.status, cost: j.cost, refunded: j.refunded, error: j.error, at: j.created_at, file };
  }));
}
