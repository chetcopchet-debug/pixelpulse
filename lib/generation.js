// Shared generation helpers (server-only).
import { getSupabase, BUCKET, isMissingModelColumn } from './supabase';
import { randomName } from './identity';
import { thumbPath, CACHE_SECONDS, THUMB_WIDTH } from './thumbs';

export const MAX_PROMPT_LENGTH = 1500;
export const VALID_STYLES = ["None", "Cinematic", "Photorealistic", "3D Render", "Anime", "Cyberpunk", "Fantasy", "Oil Painting", "Watercolor"];
export const VALID_RATIOS = ["1:1", "16:9", "9:16"];

export async function translateIfHebrew(text) {
  let out = text;
  if (/[\u0590-\u05FF]/.test(out)) {
    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(out.replace(/\n+/g, ' '))}&langpair=he|en`, { cache: 'no-store' });
      const data = await res.json();
      if (data?.responseData?.translatedText) out = data.responseData.translatedText;
    } catch (err) { console.error('Translation fallback:', err); }
  }
  return out;
}

export function buildFinalPrompt(englishPrompt, style) {
  return !style || style === 'None' ? englishPrompt : `${englishPrompt}, ${style} style`;
}

// Download the Replicate output and store it permanently in Supabase.
// Returns { id, url } or null on any failure (caller falls back to the temporary URL).
export async function persistImage({ sourceUrl, prompt, style, ratio, creatorId, remixOf, tier, extra }) {
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
    const bytes = Buffer.from(await imgRes.arrayBuffer());
    return await persistBytes({ bytes, contentType, prompt, style, ratio, creatorId, remixOf, tier, extra });
  } catch (err) {
    console.error('Persist image failed:', stage, err);
    const msg = String(err?.message || err || 'unknown error').replace(/https?:\/\/\S+/g, '[url]').slice(0, 160);
    return { error: `${stage}: ${msg}` };
  }
}

// Store raw image bytes in Supabase and insert a (private) row. Returns { id, url } or { error }.
export async function persistBytes({ bytes, contentType, prompt, style, ratio, creatorId, remixOf, tier, fixedName, extra }) {
  const supabase = getSupabase();
  if (!supabase) return { error: 'Cloud storage is not configured on the server' };
  let stage = 'prepare';
  try {
    const ext = contentType.includes('png') ? 'png' : contentType.includes('jpeg') ? 'jpg' : 'webp';
    // Only link remixes to images that exist and are public or owned by this creator
    if (remixOf) {
      const { data: parent } = await supabase.from('images').select('id, is_public, creator_id').eq('id', remixOf).maybeSingle();
      if (!parent || (!parent.is_public && parent.creator_id !== creatorId)) remixOf = null;
    }
    // Random, non-identifying object names (never the creator id)
    const path = `i/${fixedName || randomName()}.${ext}`;
    stage = 'upload';
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: false, cacheControl: CACHE_SECONDS });
    if (upErr) throw upErr;
    await makeThumb(supabase, path, bytes);
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    stage = 'database';
    const rowData = {
      prompt, style, aspect_ratio: ratio, storage_path: path, public_url: pub.publicUrl,
      creator_id: creatorId, remix_of: remixOf || null,
    };
    let { data: row, error: insErr } = await supabase.from('images').insert({ ...rowData, model: tier, ...(extra || {}) })
      .select('id, public_url').single();
    if (insErr && extra && Object.keys(extra).length && /format|daily_|column|schema cache|PGRST204/i.test(insErr.message || '')) {
      // Migration 004 not applied yet: store without format/daily columns
      ({ data: row, error: insErr } = await supabase.from('images').insert({ ...rowData, model: tier }).select('id, public_url').single());
    }
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

export async function runPrediction(finalPrompt, ratio, tierDef) {
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


// ~400px webp thumbnail next to the original (best effort; the UI falls back to the full image).
export async function makeThumb(supabase, path, bytes) {
  const tp = thumbPath(path);
  if (!tp) return false;
  try {
    const { default: sharp } = await import('sharp');
    const out = await sharp(bytes, { failOn: 'none' }).rotate().resize({ width: THUMB_WIDTH, withoutEnlargement: true }).webp({ quality: 72, effort: 4 }).toBuffer();
    const { error } = await supabase.storage.from(BUCKET).upload(tp, out, { contentType: 'image/webp', upsert: true, cacheControl: CACHE_SECONDS });
    if (error) { console.error('thumb upload:', error.message); return false; }
    return true;
  } catch (e) { console.error('thumb failed:', e?.message || e); return false; }
}
