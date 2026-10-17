import { NextResponse } from 'next/server';
import {
  readCreditsCookie, setCreditsCookie, getClientIp, ipRemaining,
  chargeIpAsync, refundIpAsync, COOKIE_NAME, chargeCredits, paidFor,
} from '../../../lib/credits';
import { persistImage, runPrediction, buildFinalPrompt, MAX_PROMPT_LENGTH, VALID_STYLES, VALID_RATIOS } from '../../../lib/generation';
import { getCreatorId, setCreatorCookie, isUuid } from '../../../lib/identity';

import { isAdmin } from '../../../lib/admin';
import { MODEL_TIERS, DEFAULT_TIER, guidedTier, TEXT_TIERS } from '../../../lib/models';
import { getSupabase } from '../../../lib/supabase';
import { reserveSpend, PAUSED_MSG } from '../../../lib/usage';
import { applyFormat, isFormat, FORMATS } from '../../../lib/formats';
import { getTheme } from '../../../lib/daily';
import { issueCutoutPass } from '../../../lib/cutoutPass';
import { toEnglishPrompt, TRANSLATE_BUSY_MSG } from '../../../lib/translate';
import { checkPromptText, blockedMessage, classifyImage, outputGate } from '../../../lib/moderation';
import { makeDeadline, once } from '../../../lib/deadline';
import { isBanned, BANNED_MSG, logGeneration } from '../../../lib/trustSafety';
import { withErrorLog } from '../../../lib/monitor';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';


// Any moderation hit blocks generation (private creation included), not just publishing.

function jsonError(message, status, credits) {
  return NextResponse.json({ error: message, ...(credits !== undefined ? { credits } : {}) }, { status });
}

async function POSTHandler(request) {
  const dl = makeDeadline(); // overall time budget, see lib/deadline.js
  const ip = getClientIp(request);
  const state = readCreditsCookie(request.cookies.get(COOKIE_NAME)?.value);
  const admin = isAdmin(request);
  const currentCredits = () => (admin ? null : Math.min(state.remaining, ipRemaining(ip)));

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid request.', 400);
  }
  const { prompt, style, aspectRatio, remixOf, tier, guideId, guideFollow, daily } = body || {};
  const format = isFormat(body?.format) ? body.format : 'free';
  const creator = getCreatorId(request);

  if (typeof prompt !== 'string' || prompt.trim() === '') {
    return jsonError('Please provide a valid prompt.', 400);
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return jsonError(`Prompt is too long (max ${MAX_PROMPT_LENGTH} characters).`, 400);
  }
  const selectedStyle = style === undefined ? 'Cinematic' : style;
  if (!VALID_STYLES.includes(selectedStyle)) {
    return jsonError('Invalid style.', 400);
  }
  const selectedRatio = FORMATS[format].ratio || (aspectRatio === undefined ? '1:1' : aspectRatio);
  if (!VALID_RATIOS.includes(selectedRatio)) {
    return jsonError('Invalid aspect ratio.', 400);
  }

  const selectedTier = tier === undefined ? DEFAULT_TIER : tier;
  if (typeof selectedTier !== 'string' || !Object.prototype.hasOwnProperty.call(MODEL_TIERS, selectedTier)) {
    return jsonError('Invalid model.', 400);
  }
  let tierDef = MODEL_TIERS[selectedTier];
  let storedTier = selectedTier;
  let guideParent = null;
  if (guideId !== undefined && guideId !== null) {
    if (!isUuid(guideId)) return jsonError('Invalid guide image.', 400);
    const supabase = getSupabase();
    if (!supabase) return jsonError('Cloud storage is not available.', 503);
    const { data: g } = await supabase.from('images').select('id, public_url, is_public, creator_id').eq('id', guideId).maybeSingle();
    if (!g || (!g.is_public && (creator.isNew || g.creator_id !== creator.id))) return jsonError('Guide image not found.', 404);
    tierDef = guidedTier(g.public_url, Number(guideFollow));
    storedTier = 'guided';
    guideParent = g.id;
  }
  const cost = tierDef.cost;

  if (!process.env.REPLICATE_API_TOKEN) {
    console.error('Missing REPLICATE_API_TOKEN');
    return jsonError('Service temporarily unavailable.', 503);
  }

  // Prompt safety check on the original text, before any charge or spend.
  const glog = (moderation, outputRef) => logGeneration({ userId: creator.id, ip, mode: guideParent ? 'generate:guided' : 'generate', prompt, inputRef: guideParent, outputRef, moderation });
  if (!admin && await isBanned(creator.id)) return jsonError(BANNED_MSG, 403);
  const badOriginal = checkPromptText(prompt);
  if (badOriginal) { await glog('blocked:text'); return jsonError(blockedMessage(badOriginal), 400); }

  // Charge before calling Replicate (admin bypasses credits and rate limits). Free first, then paid balance.
  const notEnough = async () => NextResponse.json({ error: `Not enough credits for ${tierDef.label} (costs ${cost}).`, needCredits: { cost, label: tierDef.label }, credits: currentCredits(), paid: await paidFor(creator) }, { status: 402 });
  const charge = await chargeCredits({ admin, state, ip, creator, cost });
  if (!charge.ok && charge.block === 'minute') {
    return jsonError('Too many requests. Please wait a minute.', 429, currentCredits());
  }
  if (!charge.ok) return notEnough();

  const spend = await reserveSpend(tierDef.usd || 0.01, { admin: admin || charge.source === 'paid' });
  if (!spend.ok) {
    await charge.refund();
    return jsonError(PAUSED_MSG, 503, admin ? null : currentCredits());
  }
  const refund = once(async () => { await spend.release(); await charge.refund(); });
  let finished = false; // set once a success response is ready; the finally block refunds anything else

  try {
    // Transparent translation: any language -> descriptive English (on-image text kept verbatim in Text mode). Fails open.
    const englishPrompt = await toEnglishPrompt(prompt.trim(), { keepText: TEXT_TIERS.includes(selectedTier) && storedTier === selectedTier, admin, budgetMs: dl.budget(4000, 40_000), strict: Boolean(guideParent) });
    if (englishPrompt === null) { // guide photo may show a real person: don't run a prompt we could not moderate
      await refund();
      const res = jsonError(TRANSLATE_BUSY_MSG, 503, currentCredits());
      if (!admin) setCreditsCookie(res, state);
      return res;
    }

    const badEnglish = checkPromptText(englishPrompt);
    if (badEnglish) {
      await glog('blocked:text');
      await refund();
      const res = jsonError(blockedMessage(badEnglish), 400, currentCredits());
      if (!admin) setCreditsCookie(res, state);
      return res;
    }

    const finalPrompt = buildFinalPrompt(applyFormat(englishPrompt, format), selectedStyle);
    const dailyTheme = daily === true ? await getTheme() : null;
    const result = await runPrediction(finalPrompt, selectedRatio, tierDef, { budgetMs: dl.budget(55_000, 12_000) }); // keep ~12s for safety check + save

    if (result.error) {
      await refund();
      const status = result.error === 'timeout' ? 504 : 502;
      const msg = result.error === 'timeout'
        ? 'Generation timed out. Your credits were refunded.'
        : 'Image generation failed. Your credits were refunded.';
      const res = jsonError(msg, status, currentCredits());
      if (!admin) setCreditsCookie(res, state);
      return res;
    }

    // Output safety check before saving: NSFW -> refund, nothing stored. Plain text-to-image fails OPEN if the classifier
    // is unavailable (prompt was already text-checked); a guide image (could be a real photo) fails CLOSED.
    const cBudget = dl.budget(15_000, 6000);
    const gate = outputGate(cBudget >= 2000 ? await classifyImage(result.url, { budgetMs: cBudget }) : 'unavailable', guideParent ? 'closed' : 'open');
    if (gate) {
      await glog(gate.status === 422 ? 'blocked:output' : 'blocked:unavailable');
      await refund();
      const res = jsonError(gate.error, gate.status, currentCredits());
      if (!admin) setCreditsCookie(res, state);
      return res;
    }

    const stored = await persistImage({
      sourceUrl: result.url, prompt: prompt.trim(), style: selectedStyle, ratio: selectedRatio,
      creatorId: creator.id, remixOf: guideParent || (isUuid(remixOf) ? remixOf : null), tier: storedTier,
      extra: { ...(format !== 'free' ? { format } : {}), ...(dailyTheme ? { daily_day: dailyTheme.day, daily_theme: dailyTheme.text } : {}) },
      budgetMs: Math.max(3000, dl.budget(20_000, 1000)),
    });
    await glog('passed', stored?.id || 'unsaved');

    const res = NextResponse.json({
      success: true,
      imageUrl: stored?.id ? stored.url : result.url,
      id: stored?.id || null,
      stored: Boolean(stored?.id),
      ...(stored?.id ? {} : { persistError: stored?.error || 'unknown error' }),
      ...(stored?.id && FORMATS[format]?.autoCutout ? { cutoutPass: issueCutoutPass(stored.id, creator.id) } : {}),
      ...(charge.source === 'paid' ? { chargedFrom: 'paid' } : {}), // the client tells the user paid credits were used
      tier: storedTier, format, ...(dailyTheme ? { daily: dailyTheme.day } : {}),
      credits: currentCredits(), ...(admin ? {} : { paid: await paidFor(creator) }),
      ...(admin ? { admin: true } : {}),
    });
    if (!admin) setCreditsCookie(res, state);
    setCreatorCookie(res, creator);
    finished = true;
    return res;
  } catch (error) {
    console.error('Server Error:', error);
    await refund();
    const res = jsonError('Internal server error. Your credits were refunded.', 500, currentCredits());
    if (!admin) setCreditsCookie(res, state);
    return res;
  } finally {
    if (!finished) await refund(); // guaranteed: every non-success exit is refunded (idempotent)
  }
}

export const POST = withErrorLog('/api/generate', POSTHandler);
