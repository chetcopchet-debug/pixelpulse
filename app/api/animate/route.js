import { NextResponse } from 'next/server';
import { getClientIp, chargePaidCredits, paidFor } from '../../../lib/credits';
import { reserveSpend } from '../../../lib/usage';
import { getSupabase } from '../../../lib/supabase';
import { getCreatorId, setCreatorCookie, isUuid } from '../../../lib/identity';
import { isAdmin } from '../../../lib/admin';
import { rateLimit } from '../../../lib/ratelimit';
import { MAX_PROMPT_LENGTH, VALID_RATIOS } from '../../../lib/generation';
import { toEnglishPrompt, TRANSLATE_BUSY_MSG } from '../../../lib/translate';
import { checkPromptText, blockedMessage, checkOutputImage } from '../../../lib/moderation';
import { PREMIUM, VIDEO_TIERS } from '../../../lib/models';
import { makeJob, readJob } from '../../../lib/animateJob';
import { advanceJob, fetchPrediction, recordJob, webhookFields } from '../../../lib/videoJobs';
import { EFFECT_PROMPTS } from '../../../lib/effectPrompts';
import { videoQuote, VIDEO_PRICING } from '../../../lib/videoPricing';
import { isBanned, BANNED_MSG, logGeneration } from '../../../lib/trustSafety';
import sharp from 'sharp';
import { withErrorLog } from '../../../lib/monitor';

// Pulse Effects: center-crop the photo to 9:16 (720x1280) so wan outputs a vertical, share-ready clip.
async function toVertical(url) {
  try {
    const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) return url;
    const buf = await sharp(Buffer.from(await r.arrayBuffer())).rotate().resize(720, 1280, { fit: 'cover', position: 'attention' }).jpeg({ quality: 90 }).toBuffer();
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch { return url; }
}

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
const AN = PREMIUM.animate;
const DEFAULT_MOTION = 'subtle natural cinematic motion, gentle slow camera push-in, lifelike movement, keep the scene and subject consistent';
const JOB_TTL = 60 * 60_000;
const api = (path, init = {}) => fetch(`https://api.replicate.com/v1/${path}`, { cache: 'no-store', ...init,
  headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });

// POST { id, prompt? } -> { job } (start). Charged up front from PAID credits; refunded if the video fails.
async function POSTHandler(request) {
  const admin = isAdmin(request);
  const creator = getCreatorId(request);
  const ip = getClientIp(request);
  const body = await request.json().catch(() => ({}));
  if (!admin && await isBanned(creator.id)) return NextResponse.json({ error: BANNED_MSG }, { status: 403 });
  if (typeof body?.model === 'string') return startTextVideo(request, body, { admin, creator, ip });
  if (!isUuid(body?.id)) return NextResponse.json({ error: 'Invalid image id.' }, { status: 400 });
  const raw = typeof body?.prompt === 'string' ? body.prompt.trim().slice(0, MAX_PROMPT_LENGTH) : '';
  const sb = getSupabase();
  if (!sb || !process.env.REPLICATE_API_TOKEN) return NextResponse.json({ error: 'Service temporarily unavailable.' }, { status: 503 });
  const { data: row } = await sb.from('images').select('id, public_url, prompt, aspect_ratio, is_public, creator_id, storage_path').eq('id', body.id).maybeSingle();
  if (!row || (!row.is_public && (creator.isNew || row.creator_id !== creator.id))) return NextResponse.json({ error: 'Image not found.' }, { status: 404 });
  if (/\.mp4$/i.test(row.storage_path || '')) return NextResponse.json({ error: 'This is already a video.' }, { status: 400 });
  const effect = typeof body?.effect === 'string' && Object.prototype.hasOwnProperty.call(EFFECT_PROMPTS, body.effect) ? body.effect : null;
  if (body?.effect && !effect) return NextResponse.json({ error: 'Unknown effect.' }, { status: 400 });
  let motion = DEFAULT_MOTION;
  if (effect) motion = EFFECT_PROMPTS[effect];
  else if (raw) {
    const en = await toEnglishPrompt(raw, { strict: true }); // the photo may show a real person: fail closed
    if (en === null) return NextResponse.json({ error: TRANSLATE_BUSY_MSG }, { status: 503 });
    const bad = checkPromptText(raw) || checkPromptText(en);
    if (bad) return NextResponse.json({ error: blockedMessage(bad) }, { status: 400 });
    motion = `${en}. Keep the scene and subject consistent.`;
  }
  if (!admin && !await rateLimit(`animate:${creator.id}:${ip}`, 10, 60 * 60_000)) return NextResponse.json({ error: 'Animate limit reached. Try again later.' }, { status: 429 });

  // Video outputs can't be classified with the image model (no frame extraction on the server), so the INPUT image is
  // checked before charging. Fails CLOSED (often a photo of a person). Nothing is charged yet, so there is nothing to refund.
  const inGate = await checkOutputImage(row.public_url, 'closed');
  if (inGate) await logGeneration({ userId: creator.id, ip, mode: 'animate', prompt: raw, inputRef: row.id, moderation: inGate.status === 422 ? 'blocked:input' : 'blocked:unavailable' });
  if (inGate) return NextResponse.json({ error: inGate.status === 503 ? inGate.error.replace(/ Your credits were refunded\./g, '') : inGate.error }, { status: inGate.status });
  const charge = await chargePaidCredits({ admin, creator, cost: AN.cost });
  if (!charge.ok) return NextResponse.json({ error: `Animate uses purchased credits (${AN.cost}⚡).`, needCredits: { cost: AN.cost, label: AN.label, paidOnly: true }, paid: await paidFor(creator) }, { status: 402 });
  const spend = await reserveSpend(AN.usd, { admin: true }); // paid work is never blocked by the free budget cap
  const r = await api(`models/${AN.model}/predictions`, { method: 'POST', body: JSON.stringify({ input: AN.input(effect ? await toVertical(row.public_url) : row.public_url, motion), ...webhookFields() }) }).catch(() => null);
  const p = r ? await r.json().catch(() => ({})) : {};
  if (!r || !r.ok || !p.id) {
    console.error('animate start', r?.status, p?.detail || p?.error || '');
    await spend.release(); await charge.refund();
    return NextResponse.json({ error: 'Could not start the video, your credits were refunded.', paid: await paidFor(creator) }, { status: 502 });
  }
  await logGeneration({ userId: creator.id, ip, mode: effect ? `effect:${effect}` : 'animate', prompt: raw, inputRef: row.id, outputRef: `pred:${p.id}`, moderation: 'passed:input-only' });
  const fields = { p: p.id, u: creator.id, s: row.id, c: charge.source === 'paid' ? AN.cost : 0, x: Date.now() + JOB_TTL, ...(effect ? { e: effect } : {}) };
  await recordJob(sb, fields); // server-side record: saved/refunded by the webhook even if the tab is closed
  const job = makeJob(fields);
  const res = NextResponse.json({ job, status: 'processing', paid: admin ? undefined : await paidFor(creator), ...(admin ? { admin: true } : {}) });
  setCreatorCookie(res, creator);
  return res;
}

// Text-to-video from the model picker: { model, prompt, aspectRatio }. Paid credits only.
async function startTextVideo(request, body, { admin, creator, ip }) {
  const def = Object.prototype.hasOwnProperty.call(VIDEO_TIERS, body.model) ? VIDEO_TIERS[body.model] : null;
  if (!def) return NextResponse.json({ error: 'Invalid video model.' }, { status: 400 });
  const raw = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  if (!raw) return NextResponse.json({ error: 'Describe the video you want.' }, { status: 400 });
  if (raw.length > MAX_PROMPT_LENGTH) return NextResponse.json({ error: `Prompt is too long (max ${MAX_PROMPT_LENGTH}).` }, { status: 400 });
  if (!process.env.REPLICATE_API_TOKEN || !getSupabase()) return NextResponse.json({ error: 'Service temporarily unavailable.' }, { status: 503 });
  // Price is computed here from the chosen duration/resolution (never trusted from the client).
  const pd = VIDEO_PRICING[body.model].def;
  const q = videoQuote(body.model, body?.duration ?? pd.d, body?.resolution ?? pd.r, VALID_RATIOS.includes(body?.aspectRatio) ? body.aspectRatio : '16:9');
  if (!q) return NextResponse.json({ error: 'That duration / quality is not available for this model.' }, { status: 400 });
  const ratio = q.ratio;
  const tier = { ...def, cost: q.cost, usd: q.usd };
  const en = await toEnglishPrompt(raw);
  const bad = checkPromptText(raw) || checkPromptText(en);
  if (bad) return NextResponse.json({ error: blockedMessage(bad) }, { status: 400 });
  if (!admin && !await rateLimit(`t2v:${creator.id}:${ip}`, 10, 60 * 60_000)) return NextResponse.json({ error: 'Video limit reached. Try again later.' }, { status: 429 });
  const charge = await chargePaidCredits({ admin, creator, cost: tier.cost });
  if (!charge.ok) return NextResponse.json({ error: `${def.label} uses purchased credits (${tier.cost}⚡).`, needCredits: { cost: tier.cost, label: def.label, paidOnly: true }, paid: await paidFor(creator) }, { status: 402 });
  const spend = await reserveSpend(tier.usd, { admin: true });
  const r = await api(`models/${def.model}/predictions`, { method: 'POST', body: JSON.stringify({ input: def.input(en, ratio, q.d, q.r), ...webhookFields() }) }).catch(() => null);
  const p = r ? await r.json().catch(() => ({})) : {};
  if (!r || !r.ok || !p.id) {
    console.error('t2v start', body.model, r?.status, p?.detail || p?.error || '');
    await spend.release(); await charge.refund();
    return NextResponse.json({ error: 'Could not start the video, your credits were refunded.', paid: await paidFor(creator) }, { status: 502 });
  }
  await logGeneration({ userId: creator.id, ip, mode: `t2v:${body.model}`, prompt: raw, outputRef: `pred:${p.id}`, moderation: 'passed:text-only' });
  const fields = { p: p.id, u: creator.id, s: null, c: charge.source === 'paid' ? tier.cost : 0, x: Date.now() + JOB_TTL, t: body.model, pr: raw.slice(0, 600), r: ratio };
  await recordJob(getSupabase(), fields);
  const job = makeJob(fields);
  const res = NextResponse.json({ job, status: 'processing', ...(admin ? { admin: true } : { paid: await paidFor(creator) }) });
  setCreatorCookie(res, creator);
  return res;
}

// GET ?job=<token> -> { status: processing | done | failed, item? }. The webhook / sweep may already have finished it.
async function GETHandler(request) {
  const job = readJob(new URL(request.url).searchParams.get('job'));
  const creator = getCreatorId(request);
  if (!job || creator.isNew || creator.id !== job.u) return NextResponse.json({ error: 'Unknown video job.' }, { status: 404 });
  const sb = getSupabase(); if (!sb) return NextResponse.json({ error: 'Service temporarily unavailable.' }, { status: 503 });
  const res = await advanceJob(sb, job, await fetchPrediction(job.p));
  if (res.status === 'failed') return NextResponse.json({ ...res, paid: await paidFor(creator) });
  return NextResponse.json(res);
}

export const POST = withErrorLog('/api/animate', POSTHandler);
export const GET = withErrorLog('/api/animate', GETHandler);
