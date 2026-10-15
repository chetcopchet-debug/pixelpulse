// Shared handler for image -> image tools (Sharpen, Cutout).
import { NextResponse } from 'next/server';
import { readCreditsCookie, setCreditsCookie, getClientIp, ipRemaining, chargeIpAsync, refundIpAsync, COOKIE_NAME } from './credits';
import { reserveSpend, PAUSED_MSG } from './usage';
import { getSupabase } from './supabase';
import { getCreatorId, setCreatorCookie, isUuid } from './identity';
import { isAdmin } from './admin';
import { rateLimit } from './ratelimit';
import { persistImage } from './generation';
import { runReplicate, firstUrl, TOOLS } from './replicate';

export async function runImageTool(request, { tool, cost, label, limit, prepare, usd = 0.01 }) {
  const ip = getClientIp(request);
  const state = readCreditsCookie(request.cookies.get(COOKIE_NAME)?.value);
  const admin = isAdmin(request);
  const creator = getCreatorId(request);
  const credits = () => (admin ? null : Math.min(state.remaining, ipRemaining(ip)));
  const err = (error, status) => NextResponse.json({ error, credits: credits() }, { status });

  const body = await request.json().catch(() => ({}));
  if (!isUuid(body?.id)) return err('Invalid image id.', 400);
  let extra = [];
  if (prepare) {
    const pr = await prepare(body);
    if (pr.error) return err(pr.error, 400);
    extra = pr.args;
  }
  const supabase = getSupabase();
  if (!supabase) return err('Cloud storage is not available.', 503);
  if (!process.env.REPLICATE_API_TOKEN) return err('Service temporarily unavailable.', 503);

  let { data: row, error: qErr } = await supabase.from('images')
    .select('id, prompt, style, aspect_ratio, public_url, is_public, creator_id, model').eq('id', body.id).maybeSingle();
  if (qErr && /model/i.test(qErr.message || '')) ({ data: row, error: qErr } = await supabase.from('images')
    .select('id, prompt, style, aspect_ratio, public_url, is_public, creator_id').eq('id', body.id).maybeSingle());
  if (qErr) { console.error(`${label} lookup:`, qErr); return err('Could not load the image.', 500); }
  if (!row || (!row.is_public && (creator.isNew || row.creator_id !== creator.id))) return err('Image not found.', 404);

  if (!admin && limit && !await rateLimit(`${tool}:${creator.id}:${ip}`, limit.n, limit.ms)) {
    return err(`${label} limit reached. Try again later.`, 429);
  }
  if (!admin && cost > 0) {
    if (state.remaining < cost) return err(`Not enough credits for ${label} (costs ${cost}).`, 402);
    const block = await chargeIpAsync(ip, cost);
    if (block === 'daily') return err(`Not enough credits for ${label} (costs ${cost}).`, 402);
    if (block === 'minute') return err('Too many requests. Please wait a minute.', 429);
    state.remaining -= cost;
  }
  const finish = (res) => { if (!admin && cost > 0) setCreditsCookie(res, state); setCreatorCookie(res, creator); return res; };
  const spend = await reserveSpend(usd, { admin });
  if (!spend.ok) {
    if (!admin && cost > 0) { state.remaining += cost; await refundIpAsync(ip, cost); }
    return err(PAUSED_MSG, 503);
  }
  const refund = async () => { await spend.release(); if (admin || cost <= 0) return; state.remaining += cost; await refundIpAsync(ip, cost); };

  try {
    const def = TOOLS[tool];
    const r = await runReplicate({ model: def.model, version: def.version, input: def.input(row.public_url, ...extra) });
    const url = r.output ? firstUrl(r.output) : null;
    if (!url) {
      await refund();
      return finish(err(`${label} failed${cost ? ', your credit was refunded' : ''}.`, r.error === 'timeout' ? 504 : 502));
    }
    const stored = await persistImage({
      sourceUrl: url, prompt: (prepare && extra.promptLabel) || row.prompt, style: row.style, ratio: row.aspect_ratio,
      creatorId: creator.id, remixOf: row.id, tier: row.model || null,
    });
    if (!stored?.id) {
      await refund();
      return finish(err(`Could not save the result (${stored?.error || 'unknown'})${cost ? ', your credit was refunded' : ''}.`, 500));
    }
    return finish(NextResponse.json({
      success: true, id: stored.id, imageUrl: stored.url, tool,
      item: { id: stored.id, public_url: stored.url, prompt: (prepare && extra.promptLabel) || row.prompt, style: row.style, aspect_ratio: row.aspect_ratio,
        model: row.model || null, remix_of: row.id, is_public: false, likes: 0 },
      credits: credits(), ...(admin ? { admin: true } : {}),
    }));
  } catch (e) {
    console.error(`${label} error:`, e);
    await refund();
    return finish(err('Internal server error.', 500));
  }
}
