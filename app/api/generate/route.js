import { NextResponse } from 'next/server';
import {
  readCreditsCookie, setCreditsCookie, getClientIp, ipRemaining,
  chargeIp, refundIp, COOKIE_NAME,
} from '../../../lib/credits';
import { persistImage, runPrediction, MAX_PROMPT_LENGTH, VALID_STYLES, VALID_RATIOS } from '../../../lib/generation';
import { getCreatorId, setCreatorCookie, isUuid } from '../../../lib/identity';

import { isAdmin } from '../../../lib/admin';
import { MODEL_TIERS, DEFAULT_TIER } from '../../../lib/models';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';


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
  const { prompt, style, aspectRatio, remixOf, tier } = body || {};
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
  const selectedRatio = aspectRatio === undefined ? '1:1' : aspectRatio;
  if (!VALID_RATIOS.includes(selectedRatio)) {
    return jsonError('Invalid aspect ratio. / יחס תמונה לא תקין.', 400);
  }

  const selectedTier = tier === undefined ? DEFAULT_TIER : tier;
  if (typeof selectedTier !== 'string' || !Object.prototype.hasOwnProperty.call(MODEL_TIERS, selectedTier)) {
    return jsonError('Invalid model. / מודל לא תקין.', 400);
  }
  const tierDef = MODEL_TIERS[selectedTier];
  const cost = tierDef.cost;

  if (!process.env.REPLICATE_API_TOKEN) {
    console.error('Missing REPLICATE_API_TOKEN');
    return jsonError('Service temporarily unavailable. / השירות אינו זמין כרגע.', 503);
  }

  // Charge before calling Replicate (admin bypasses credits and rate limits)
  const notEnough = () => jsonError(`Not enough credits for ${tierDef.label} (costs ${cost}). / אין מספיק קרדיטים למודל הזה.`, 402, currentCredits());
  if (!admin && state.remaining < cost) return notEnough();
  const ipBlock = admin ? null : chargeIp(ip, cost);
  if (ipBlock === 'daily') return notEnough();
  if (ipBlock === 'minute') {
    return jsonError('Too many requests. Please wait a minute. / יותר מדי בקשות, נא להמתין דקה.', 429, currentCredits());
  }
  if (!admin) state.remaining -= cost;

  const refund = () => { if (admin) return; state.remaining += cost; refundIp(ip, cost); };

  try {
    // תרגום אוטומטי חכם אם הוזן טקסט בעברית
    let englishPrompt = prompt.trim();
    if (/[\u0590-\u05FF]/.test(englishPrompt)) {
      try {
        const cleanText = englishPrompt.replace(/\n+/g, ' ');
        const res = await fetch(
          `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText)}&langpair=he|en`
        );
        const data = await res.json();
        if (data?.responseData?.translatedText) {
          englishPrompt = data.responseData.translatedText;
        }
      } catch (err) {
        console.error("Translation fallback:", err);
      }
    }

    const finalPrompt = `${englishPrompt}, ${selectedStyle} style, masterpiece, highly detailed, 8k resolution, sharp focus`;
    const result = await runPrediction(finalPrompt, selectedRatio, tierDef);

    if (result.error) {
      refund();
      const status = result.error === 'timeout' ? 504 : 502;
      const msg = result.error === 'timeout'
        ? 'Generation timed out. Your credits were refunded. / היצירה לקחה יותר מדי זמן, הקרדיט הוחזר.'
        : 'Image generation failed. Your credits were refunded. / יצירת התמונה נכשלה, הקרדיט הוחזר.';
      const res = jsonError(msg, status, currentCredits());
      if (!admin) setCreditsCookie(res, state);
      return res;
    }

    const stored = await persistImage({
      sourceUrl: result.url, prompt: prompt.trim(), style: selectedStyle, ratio: selectedRatio,
      creatorId: creator.id, remixOf: isUuid(remixOf) ? remixOf : null, tier: selectedTier,
    });

    const res = NextResponse.json({
      success: true,
      imageUrl: stored?.id ? stored.url : result.url,
      id: stored?.id || null,
      stored: Boolean(stored?.id),
      ...(stored?.id ? {} : { persistError: stored?.error || 'unknown error' }),
      tier: selectedTier,
      credits: currentCredits(),
      ...(admin ? { admin: true } : {}),
    });
    if (!admin) setCreditsCookie(res, state);
    setCreatorCookie(res, creator);
    return res;
  } catch (error) {
    console.error('Server Error:', error);
    refund();
    const res = jsonError('Internal server error. Your credits were refunded. / שגיאת שרת, הקרדיט הוחזר.', 500, currentCredits());
    if (!admin) setCreditsCookie(res, state);
    return res;
  }
}
