import { NextResponse } from 'next/server';
import { getSupabase, BUCKET } from '../../../lib/supabase';
import { getCreatorId, setCreatorCookie, isUuid, creatorTag } from '../../../lib/identity';
import { getClientIp } from '../../../lib/credits';
import { isAdmin } from '../../../lib/admin';
import { rateLimit } from '../../../lib/ratelimit';
import { persistBytes } from '../../../lib/generation';
import { isBanned, BANNED_MSG } from '../../../lib/trustSafety';
import { normalizeImage, ImageProcError, ratioFor } from '../../../lib/imageproc';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const MAX_RAW = 8 * 1024 * 1024;
const TMP_RE = /^tmp\/[0-9a-f]{24}\/[0-9a-f]{32}$/;
const err = (error, status) => NextResponse.json({ error }, { status });

// Accepts:
//  - JSON { data: "data:image/...;base64,..." }  (client-downscaled; preferred)
//  - JSON { tmpPath }  (original bytes already PUT to a signed URL from /api/upload/sign)
//  - raw image body (Content-Type image/* or application/octet-stream), up to Vercel's ~4.5MB body limit
export async function POST(request) {
  const supabase = getSupabase();
  if (!supabase) return err('Cloud storage is not available.', 503);
  const creator = getCreatorId(request);
  const ip = getClientIp(request);
  if (!isAdmin(request) && (!await rateLimit(`up:${creator.isNew ? ip : creator.id}`, 20, 60 * 60_000) || !await rateLimit(`up:ip:${ip}`, 40, 60 * 60_000))) {
    return err('Upload limit reached (20/hour). Try again later.', 429);
  }
  if (!isAdmin(request) && await isBanned(creator.id)) return err(BANNED_MSG, 403);

  // Idempotency: the client sends one upload id per picked photo; a retry/double-send returns the same row.
  const uploadId = request.headers.get('x-upload-id');
  const fixedName = !creator.isNew && isUuid(uploadId) ? `u${creatorTag(creator.id, uploadId.toLowerCase())}` : null;
  if (fixedName) {
    const { data: existing } = await supabase.from('images').select('id, public_url, aspect_ratio')
      .eq('creator_id', creator.id).like('storage_path', `i/${fixedName}.%`).limit(1).maybeSingle();
    if (existing) return NextResponse.json({ success: true, duplicate: true, item: { id: existing.id, public_url: existing.public_url,
      prompt: 'Uploaded image', style: null, aspect_ratio: existing.aspect_ratio, model: 'upload', is_public: false, likes: 0, remix_of: null } });
  }
  let buf = null;
  let tmpPath = null;
  const ct = (request.headers.get('content-type') || '').toLowerCase();
  try {
    if (ct.includes('application/json')) {
      const body = await request.json().catch(() => null);
      if (typeof body?.tmpPath === 'string') {
        if (creator.isNew || !TMP_RE.test(body.tmpPath) || !body.tmpPath.startsWith(`tmp/${creatorTag(creator.id, 'tmp')}/`)) return err('Invalid upload reference.', 400);
        tmpPath = body.tmpPath;
        const { data, error } = await supabase.storage.from(BUCKET).download(tmpPath);
        if (error || !data) return err('The uploaded file was not found. Please try again.', 400);
        buf = Buffer.from(await data.arrayBuffer());
      } else {
        const m = typeof body?.data === 'string' && body.data.match(/^data:[a-z/+.-]*;base64,([A-Za-z0-9+/=]+)$/i);
        if (!m) return err('No image received. Please pick a photo again.', 400);
        buf = Buffer.from(m[1], 'base64');
      }
    } else {
      buf = Buffer.from(await request.arrayBuffer());
    }
    if (!buf || buf.length < 100) return err('That file is empty. If it is in the cloud (e.g. Google Photos), download it to the phone first.', 400);
    if (buf.length > MAX_RAW) return err('Photo is too large (max 8MB). Try a smaller photo or a screenshot.', 413);

    const out = await normalizeImage(buf);
    const ratio = ratioFor(out.width, out.height);
    const stored = await persistBytes({ bytes: out.bytes, contentType: out.contentType, prompt: 'Uploaded image', style: null, ratio,
      creatorId: creator.id, remixOf: null, tier: 'upload', fixedName });
    if (!stored?.id) return err(`Could not save the upload (${stored?.error || 'unknown'}).`, 500);
    const res = NextResponse.json({ success: true, width: out.width, height: out.height, source: out.sourceType,
      item: { id: stored.id, public_url: stored.url, prompt: 'Uploaded image', style: null,
        aspect_ratio: ratio, model: 'upload', is_public: false, likes: 0, remix_of: null } });
    setCreatorCookie(res, creator);
    return res;
  } catch (e) {
    if (e instanceof ImageProcError) return err(e.message, e.status);
    console.error('Upload error:', e);
    return err('Upload failed on the server. Please try again.', 500);
  } finally {
    if (tmpPath) supabase.storage.from(BUCKET).remove([tmpPath]).catch(() => {});
  }
}
