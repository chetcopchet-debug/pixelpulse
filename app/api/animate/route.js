import { NextResponse } from 'next/server';
import { refusalLog } from '../../../lib/refusals';
import { accountGate } from '../../../lib/needAccount';
import { getClientIp, chargePaidCredits, paidFor } from '../../../lib/credits';
import { reserveSpend } from '../../../lib/usage';
import { getSupabase } from '../../../lib/supabase';
import { getCreatorId, setCreatorCookie, isUuid } from '../../../lib/identity';
import { isAdmin } from '../../../lib/admin';
import { rateLimit } from '../../../lib/ratelimit';
import { MAX_PROMPT_LENGTH, VALID_RATIOS } from '../../../lib/generation';
import { toEnglishPrompt, preparePrompt, shortIdea, improveAllowed } from '../../../lib/translate';
import { hasPro } from '../../../lib/paid';
import { checkPromptText, blockedMessage, checkOutputImage } from '../../../lib/moderation';
import { PREMIUM, VIDEO_TIERS } from '../../../lib/models';
import { makeJob, readJob } from '../../../lib/animateJob';
import { EFFECT_PROMPTS } from '../../../lib/effectPrompts';
import { finalizeJob, recordJob, pendingJobs, jobFromRow, webhookFields, repairRecent } from '../../../lib/videoJobs';
import { videoQuote, VIDEO_PRICING, VIDEO_WITH_SOUND } from '../../../lib/videoPricing';
import { ownedProject } from '../../../lib/projectOwner';
import { isDiscontinued, markDead, isDeadSlug } from '../../../lib/modelHealth';
const MODEL_OFF_MSG = 'This model is temporarily unavailable. Pick another model.';
import { isBanned, BANNED_MSG, logGeneration, videoStrikesToday, VIDEO_STRIKES_A_DAY, VIDEO_PAUSED_MSG } from '../../../lib/trustSafety';
import { replicateStart, THROTTLED_MSG } from '../../../lib/replicate';
import sharp from 'sharp';
import { doorOpens } from '../../../lib/testDoor';

// Pulse Effects: center-crop the photo to 9:16 (720x1280) so wan outputs a vertical, share-ready clip.
// A model's first frame, as a JPEG no larger than 1280 on its long side, inside the request itself. JPEG because
// some models take only JPG or PNG and many of our pictures are WebP; inside the request so no extra file is
// left in storage.
async function firstFrame(url, side = 1280) {
  const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error(`first frame download ${r.status}`);
  const buf = await sharp(Buffer.from(await r.arrayBuffer())).rotate().resize({ width: side, height: side, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 90 }).toBuffer();
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}
// TEST ADDRESS ONLY. This is in the `preview` branch and is not part of the site (it is never merged to main).
// A video that ends on the picture it starts from, so it can play as a loop: the same picture is given to the model
// as its last frame too. Only for a caller who holds the test door's secret, and only on a preview build.
const LOOP_END_INPUT = { 'kling-4': 'end_image', omni: 'last_frame' };
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
// Starting a run goes through replicateStart, which waits and retries when the Replicate account is throttled.
const api = (path, init = {}) => replicateStart(`https://api.replicate.com/v1/${path}`, { ...init,
  headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`, 'Content-Type': 'application/json', ...(init.headers || {}) } }, { tries: 3 });
const startFailed = (r) => (r?.status === 429 ? `${THROTTLED_MSG} Your credits were returned.` : 'Could not start the video, your credits were refunded.');
// Replicate calls our webhook when the video is done, so the server saves it even if the browser tab is closed.
// The webhook token is signed and carries everything except the prediction id (not known before the run starts).
// On deployments behind Vercel's login wall (previews), Replicate can only get in with Vercel's bypass secret.
const hookFor = (request, fields) => webhookFields(new URL(request.url).origin, makeJob({ ...fields, w: 1 }), process.env.VERCEL_AUTOMATION_BYPASS_SECRET);

// POST { id, prompt? } -> { job } (start). Charged up front from PAID credits; refunded if the video fails.
async function handlePost(request) {
  // Creating needs an account: a visitor who is not signed in is sent to the sign-in screen.
  const stop = accountGate(request); if (stop) return stop;
  const admin = isAdmin(request);
  const creator = getCreatorId(request);
  const ip = getClientIp(request);
  const body = await request.json().catch(() => ({}));
  if (!admin && await isBanned(creator.id)) return NextResponse.json({ error: BANNED_MSG }, { status: 403 });
  // Three videos blocked by the safety check today: no more videos until midnight UTC.
  if (!admin && await videoStrikesToday(creator.id) >= VIDEO_STRIKES_A_DAY) return NextResponse.json({ error: VIDEO_PAUSED_MSG }, { status: 429 });
  // A model from the picker: text-to-video, or (with an image id) a video that starts from that picture.
  // Wan with a picture is the fixed "Animate" below: its picker model is text only.
  if (typeof body?.model === 'string' && !(body.model === 'wan' && body?.id)) return startTextVideo(request, body, { admin, creator, ip });
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
    const en = await toEnglishPrompt(raw);
    const bad = checkPromptText(en);
    if (bad) return NextResponse.json({ error: blockedMessage(bad) }, { status: 400 });
    motion = `${en}. Keep the scene and subject consistent.`;
  }
  if (!admin && !await rateLimit(`animate:${creator.id}:${ip}`, 10, 60 * 60_000)) return NextResponse.json({ error: 'Animate limit reached. Try again later.' }, { status: 429 });

  // Video outputs can't be classified with the image model (no frame extraction on the server), so the INPUT image is
  // checked before charging. Fails CLOSED (often a photo of a person). Nothing is charged yet, so there is nothing to refund.
  const inGate = await checkOutputImage(row.public_url, 'closed');
  if (inGate) await logGeneration({ userId: creator.id, ip, mode: 'animate', prompt: raw, inputRef: row.id, moderation: inGate.status === 422 ? 'blocked:input' : 'blocked:unavailable' });
  if (inGate) return NextResponse.json({ error: inGate.status === 503 ? inGate.error.replace(/ Your credits were refunded\.| הקרדיטים הוחזרו\./g, '') : inGate.error }, { status: inGate.status });
  const charge = await chargePaidCredits({ admin, creator, cost: AN.cost });
  if (!charge.ok) return NextResponse.json({ error: `Animate uses purchased credits (${AN.cost} credits).`, needCredits: { cost: AN.cost, label: AN.label, paidOnly: true }, paid: await paidFor(creator) }, { status: 402 });
  const spend = await reserveSpend(AN.usd, { admin: true }); // paid work is never blocked by the free budget cap
  const pj = await ownedProject(creator.id, body?.project); // the project being worked in, if it is really theirs
  const fields = { u: creator.id, s: row.id, c: charge.source === 'paid' ? AN.cost : 0, x: Date.now() + JOB_TTL, ...(effect ? { e: effect } : {}), ...(pj ? { j: pj } : {}) };
  const r = await api(`models/${AN.model}/predictions`, { method: 'POST', body: JSON.stringify({ input: AN.input(effect ? await toVertical(row.public_url) : row.public_url, motion), ...hookFor(request, fields) }) }).catch(() => null);
  const p = r ? await r.json().catch(() => ({})) : {};
  if (!r || !r.ok || !p.id) {
    console.error('animate start', r?.status, p?.detail || p?.error || '');
    await spend.release(); await charge.refund();
    if (r && isDiscontinued(r.status, p)) await markDead(AN.model);
    return NextResponse.json({ error: startFailed(r), paid: await paidFor(creator) }, { status: r?.status === 429 ? 429 : 502 });
  }
  await logGeneration({ userId: creator.id, ip, mode: effect ? `effect:${effect}` : 'animate', prompt: raw, inputRef: row.id, outputRef: `pred:${p.id}`, moderation: 'passed:input-only' });
  await recordJob({ ...fields, p: p.id });
  const job = makeJob({ ...fields, p: p.id });
  const res = NextResponse.json({ job, status: 'processing', paid: admin ? undefined : await paidFor(creator), ...(admin ? { admin: true } : {}) });
  setCreatorCookie(res, creator);
  return res;
}

// A video on a model from the picker: { model, prompt, aspectRatio, duration, resolution } is text-to-video;
// with { id } of an image it starts from that picture (the prompt is then optional). Paid credits only.
async function startTextVideo(request, body, { admin, creator, ip }) {
  const def = Object.prototype.hasOwnProperty.call(VIDEO_TIERS, body.model) ? VIDEO_TIERS[body.model] : null;
  if (!def) return NextResponse.json({ error: 'Invalid video model.' }, { status: 400 });
  const fromImage = body?.id !== undefined && body?.id !== null;
  if (fromImage && (!isUuid(body.id) || !def.imageInput)) return NextResponse.json({ error: fromImage && !def.imageInput ? 'This model cannot start from an image.' : 'Invalid image id.' }, { status: 400 });
  if (await isDeadSlug(def.model)) return NextResponse.json({ error: MODEL_OFF_MSG, modelOff: body.model }, { status: 410 });
  const raw = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  if (!raw && !fromImage) return NextResponse.json({ error: 'Describe the video you want.' }, { status: 400 });
  if (raw.length > MAX_PROMPT_LENGTH) return NextResponse.json({ error: `Prompt is too long (max ${MAX_PROMPT_LENGTH}).` }, { status: 400 });
  const sb = getSupabase();
  if (!process.env.REPLICATE_API_TOKEN || !sb) return NextResponse.json({ error: 'Service temporarily unavailable.' }, { status: 503 });
  // The picture to start from: the person's own, or a public one. Never a video.
  let row = null;
  if (fromImage) {
    ({ data: row } = await sb.from('images').select('id, public_url, aspect_ratio, is_public, creator_id, storage_path').eq('id', body.id).maybeSingle());
    if (!row || (!row.is_public && (creator.isNew || row.creator_id !== creator.id))) return NextResponse.json({ error: 'Image not found.' }, { status: 404 });
    if (/\.mp4$/i.test(row.storage_path || '')) return NextResponse.json({ error: 'This is already a video.' }, { status: 400 });
  }
  // Price is computed here from the chosen duration/resolution (never trusted from the client).
  const pd = VIDEO_PRICING[body.model].def;
  const wanted = fromImage ? row.aspect_ratio : body?.aspectRatio; // a video from a picture has the picture's shape
  const q = videoQuote(body.model, body?.duration ?? pd.d, body?.resolution ?? pd.r, VALID_RATIOS.includes(wanted) ? wanted : '16:9', fromImage);
  if (!q) return NextResponse.json({ error: 'That duration / quality is not available for this model.' }, { status: 400 });
  const ratio = q.ratio;
  const tier = { ...def, cost: q.cost, usd: q.usd };
  // A short idea is filled in when the person left that on: what moves, and one camera movement. Not for a video
  // that starts from a picture: the words there are only the motion, and with none the model gets a plain gentle one.
  // `improved`: the screen already improved the idea (/api/improve); the video is made from that text.
  const given = typeof body?.improved === 'string' && raw && !fromImage ? body.improved.trim().slice(0, 2000) : '';
  const prepared = given ? { ...(await preparePrompt(given, { admin: true, budgetMs: 25_000 })), improved: true } : raw
    ? await preparePrompt(raw, { admin: true, budgetMs: 25_000, improve: body?.improve === true && !fromImage && shortIdea(raw) && await improveAllowed(creator.id, admin, admin ? false : await hasPro(creator.id)) ? 'video' : false, sound: VIDEO_WITH_SOUND.includes(body.model) })
    : { prompt: DEFAULT_MOTION, improved: false };
  const en = prepared.prompt;
  const bad = checkPromptText(en);
  if (bad) return NextResponse.json({ error: blockedMessage(bad) }, { status: 400 });
  if (!admin && !await rateLimit(`t2v:${creator.id}:${ip}`, 10, 60 * 60_000)) return NextResponse.json({ error: 'Video limit reached. Try again later.' }, { status: 429 });
  const loopEnd = fromImage && body?.loop === true && doorOpens(process.env, request.headers.get('x-test-login')) ? LOOP_END_INPUT[body.model] || null : null;
  let frame = null;
  if (fromImage) {
    // A finished video cannot be checked here, so the picture it starts from is checked before anything is charged.
    // Fails CLOSED (it is often a photo of a person).
    const inGate = await checkOutputImage(row.public_url, 'closed');
    if (inGate) {
      await logGeneration({ userId: creator.id, ip, mode: `i2v:${body.model}`, prompt: raw, inputRef: row.id, moderation: inGate.status === 422 ? 'blocked:input' : 'blocked:unavailable' });
      return NextResponse.json({ error: inGate.status === 503 ? inGate.error.replace(/ Your credits were refunded\.| הקרדיטים הוחזרו\./g, '') : inGate.error }, { status: inGate.status });
    }
    // TEST ADDRESS ONLY: a caller with the test door's secret sends the first frame at up to 1920 px, for a 1080p video.
    try { frame = await firstFrame(row.public_url, loopEnd || doorOpens(process.env, request.headers.get('x-test-login')) ? 1920 : 1280); } catch (e) { console.error('i2v first frame', e?.message || e); return NextResponse.json({ error: 'That image could not be read. Try another one.' }, { status: 400 }); }
  }
  const charge = await chargePaidCredits({ admin, creator, cost: tier.cost });
  if (!charge.ok) return NextResponse.json({ error: `${def.label} uses purchased credits (${tier.cost} credits).`, needCredits: { cost: tier.cost, label: def.label, paidOnly: true }, paid: await paidFor(creator) }, { status: 402 });
  const spend = await reserveSpend(tier.usd, { admin: true });
  const pj = await ownedProject(creator.id, body?.project); // the project being worked in, if it is really theirs
  const fields = { u: creator.id, s: row ? row.id : null, c: charge.source === 'paid' ? tier.cost : 0, x: Date.now() + JOB_TTL, t: body.model, ...(raw ? { pr: raw.slice(0, 600) } : {}), r: ratio, ...(pj ? { j: pj } : {}) };
  const input = { ...def.input(en, ratio, q.d, q.r), ...(frame ? { [def.imageInput]: frame } : {}), ...(frame && loopEnd ? { [loopEnd]: frame } : {}) };
  const r = await api(`models/${def.model}/predictions`, { method: 'POST', body: JSON.stringify({ input, ...hookFor(request, fields) }) }).catch(() => null);
  const p = r ? await r.json().catch(() => ({})) : {};
  if (!r || !r.ok || !p.id) {
    console.error(fromImage ? 'i2v start' : 't2v start', body.model, r?.status, p?.detail || p?.error || '');
    await spend.release(); await charge.refund();
    if (r && isDiscontinued(r.status, p)) { await markDead(def.model); return NextResponse.json({ error: `${MODEL_OFF_MSG} Your credits were returned.`, modelOff: body.model, paid: await paidFor(creator) }, { status: 410 }); }
    return NextResponse.json({ error: startFailed(r), paid: await paidFor(creator) }, { status: r?.status === 429 ? 429 : 502 });
  }
  await logGeneration({ userId: creator.id, ip, mode: `${fromImage ? 'i2v' : 't2v'}:${body.model}`, prompt: given ? `${raw} [made from: ${given}]` : raw, ...(row ? { inputRef: row.id } : {}), outputRef: `pred:${p.id}`, moderation: fromImage ? 'passed:input-only' : 'passed:text-only' });
  await recordJob({ ...fields, p: p.id });
  const job = makeJob({ ...fields, p: p.id });
  const res = NextResponse.json({ job, status: 'processing', ...(prepared.untranslated ? { notice: 'untranslated' } : {}), ...(prepared.improved ? { usedPrompt: en } : {}), ...(admin ? { admin: true } : { paid: await paidFor(creator) }) });
  setCreatorCookie(res, creator);
  return res;
}

// What to tell the person when a job ended without a video. `lost`: the run finished but the file could not be kept.
const failText = (out) => out.blocked ? `This video looks explicit and is not allowed.${out.charged ? ' Your credits were returned.' : ''}`
  : out.unchecked ? `The safety check is busy, so the video could not be kept.${out.charged ? ' Your credits were returned.' : ''}`
  : `${out.lost ? 'The video was made but could not be saved' : 'The video failed'}${out.charged ? '. Your credits were returned.' : '.'}`;

// GET ?job=<token>  -> { status: processing | done | failed, item? }   (the tab that started the video)
// GET ?pending=1    -> { jobs: [...] }  every unfinished video of this creator, finishing any that are ready
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const creator = getCreatorId(request);
  if (!getSupabase()) return NextResponse.json({ error: 'Service temporarily unavailable.' }, { status: 503 });

  if (params.get('pending')) {
    if (creator.isNew) return NextResponse.json({ jobs: [] });
    const rows = await pendingJobs(creator.id);
    const jobs = [];
    for (const row of rows.slice(0, 3)) { // at most 3 saves per request (each may download a video)
      const out = await finalizeJob(jobFromRow(row));
      jobs.push({ id: row.prediction_id.slice(0, 12), kind: row.kind, prompt: row.prompt, started: row.created_at, status: out.status, ...(out.item ? { item: out.item } : {}), ...(out.status === 'failed' ? { error: failText(out) } : {}) });
    }
    for (const row of rows.slice(3)) jobs.push({ id: row.prediction_id.slice(0, 12), kind: row.kind, prompt: row.prompt, started: row.created_at, status: 'processing' });
    // Videos saved before conversion existed are converted here, a couple per visit.
    const repaired = await repairRecent(creator.id).catch((e) => { console.error('video repair', e?.message || e); return []; });
    return NextResponse.json({ jobs, repaired, paid: await paidFor(creator) });
  }

  const job = readJob(params.get('job'));
  if (!job || !job.p || creator.isNew || creator.id !== job.u) return NextResponse.json({ error: 'Unknown video job.' }, { status: 404 });
  const out = await finalizeJob(job);
  if (out.status === 'done') return NextResponse.json({ status: 'done', item: out.item });
  if (out.status === 'failed') return NextResponse.json({ status: 'failed', error: failText(out), paid: await paidFor(creator) });
  return NextResponse.json({ status: 'processing' });
}

// Every refusal is written to the log with its reason (lib/refusals.js).
export const POST = refusalLog('animate', handlePost);
