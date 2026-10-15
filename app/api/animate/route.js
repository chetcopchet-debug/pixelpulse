import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getClientIp, chargePaidCredits, paidFor } from '../../../lib/credits';
import { grantPaid } from '../../../lib/paid';
import { reserveSpend, bump, PAUSED_MSG } from '../../../lib/usage';
import { getSupabase } from '../../../lib/supabase';
import { getCreatorId, setCreatorCookie, isUuid } from '../../../lib/identity';
import { isAdmin } from '../../../lib/admin';
import { rateLimit } from '../../../lib/ratelimit';
import { persistBytes, MAX_PROMPT_LENGTH } from '../../../lib/generation';
import { toEnglishPrompt } from '../../../lib/translate';
import { checkPromptText } from '../../../lib/moderation';
import { PREMIUM } from '../../../lib/models';
import { makeJob, readJob } from '../../../lib/animateJob';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
const AN = PREMIUM.animate;
const DEFAULT_MOTION = 'subtle natural cinematic motion, gentle slow camera push-in, lifelike movement, keep the scene and subject consistent';
const JOB_TTL = 60 * 60_000;
const api = (path, init = {}) => fetch(`https://api.replicate.com/v1/${path}`, { cache: 'no-store', ...init,
  headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
const fileFor = (pred) => crypto.createHash('sha256').update(`anim.${pred}`).digest('hex').slice(0, 32);
const ITEM_COLS = 'id, public_url, prompt, style, aspect_ratio, remix_of, is_public, likes';
const toItem = (r) => ({ ...r, model: 'animate', is_public: Boolean(r.is_public), likes: r.likes || 0 });

// POST { id, prompt? } -> { job } (start). Charged up front from PAID credits; refunded if the video fails.
export async function POST(request) {
  const admin = isAdmin(request);
  const creator = getCreatorId(request);
  const ip = getClientIp(request);
  const body = await request.json().catch(() => ({}));
  if (!isUuid(body?.id)) return NextResponse.json({ error: 'Invalid image id.' }, { status: 400 });
  const raw = typeof body?.prompt === 'string' ? body.prompt.trim().slice(0, MAX_PROMPT_LENGTH) : '';
  const sb = getSupabase();
  if (!sb || !process.env.REPLICATE_API_TOKEN) return NextResponse.json({ error: 'Service temporarily unavailable.' }, { status: 503 });
  const { data: row } = await sb.from('images').select('id, public_url, prompt, aspect_ratio, is_public, creator_id, storage_path').eq('id', body.id).maybeSingle();
  if (!row || (!row.is_public && (creator.isNew || row.creator_id !== creator.id))) return NextResponse.json({ error: 'Image not found.' }, { status: 404 });
  if (/\.mp4$/i.test(row.storage_path || '')) return NextResponse.json({ error: 'This is already a video.' }, { status: 400 });
  let motion = DEFAULT_MOTION;
  if (raw) {
    const en = await toEnglishPrompt(raw);
    const bad = checkPromptText(en);
    if (bad && !/published to the feed/.test(bad)) return NextResponse.json({ error: bad }, { status: 400 });
    motion = `${en}. Keep the scene and subject consistent.`;
  }
  if (!admin && !await rateLimit(`animate:${creator.id}:${ip}`, 10, 60 * 60_000)) return NextResponse.json({ error: 'Animate limit reached. Try again later.' }, { status: 429 });

  const charge = await chargePaidCredits({ admin, creator, cost: AN.cost });
  if (!charge.ok) return NextResponse.json({ error: `Animate uses purchased credits (${AN.cost}⚡).`, needCredits: { cost: AN.cost, label: AN.label, paidOnly: true }, paid: await paidFor(creator) }, { status: 402 });
  const spend = await reserveSpend(AN.usd, { admin: true }); // paid work is never blocked by the free budget cap
  const r = await api(`models/${AN.model}/predictions`, { method: 'POST', body: JSON.stringify({ input: AN.input(row.public_url, motion) }) }).catch(() => null);
  const p = r ? await r.json().catch(() => ({})) : {};
  if (!r || !r.ok || !p.id) {
    console.error('animate start', r?.status, p?.detail || p?.error || '');
    await spend.release(); await charge.refund();
    return NextResponse.json({ error: 'Could not start the video, your credits were refunded.', paid: await paidFor(creator) }, { status: 502 });
  }
  const job = makeJob({ p: p.id, u: creator.id, s: row.id, c: charge.source === 'paid' ? AN.cost : 0, x: Date.now() + JOB_TTL });
  const res = NextResponse.json({ job, status: 'processing', paid: admin ? undefined : await paidFor(creator), ...(admin ? { admin: true } : {}) });
  setCreatorCookie(res, creator);
  return res;
}

// GET ?job=<token> -> { status: processing | done | failed, item? }
export async function GET(request) {
  const job = readJob(new URL(request.url).searchParams.get('job'));
  const creator = getCreatorId(request);
  if (!job || creator.isNew || creator.id !== job.u) return NextResponse.json({ error: 'Unknown video job.' }, { status: 404 });
  const sb = getSupabase(); if (!sb) return NextResponse.json({ error: 'Service temporarily unavailable.' }, { status: 503 });
  const name = fileFor(job.p), path = `i/${name}.mp4`;
  const done = async () => {
    const { data } = await sb.from('images').select(ITEM_COLS).eq('storage_path', path).maybeSingle();
    return data ? NextResponse.json({ status: 'done', item: toItem(data) }) : null;
  };
  const already = await done(); if (already) return already;

  const r = await api(`predictions/${encodeURIComponent(job.p)}`).catch(() => null);
  const p = r && r.ok ? await r.json().catch(() => ({})) : null;
  if (!p) return NextResponse.json({ status: 'processing' });
  if (p.status === 'failed' || p.status === 'canceled') {
    if (job.c > 0 && await bump(`animref:${job.p}`, 1, 1) !== null) await grantPaid(job.u, job.c).catch((e) => console.error('animate refund', e));
    console.error('animate failed', p.error);
    return NextResponse.json({ status: 'failed', error: `The video failed${job.c ? ', your credits were refunded' : ''}.`, paid: await paidFor(creator) });
  }
  if (p.status !== 'succeeded') return NextResponse.json({ status: 'processing' });
  const url = Array.isArray(p.output) ? p.output[0] : typeof p.output === 'string' ? p.output : null;
  if (!url) return NextResponse.json({ status: 'failed', error: 'The video failed.' });
  if (await bump(`animsave:${job.p}`, 1, 1) === null) return NextResponse.json({ status: 'processing' }); // another poll is saving it
  try {
    const v = await fetch(url, { cache: 'no-store' });
    if (!v.ok) throw new Error(`download ${v.status}`);
    const bytes = Buffer.from(await v.arrayBuffer());
    const { data: src } = await sb.from('images').select('prompt, style, aspect_ratio').eq('id', job.s).maybeSingle();
    const stored = await persistBytes({ bytes, contentType: 'video/mp4', prompt: src?.prompt || 'Animated image', style: src?.style || 'None',
      ratio: src?.aspect_ratio || '1:1', creatorId: job.u, remixOf: job.s, tier: 'animate', fixedName: name });
    if (!stored?.id) throw new Error(stored?.error || 'save failed');
    return (await done()) || NextResponse.json({ status: 'done', item: toItem({ id: stored.id, public_url: stored.url, prompt: src?.prompt, style: src?.style, aspect_ratio: src?.aspect_ratio, remix_of: job.s }) });
  } catch (e) {
    console.error('animate save', e?.message || e);
    await bump(`animsave:${job.p}`, -1, 1e9).catch(() => {});
    return NextResponse.json({ status: 'processing' });
  }
}
