import { NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/supabase';
import { getCreatorId, setCreatorCookie } from '../../../lib/identity';
import { getClientIp } from '../../../lib/credits';
import { isAdmin } from '../../../lib/admin';
import { rateLimit } from '../../../lib/ratelimit';
import { persistBytes, VALID_RATIOS } from '../../../lib/generation';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const MAX_BYTES = 3 * 1024 * 1024; // after client downscale (Vercel body limit is 4.5MB)

function sniff(b) {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export async function POST(request) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Cloud storage is not available.' }, { status: 503 });
  const creator = getCreatorId(request);
  const ip = getClientIp(request);
  if (!isAdmin(request) && (!rateLimit(`up:${creator.isNew ? ip : creator.id}`, 20, 60 * 60_000) || !rateLimit(`up:ip:${ip}`, 40, 60 * 60_000))) {
    return NextResponse.json({ error: 'Upload limit reached (20/hour). Try again later.' }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  const m = typeof body?.data === 'string' && body.data.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return NextResponse.json({ error: 'Please upload a JPEG, PNG or WebP image.' }, { status: 400 });
  const bytes = Buffer.from(m[2], 'base64');
  if (bytes.length < 100 || bytes.length > MAX_BYTES) return NextResponse.json({ error: 'Image is empty or too large (max 3MB after resize).' }, { status: 413 });
  const type = sniff(bytes);
  if (!type) return NextResponse.json({ error: 'That file is not a valid image.' }, { status: 400 });
  const ratio = VALID_RATIOS.includes(body.ratio) ? body.ratio : '1:1';

  const stored = await persistBytes({ bytes, contentType: type, prompt: 'Uploaded image', style: null, ratio,
    creatorId: creator.id, remixOf: null, tier: 'upload' });
  if (!stored?.id) return NextResponse.json({ error: `Could not save the upload (${stored?.error || 'unknown'}).` }, { status: 500 });
  const res = NextResponse.json({ success: true, item: { id: stored.id, public_url: stored.url, prompt: 'Uploaded image', style: null,
    aspect_ratio: ratio, model: 'upload', is_public: false, likes: 0, remix_of: null } });
  setCreatorCookie(res, creator);
  return res;
}
