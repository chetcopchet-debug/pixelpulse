// Shared handler for image -> image tools (Sharpen, Cutout).
import { NextResponse } from 'next/server';
import { readCreditsCookie, setCreditsCookie, getClientIp, ipRemaining, chargeIpAsync, refundIpAsync, COOKIE_NAME, chargeCredits, chargePaidCredits, paidFor } from './credits';
import { reserveSpend, PAUSED_MSG } from './usage';
import { getSupabase } from './supabase';
import { getCreatorId, setCreatorCookie, isUuid } from './identity';
import { isAdmin } from './admin';
import { rateLimit } from './ratelimit';
import { persistImage } from './generation';
import { runReplicate, firstUrl, TOOLS } from './replicate';
import { classifyImage, outputGate } from './moderation';
import { makeDeadline, once } from './deadline';
import { isBanned, BANNED_MSG, logGeneration } from './trustSafety';

export async function runImageTool(request, { tool, cost: baseCost, label, limit, prepare, usd = 0.01, storeTier, freePass, def: toolDef, paidOnly, ownOnly, outputPolicy }) {
  const dl = makeDeadline(); // overall time budget (Vercel kills the function at 60s without cleanup)
  let cost = baseCost;
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

  const { data: row, error: qErr } = await supabase.from('images')
    .select('id, prompt, style, aspect_ratio, public_url, is_public, creator_id, model').eq('id', body.id).maybeSingle();
  if (qErr) { console.error(`${label} lookup:`, qErr); return err('Could not load the image.', 500); }
  if (!row || (!row.is_public && (creator.isNew || row.creator_id !== creator.id))) return err('Image not found.', 404);
  if (ownOnly && !admin && (creator.isNew || row.creator_id !== creator.id)) return err('Use one of your own photos for this.', 403);
  if (!admin && await isBanned(creator.id)) return err(BANNED_MSG, 403);
  const glog = (moderation, outputRef) => logGeneration({ userId: creator.id, ip, mode: tool, prompt: (prepare && extra.promptLabel) || row.prompt, inputRef: row.id, outputRef, moderation });

  // Server-verified exemption (e.g. auto Cutout right after a Sticker generation that was already charged)
  if (!admin && cost > 0 && freePass && !creator.isNew && row.creator_id === creator.id && await freePass(body, row, creator)) cost = 0;
  if (!admin && limit && !await rateLimit(`${tool}:${creator.id}:${ip}`, limit.n, limit.ms)) {
    return err(`${label} limit reached. Try again later.`, 429);
  }
  const charge = paidOnly ? await chargePaidCredits({ admin, creator, cost }) : await chargeCredits({ admin, state, ip, creator, cost });
  if (!charge.ok && charge.block === 'minute') return err('Too many requests. Please wait a minute.', 429);
  if (!charge.ok) return NextResponse.json({ error: `${paidOnly ? `${label} uses purchased credits (${cost}⚡).` : `Not enough credits for ${label} (costs ${cost}).`}`, needCredits: { cost, label, ...(paidOnly ? { paidOnly: true } : {}) }, credits: credits(), paid: await paidFor(creator) }, { status: 402 });
  const finish = (res) => { if (!admin && cost > 0) setCreditsCookie(res, state); setCreatorCookie(res, creator); return res; };
  const spend = await reserveSpend(usd, { admin: admin || charge.source === 'paid' });
  if (!spend.ok) {
    await charge.refund();
    return err(PAUSED_MSG, 503);
  }
  const refund = once(async () => { await spend.release(); await charge.refund(); });
  let finished = false;

  try {
    const def = toolDef || TOOLS[tool];
    const r = await runReplicate({ model: def.model, version: def.version, input: def.input(row.public_url, ...extra), budgetMs: dl.budget(50_000, outputPolicy ? 12_000 : 6000) });
    const url = r.output ? firstUrl(r.output) : null;
    if (!url) {
      await refund();
      return finish(err(`${label} failed${cost ? ', your credit was refunded' : ''}.`, r.error === 'timeout' ? 504 : 502));
    }
    // Output safety check BEFORE anything is saved: an NSFW result is never persisted and the charge is refunded.
    // outputPolicy: 'closed' = block if the classifier is unavailable, 'open' = allow; undefined = no check (cutout/sharpen).
    if (outputPolicy) {
      const cBudget = dl.budget(15_000, 6000);
      const gate = outputGate(cBudget >= 2000 ? await classifyImage(url, { budgetMs: cBudget }) : 'unavailable', outputPolicy);
      if (gate) { await glog(gate.status === 422 ? 'blocked:output' : 'blocked:unavailable'); await refund(); return finish(err(gate.error, gate.status)); }
    }
    const stored = await persistImage({
      sourceUrl: url, prompt: (prepare && extra.promptLabel) || row.prompt, style: row.style, ratio: extra.ratio || row.aspect_ratio,
      creatorId: creator.id, remixOf: row.id, tier: storeTier || row.model || null, budgetMs: Math.max(3000, dl.budget(20_000, 1000)),
    });
    await glog(outputPolicy ? 'passed' : 'unchecked', stored?.id || 'unsaved');
    if (!stored?.id) {
      await refund();
      return finish(err(`Could not save the result (${stored?.error || 'unknown'})${cost ? ', your credit was refunded' : ''}.`, 500));
    }
    finished = true;
    return finish(NextResponse.json({
      success: true, id: stored.id, imageUrl: stored.url, tool, ...(charge.source === 'paid' && !paidOnly ? { chargedFrom: 'paid' } : {}),
      item: { id: stored.id, public_url: stored.url, prompt: (prepare && extra.promptLabel) || row.prompt, style: row.style, aspect_ratio: extra.ratio || row.aspect_ratio,
        model: storeTier || row.model || null, remix_of: row.id, is_public: false, likes: 0 },
      credits: credits(), ...(admin ? { admin: true } : { paid: await paidFor(creator) }),
    }));
  } catch (e) {
    console.error(`${label} error:`, e);
    await refund();
    return finish(err('Internal server error.', 500));
  } finally {
    if (!finished) await refund(); // guaranteed refund on every non-success exit (idempotent)
  }
}
