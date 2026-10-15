import { NextResponse } from 'next/server';
import {
  readCreditsCookie, setCreditsCookie, getClientIp, ipRemaining,
  chargeIp, refundIp, COOKIE_NAME,
} from '../../../lib/credits';
import { getSupabase, BUCKET, isMissingModelColumn } from '../../../lib/supabase';
import { getCreatorId, setCreatorCookie, isUuid } from '../../../lib/identity';

import { isAdmin } from '../../../lib/admin';
import { MODEL_TIERS, DEFAULT_TIER } from '../../../lib/models';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const MAX_PROMPT_LENGTH = 500;
const VALID_STYLES = ["Cinematic", "Photorealistic", "3D Render", "Anime", "Cyberpunk", "Fantasy", "Oil Painting", "Watercolor"];
const VALID_RATIOS = ["1:1", "16:9", "9:16"];

// Download the Replicate output and store it permanently in Supabase.
// Returns { id, url } or null on any failure (caller falls back to the temporary URL).
async function persistImage({ sourceUrl, prompt, style, ratio, creatorId, remixOf, tier }) {
  const supabase = getSupabase();
  if (!supabase) return { error: 'Cloud storage is not configured on the server' };
  let stage = 'download';
  try {
    let imgRes = null;
    for (let i = 0; i < 3; i++) {
      try { imgRes = await fetch(sourceUrl, { cache: 'no-store' }); } catch (e) { imgRes = null; }
      if (imgRes && imgRes.ok) break;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
    if (!imgRes || !imgRes.ok) throw new Error(`image download failed (${imgRes ? imgRes.status : 'network'})`);
    const contentType = imgRes.headers.get('content-type') || 'image/webp';
    const ext = contentType.includes('png') ? 'png' : contentType.includes('jpeg') ? 'jpg' : 'webp';
    // Only link remixes to images that exist and are public or owned by this creator
    if (remixOf) {
      const { data: parent } = await supabase.from('images').select('id, is_public, creator_id').eq('id', remixOf).maybeSingle();
      if (!parent || (!parent.is_public && parent.creator_id !== creatorId)) remixOf = null;
    }
    const bytes = Buffer.from(await imgRes.arrayBuffer());
    const path = `${creatorId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    stage = 'upload';
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: false });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    stage = 'database';
    const rowData = {
      prompt, style, aspect_ratio: ratio, storage_path: path, public_url: pub.publicUrl,
      creator_id: creatorId, remix_of: remixOf || null,
    };
    let { data: row, error: insErr } = await supabase.from('images').insert({ ...rowData, model: tier })
      .select('id, public_url').single();
    if (insErr && isMissingModelColumn(insErr)) {
      // Migration 002 not applied yet: store without the model column
      ({ data: row, error: insErr } = await supabase.from('images').insert(rowData).select('id, public_url').single());
    }
    if (insErr) {
      await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
      throw insErr;
    }
    return { id: row.id, url: row.public_url };
  } catch (err) {
    console.error('Persist image failed:', stage, err);
    const msg = String(err?.message || err || 'unknown error').replace(/https?:\/\/\S+/g, '[url]').slice(0, 160);
    return { error: `${stage}: ${msg}` };
  }
}

function jsonError(message, status, credits) {
  return NextResponse.json({ error: message, ...(credits !== undefined ? { credits } : {}) }, { status });
}

async function runPrediction(finalPrompt, ratio, tierDef) {
  const token = process.env.REPLICATE_API_TOKEN;
  const response = await fetch(`https://api.replicate.com/v1/models/${tierDef.model}/predictions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Prefer": "wait=30",
    },
    body: JSON.stringify({
      input: tierDef.input(finalPrompt, ratio),
    }),
  });

  let prediction = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Replicate error:', response.status, prediction);
    return { error: 'upstream' };
  }

  // Short fallback polling if Prefer: wait didn't finish in time
  const deadline = Date.now() + 25_000;
  while (!['succeeded', 'failed', 'canceled'].includes(prediction.status) && prediction.urls?.get && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    const statusRes = await fetch(prediction.urls.get, { headers: { "Authorization": `Bearer ${token}` } });
    if (!statusRes.ok) continue;
    prediction = await statusRes.json();
  }

  if (prediction.status === 'succeeded') {
    const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    return url ? { url } : { error: 'failed' };
  }
  if (prediction.status === 'failed' || prediction.status === 'canceled') {
    console.error('Prediction failed:', prediction.error);
    return { error: 'failed' };
  }
  return { error: 'timeout' };
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
