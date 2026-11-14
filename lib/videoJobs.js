// Video jobs are finished by the SERVER, not by the browser tab.
// Replicate calls /api/webhooks/replicate when a video is done; the same finalizeJob() also runs when the
// browser polls or when the creator's library asks for pending jobs. Whoever gets there first saves the MP4
// (or refunds a failed run) exactly once. Closing the tab can no longer lose a paid video.
import crypto from 'crypto';
import { getSupabase } from './supabase.js';
import { bump, FOREVER } from './usage.js';
import { grantPaid } from './paid.js';
import { persistBytes, makeThumb } from './generation.js';
import { BUCKET } from './supabase.js';
import { effectById } from './effects.js';
import { toWebVideo, firstFrame, sampleFrames } from './transcode.js';
import { classifyFrames } from './moderation.js';
import { videoStrike, logGeneration } from './trustSafety.js';

export const ITEM_COLS = 'id, public_url, prompt, style, aspect_ratio, remix_of, is_public, likes, model, project_id';
export const toItem = (r) => ({ ...r, model: r.model || 'animate', is_public: Boolean(r.is_public), likes: r.likes || 0 });
export const fileFor = (pred) => crypto.createHash('sha256').update(`anim.${pred}`).digest('hex').slice(0, 32);
const SAVE_CLAIM_MS = 120_000; // a save claim expires after 2 minutes, so a crashed save can be retried
const missingTable = (e) => /video_jobs|42P01|PGRST205|schema cache/i.test(`${e?.message} ${e?.code}`);

export { outputUrl, jobOutcome, jobKind, jobFromRow, webhookFields, PREDICTION_ID_RE } from './videoJobCore.js';
import { noteRun } from './modelHealth.js';
import { outputUrl, jobOutcome, jobKind, PREDICTION_ID_RE, refusedFaces, FACES_REFUSED, looksLikeVideo, hasVideoSignature, describeBytes, MIN_VIDEO_BYTES, MAX_SAVE_TRIES, probeMp4 } from './videoJobCore.js';

// ---- database (best effort: everything still works before migration 010 is installed) ----
export async function recordJob(job) {
  const sb = getSupabase(); if (!sb || !job?.p) return;
  const row = {
    prediction_id: job.p, uid: job.u, source_id: job.s || null, cost: job.c || 0, kind: jobKind(job),
    prompt: job.pr ? String(job.pr).slice(0, 600) : null, aspect_ratio: job.r || null,
  };
  const put = (r) => sb.from('video_jobs').upsert(r, { onConflict: 'prediction_id', ignoreDuplicates: true });
  // job.j: the project the video was started in (migration 012). Before 012 the row is written without it;
  // the signed job token still carries it, so the usual ways a video finishes are not affected.
  let { error } = await put(job.j ? { ...row, project_id: job.j } : row);
  if (error && job.j && /project_id|23503/i.test(`${error.message} ${error.code}`)) ({ error } = await put(row));
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
  const find = (cols) => sb.from('video_jobs').select(cols)
    .eq('uid', uid).eq('status', 'processing').gte('created_at', since).order('created_at', { ascending: false }).limit(limit);
  const cols = 'prediction_id, uid, source_id, cost, kind, prompt, aspect_ratio, created_at';
  let { data, error } = await find(`${cols}, project_id`);
  if (error && /project_id/i.test(error.message || '')) ({ data, error } = await find(cols)); // before migration 012
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

// Download a stored video (up to 24 MB) and say what is inside it. null when it could not be read.
export async function probeStored(url) {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return null;
    const len = Number(r.headers.get('content-length')) || 0;
    if (len > 24 * 1024 * 1024) return { codec: null, web: null, summary: 'too large to inspect' };
    return probeMp4(Buffer.from(await r.arrayBuffer()));
  } catch { return null; }
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
// `faces`: the model turned the picture down because it shows a realistic face (see refusedFaces).
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
  const { data: closed } = await sb.from('video_jobs').select('status, error, image_id').eq('prediction_id', job.p).maybeSingle();
  if (closed?.status === 'failed') return { status: 'failed', charged: job.c || 0, lost: /could not be saved|no longer/i.test(closed.error || ''), blocked: /^Blocked by the safety check/.test(closed.error || ''), faces: refusedFaces(closed.error), unchecked: /^The safety check gave no answer/.test(closed.error || '') };
  // A finished job is found through its row too: the file may have been converted and renamed since.
  if (closed?.status === 'done' && closed.image_id) {
    const { data: kept } = await sb.from('images').select(ITEM_COLS).eq('id', closed.image_id).maybeSingle();
    if (kept) return { status: 'done', item: toItem(kept) };
  }

  const r = await fetch(`https://api.replicate.com/v1/predictions/${encodeURIComponent(job.p)}`, {
    cache: 'no-store', headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` },
  }).catch(() => null);
  if (r && r.status === 404) return { ...(await failJob(sb, job, 'The model provider no longer has this run.')), lost: true };
  const p = r && r.ok ? await r.json().catch(() => null) : null;
  const outcome = jobOutcome(p);
  if (outcome === 'unknown' || outcome === 'processing') return { status: 'processing' };
  if (outcome === 'failed') { if (p?.status !== 'canceled') await noteRun(p?.model, false, p?.error || 'finished without a video'); const faces = refusedFaces(p?.error); return { ...(await failJob(sb, job, faces ? `${FACES_REFUSED}: ${p.error}` : p?.error || `run ${p?.status || 'failed'}`)), faces }; }
  await noteRun(p?.model, true);

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
    // Whatever the model wrote, what is stored is H.264 4:2:0 with the index at the start (lib/transcode.js).
    const web = await toWebVideo(bytes);
    if (!web.ok) throw new Error(`the video is ${web.before.summary}, which phones cannot play, and it could not be converted (${web.why || 'unknown reason'})`);
    // The finished video itself is checked before it is kept: five frames from its start to its end.
    const safety = await classifyFrames(await sampleFrames(web.bytes, 5, { budgetMs: 14_000 }), { budgetMs: 18_000 }); // the whole save has 60 seconds
    if (safety === 'nsfw') {
      await videoStrike(sb, { creatorId: job.u, prediction: job.p });
      await logGeneration({ userId: job.u, mode: String(jobKind(job)).slice(0, 40), prompt: job.pr || null, inputRef: job.s || null, outputRef: `pred:${job.p}`, moderation: 'blocked:output' });
      return { ...(await failJob(sb, job, 'Blocked by the safety check: the video looks explicit.')), blocked: true };
    }
    // No checker answered: tried again on the next look; after the last try the credits go back. Never saved unchecked.
    if (safety !== 'normal') {
      if (tries >= MAX_SAVE_TRIES) {
        await logGeneration({ userId: job.u, mode: String(jobKind(job)).slice(0, 40), prompt: job.pr || null, inputRef: job.s || null, outputRef: `pred:${job.p}`, moderation: 'blocked:unavailable' });
        return { ...(await failJob(sb, job, 'The safety check gave no answer for this video.')), unchecked: true };
      }
      throw new Error('the safety check gave no answer');
    }
    const note = web.how === 'kept' ? (web.why ? `saved as received (${web.before.summary}); not converted: ${web.why}` : null) : `${web.how} to ${web.after.summary} (was ${web.before.summary})`;
    const { data: src0 } = job.s ? await sb.from('images').select('prompt, style, aspect_ratio').eq('id', job.s).maybeSingle() : { data: null };
    const fx = job.e ? effectById(job.e) : null;
    const src = fx ? { prompt: `✦ Pulse Effect: ${fx.name}`, style: 'None', aspect_ratio: '9:16' }
      : (src0 ? { ...src0, ...(job.t && job.pr ? { prompt: job.pr } : {}) } // a video from a picture on a picker model: the motion the person described
        : (job.pr ? { prompt: job.pr, style: 'None', aspect_ratio: job.r || '16:9' } : null));
    const stored = await persistBytes({
      bytes: web.bytes, contentType: 'video/mp4', prompt: src?.prompt || 'Animated image', style: src?.style || 'None',
      ratio: src?.aspect_ratio || '1:1', creatorId: job.u, remixOf: job.s || null, tier: jobKind(job), fixedName: name,
    });
    if (!stored?.id) throw new Error(stored?.error || 'save failed');
    // The video's still picture: its first frame, saved where an image's thumbnail would be. Best effort; without
    // it the lists show a play mark until the owner plays the video once.
    try { const frame = await firstFrame(web.bytes); if (frame) await makeThumb(sb, path, frame); } catch (e) { console.warn('video still', e?.message || e); }
    // Read the stored file back before calling it a success.
    const check = await verifyStored(stored.url, web.bytes.length);
    if (!check.ok) { await removeSavedVideo(sb, stored.id, path); throw new Error(check.why); }
    // Into the project it was started in. Best effort: if that project was deleted meanwhile, the video simply
    // stays outside any project.
    if (job.j) await sb.from('images').update({ project_id: job.j }).eq('id', stored.id).eq('creator_id', job.u).then(({ error: pe }) => { if (pe) console.warn('video project', pe.message); }, () => {});
    await markJob(sb, job.p, { status: 'done', image_id: stored.id, error: note });
    await logGeneration({ userId: job.u, mode: String(jobKind(job)).slice(0, 40), prompt: job.pr || null, inputRef: job.s || null, outputRef: stored.id, moderation: 'passed:output' });
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

// ---- videos saved before conversion existed ----
// Is this stored video already in the web format? Cheap: reads only the start of the file. A converted file has
// its index right after the header; an unconverted one almost never does. null = could not tell.
export async function isWebReady(url) {
  try {
    const r = await fetch(url, { cache: 'no-store', headers: { Range: 'bytes=0-4095' } });
    if (r.status !== 200 && r.status !== 206) return null;
    const head = Buffer.from(await r.arrayBuffer());
    if (!hasVideoSignature(head)) return null;
    const p = probeMp4(head);
    return p.indexFirst && p.web !== false;
  } catch { return null; }
}

// Convert one stored video in place of the old file. The converted file gets a NEW address (browsers and the
// CDN keep the old address cached for a year), the row is pointed at it, and the old file and picture are removed.
// row: { id, public_url, storage_path }. Returns { changed, item?, how?, format, why? }.
export async function makeWebReady(sb, row, { always = false } = {}) {
  const oldPath = row.storage_path; // remembered now: the record is changed further down
  const r = await fetch(row.public_url, { cache: 'no-store' }).catch(() => null);
  if (!r || !r.ok) return { changed: false, format: 'unreadable', why: `storage answered ${r ? r.status : 'nothing'}` };
  const bytes = Buffer.from(await r.arrayBuffer());
  if (!looksLikeVideo(bytes)) return { changed: false, format: describeBytes(bytes, r.headers.get('content-type')), why: 'the stored file is not a video' };
  const web = await toWebVideo(bytes, { always });
  if (web.how === 'kept') return { changed: false, format: web.before.summary, playable: web.before.web, why: web.why || 'already in the web format' };
  const newPath = `i/${crypto.randomBytes(16).toString('hex')}.mp4`;
  const up = await sb.storage.from(BUCKET).upload(newPath, web.bytes, { contentType: 'video/mp4', upsert: false, cacheControl: '31536000' });
  if (up.error) return { changed: false, format: web.before.summary, playable: web.before.web, why: `upload failed: ${up.error.message}` };
  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(newPath);
  const check = await verifyStored(pub.publicUrl, web.bytes.length);
  if (!check.ok) { await sb.storage.from(BUCKET).remove([newPath]).catch(() => {}); return { changed: false, format: web.before.summary, playable: web.before.web, why: `converted file failed its check: ${check.why}` }; }
  const { data: updated, error } = await sb.from('images').update({ storage_path: newPath, public_url: pub.publicUrl }).eq('id', row.id).select(ITEM_COLS).maybeSingle();
  if (error || !updated) { await sb.storage.from(BUCKET).remove([newPath]).catch(() => {}); return { changed: false, format: web.before.summary, playable: web.before.web, why: `could not update the record: ${error?.message || 'row is gone'}` }; }
  const oldPoster = /^i\/([A-Za-z0-9_-]+)\.mp4$/.exec(oldPath || '');
  if (oldPath && oldPath !== newPath) await sb.storage.from(BUCKET).remove([oldPath, ...(oldPoster ? [`t/${oldPoster[1]}.webp`] : [])]).catch(() => {});
  await sb.from('video_jobs').update({ error: `${web.how} to ${web.after.summary} (was ${web.before.summary})`.slice(0, 300) }).eq('image_id', row.id).then(() => {}, () => {});
  console.log('video converted', row.id, web.how, web.before.summary, '->', web.after.summary);
  return { changed: true, item: toItem(updated), how: web.how, format: web.after.summary, was: web.before.summary };
}

// Bring a creator's most recent videos to the web format, a couple per call, within a time budget.
// Runs when the creator opens the site, so videos saved before conversion existed fix themselves.
export async function repairRecent(uid, { max = 2, budgetMs = 30_000, look = 6 } = {}) {
  const sb = getSupabase(); if (!sb || !uid) return [];
  const started = Date.now();
  const { data: rows, error } = await sb.from('images').select('id, public_url, storage_path').eq('creator_id', uid).like('storage_path', '%.mp4').order('created_at', { ascending: false }).limit(look);
  if (error || !rows) return [];
  const out = [];
  for (const row of rows) {
    if (out.length >= max || Date.now() - started > budgetMs) break;
    if (await isWebReady(row.public_url) !== false) continue; // ready, or could not tell: leave it
    const res = await makeWebReady(sb, row).catch((e) => ({ changed: false, why: String(e?.message || e) }));
    if (res.changed) out.push(res.item); else console.log('video repair skipped', row.id, res.why); // not an error: the file is fine as it is
  }
  return out;
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
