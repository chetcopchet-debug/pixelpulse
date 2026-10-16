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
import { toEnglishPrompt } from '../../../lib/translate';
import { checkPromptText, blockedMessage, checkOutputImage } from '../../../lib/moderation';
import { isBanned, BANNED_MSG, logGeneration } from '../../../lib/trustSafety';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';


// Any moderation hit blocks generation (private creation included), not just publishing.

function jsonError(message, status, credits) {
  return NextResponse.json({ error: message, ...(credits !== undefined ? { credits } : {}) }, { status });
}

export async function POST(request) {
  const ip = getClientIp(request);
  const state = readCreditsCookie(request.cookies.get(COOKIE_NAME)?.value);
  const admin = isAdmin(request);
  const currentCredits = () => (admin ? null : Math.min(state.remaining, ipRemaining(ip)));

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid request. / בקשה לא תקינה.', 400);
  }
  const { prompt, style, aspectRatio, remixOf, tier, guideId, guideFollow, daily } = body || {};
  const format = isFormat(body?.format) ? body.format : 'free';
  const creator = getCreatorId(request);

  if (typeof prompt !== 'string' || prompt.trim() === '') {
    return jsonError('Please provide a valid prompt. / נא להזין תיאור לתמונה.', 400);
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return jsonError(`Prompt is too long (max ${MAX_PROMPT_LENGTH} characters). / התיאור ארוך מדי (עד ${MAX_PROMPT_LENGTH} תווים).`, 400);
  }
  const selectedStyle = style === undefined ? 'Cinematic' : style;
  if (!VALID_STYLES.includes(selectedStyle)) {
    return jsonError('Invalid style. / סגנון לא תקין.', 400);
  }
  const selectedRatio = FORMATS[format].ratio || (aspectRatio === undefined ? '1:1' : aspectRatio);
  if (!VALID_RATIOS.includes(selectedRatio)) {
    return jsonError('Invalid aspect ratio. / יחס תמונה לא תקין.', 400);
  }

  const selectedTier = tier === undefined ? DEFAULT_TIER : tier;
  if (typeof selectedTier !== 'string' || !Object.prototype.hasOwnProperty.call(MODEL_TIERS, selectedTier)) {
    return jsonError('Invalid model. / מודל לא תקין.', 400);
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
    return jsonError('Service temporarily unavailable. / השירות אינו זמין כרגע.', 503);
  }

  // Prompt safety check on the original text, before any charge or spend.
  const glog = (moderation, outputRef) => logGeneration({ userId: creator.id, ip, mode: guideParent ? 'generate:guided' : 'generate', prompt, inputRef: guideParent, outputRef, moderation });
  if (!admin && await isBanned(creator.id)) return jsonError(BANNED_MSG, 403);
  const badOriginal = checkPromptText(prompt);
  if (badOriginal) { await glog('blocked:text'); return jsonError(blockedMessage(badOriginal), 400); }

  // Charge before calling Replicate (admin bypasses credits and rate limits). Free first, then paid balance.
  const notEnough = async () => NextResponse.json({ error: `Not enough credits for ${tierDef.label} (costs ${cost}). / אין מספיק קרדיטים למודל הזה.`, needCredits: { cost, label: tierDef.label }, credits: currentCredits(), paid: await paidFor(creator) }, { status: 402 });
  const charge = await chargeCredits({ admin, state, ip, creator, cost });
  if (!charge.ok && charge.block === 'minute') {
    return jsonError('Too many requests. Please wait a minute. / יותר מדי בקשות, נא להמתין דקה.', 429, currentCredits());
  }
  if (!charge.ok) return notEnough();

  const spend = await reserveSpend(tierDef.usd || 0.01, { admin: admin || charge.source === 'paid' });
  if (!spend.ok) {
    await charge.refund();
    return jsonError(PAUSED_MSG, 503, admin ? null : currentCredits());
  }
  const refund = async () => { await spend.release(); await charge.refund(); };

  try {
    // Transparent translation: any language -> descriptive English (on-image text kept verbatim in Text mode). Fails open.
    const englishPrompt = await toEnglishPrompt(prompt.trim(), { keepText: TEXT_TIERS.includes(selectedTier) && storedTier === selectedTier, admin });

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
    const result = await runPrediction(finalPrompt, selectedRatio, tierDef);

    if (result.error) {
      await refund();
      const status = result.error === 'timeout' ? 504 : 502;
      const msg = result.error === 'timeout'
        ? 'Generation timed out. Your credits were refunded. / היצירה לקחה יותר מדי זמן, הקרדיט הוחזר.'
        : 'Image generation failed. Your credits were refunded. / יצירת התמונה נכשלה, הקרדיט הוחזר.';
      const res = jsonError(msg, status, currentCredits());
      if (!admin) setCreditsCookie(res, state);
      return res;
    }

    // Output safety check before saving: NSFW -> refund, nothing stored. Plain text-to-image fails OPEN if the classifier
    // is unavailable (prompt was already text-checked); a guide image (could be a real photo) fails CLOSED.
    const gate = await checkOutputImage(result.url, guideParent ? 'closed' : 'open');
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
    });
    await glog('passed', stored?.id || 'unsaved');

    const res = NextResponse.json({
      success: true,
      imageUrl: stored?.id ? stored.url : result.url,
      id: stored?.id || null,
      stored: Boolean(stored?.id),
      ...(stored?.id ? {} : { persistError: stored?.error || 'unknown error' }),
      ...(stored?.id && FORMATS[format]?.autoCutout ? { cutoutPass: issueCutoutPass(stored.id, creator.id) } : {}),
      tier: storedTier, format, ...(dailyTheme ? { daily: dailyTheme.day } : {}),
      credits: currentCredits(), ...(admin ? {} : { paid: await paidFor(creator) }),
      ...(admin ? { admin: true } : {}),
    });
    if (!admin) setCreditsCookie(res, state);
    setCreatorCookie(res, creator);
    return res;
  } catch (error) {
    console.error('Server Error:', error);
    await refund();
    const res = jsonError('Internal server error. Your credits were refunded. / שגיאת שרת, הקרדיט הוחזר.', 500, currentCredits());
    if (!admin) setCreditsCookie(res, state);
    return res;
  }
}
