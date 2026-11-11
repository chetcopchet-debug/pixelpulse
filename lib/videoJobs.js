// Video jobs are finished by the SERVER, not by the browser tab.
// Replicate calls /api/webhooks/replicate when a video is done; the same finalizeJob() also runs when the
// browser polls or when the creator's library asks for pending jobs. Whoever gets there first saves the MP4
// (or refunds a failed run) exactly once. Closing the tab can no longer lose a paid video.
import crypto from 'crypto';
import { getSupabase } from './supabase.js';
import { bump } from './usage.js';
import { grantPaid } from './paid.js';
import { persistBytes } from './generation.js';
import { effectById } from './effects.js';

export const ITEM_COLS = 'id, public_url, prompt, style, aspect_ratio, remix_of, is_public, likes, model';
export const toItem = (r) => ({ ...r, model: r.model || 'animate', is_public: Boolean(r.is_public), likes: r.likes || 0 });
export const fileFor = (pred) => crypto.createHash('sha256').update(`anim.${pred}`).digest('hex').slice(0, 32);
const SAVE_CLAIM_MS = 120_000; // a save claim expires after 2 minutes, so a crashed save can be retried
const missingTable = (e) => /video_jobs|42P01|PGRST205|schema cache/i.test(`${e?.message} ${e?.code}`);

export { outputUrl, jobOutcome, jobKind, jobFromRow, webhookFields, PREDICTION_ID_RE } from './videoJobCore.js';
import { outputUrl, jobOutcome, jobKind, PREDICTION_ID_RE } from './videoJobCore.js';

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
// A creator's unfinished jobs from the last 2 hours (newest first). Empty before migration 010.
export async function pendingJobs(uid, limit = 6) {
  const sb = getSupabase(); if (!sb || !uid) return [];
  const since = new Date(Date.now() - 2 * 3600_000).toISOString();
  const { data, error } = await sb.from('video_jobs').select('prediction_id, uid, source_id, cost, kind, prompt, aspect_ratio, created_at')
    .eq('uid', uid).eq('status', 'processing').gte('created_at', since).order('created_at', { ascending: false }).limit(limit);
  if (error) { if (!missingTable(error)) console.error('video_jobs pending', error.message); return []; }
  return data || [];
}

// ---- the one place a video job is completed ----
// job: { p, u, s, c, e?, t?, pr?, r? }. Returns { status: 'processing' | 'done' | 'failed', item?, charged? }.
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

  const r = await fetch(`https://api.replicate.com/v1/predictions/${encodeURIComponent(job.p)}`, {
    cache: 'no-store', headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` },
  }).catch(() => null);
  const p = r && r.ok ? await r.json().catch(() => null) : null;
  const outcome = jobOutcome(p);
  if (outcome === 'unknown' || outcome === 'processing') return { status: 'processing' };

  if (outcome === 'failed') {
    // Already handled (possibly on an earlier day): never refund twice.
    const { data: seen } = await sb.from('video_jobs').select('status').eq('prediction_id', job.p).maybeSingle();
    if (seen?.status === 'failed') return { status: 'failed', charged: job.c || 0 };
    // Refund exactly once, no matter who notices the failure first (webhook, poll or library).
    if (job.c > 0 && await bump(`animref:${job.p}`, 1, 1) !== null) await grantPaid(job.u, job.c).catch((e) => console.error('video refund', e));
    console.error('video failed', job.p, p?.error || '');
    await markJob(sb, job.p, { status: 'failed', error: String(p?.error || 'failed').slice(0, 300), refunded: job.c > 0 });
    return { status: 'failed', charged: job.c || 0 };
  }

  const claim = `animsave:${job.p}:${Math.floor(Date.now() / SAVE_CLAIM_MS)}`;
  if (await bump(claim, 1, 1) === null) return { status: 'processing' }; // someone else is saving it right now
  try {
    const v = await fetch(outputUrl(p), { cache: 'no-store' });
    if (!v.ok) throw new Error(`download ${v.status}`);
    const bytes = Buffer.from(await v.arrayBuffer());
    const { data: src0 } = job.s ? await sb.from('images').select('prompt, style, aspect_ratio').eq('id', job.s).maybeSingle() : { data: null };
    const fx = job.e ? effectById(job.e) : null;
    const src = fx ? { prompt: `✦ Pulse Effect: ${fx.name}`, style: 'None', aspect_ratio: '9:16' }
      : (src0 || (job.pr ? { prompt: job.pr, style: 'None', aspect_ratio: job.r || '16:9' } : null));
    const stored = await persistBytes({
      bytes, contentType: 'video/mp4', prompt: src?.prompt || 'Animated image', style: src?.style || 'None',
      ratio: src?.aspect_ratio || '1:1', creatorId: job.u, remixOf: job.s || null, tier: jobKind(job), fixedName: name,
    });
    if (!stored?.id) { const again = await saved(); if (again) { await markJob(sb, job.p, { status: 'done', image_id: again.id }); return { status: 'done', item: again }; } throw new Error(stored?.error || 'save failed'); }
    await markJob(sb, job.p, { status: 'done', image_id: stored.id });
    const item = (await saved()) || toItem({ id: stored.id, public_url: stored.url, prompt: src?.prompt, style: src?.style, aspect_ratio: src?.aspect_ratio, remix_of: job.s });
    return { status: 'done', item };
  } catch (e) {
    console.error('video save', job.p, e?.message || e);
    await bump(claim, -1, 1e9).catch(() => {});
    return { status: 'processing' };
  }
}
