import { NextResponse } from 'next/server';
import { getSupabase, BUCKET } from '../../../../lib/supabase';
import { getCreatorId, setCreatorCookie, creatorTag, randomName } from '../../../../lib/identity';
import { getClientIp } from '../../../../lib/credits';
import { isAdmin } from '../../../../lib/admin';
import { rateLimit } from '../../../../lib/ratelimit';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// Returns a one-time signed URL so the phone can send the ORIGINAL photo (up to 8MB) straight to storage,
// bypassing Vercel's 4.5MB request limit. /api/upload {tmpPath} then converts it with sharp.
export async function POST(request) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Cloud storage is not available.' }, { status: 503 });
  const creator = getCreatorId(request);
  const ip = getClientIp(request);
  if (!isAdmin(request) && !await rateLimit(`upsign:${ip}`, 30, 60 * 60_000)) return NextResponse.json({ error: 'Upload limit reached.' }, { status: 429 });
  const body = await request.json().catch(() => ({}));
  const size = Number(body?.size) || 0;
  if (size > 8 * 1024 * 1024) return NextResponse.json({ error: 'Photo is too large (max 8MB).' }, { status: 413 });
  const path = `tmp/${creatorTag(creator.id, 'tmp')}/${randomName()}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data?.signedUrl) { console.error('Sign error:', error); return NextResponse.json({ error: 'Could not prepare the upload.' }, { status: 500 }); }
  const res = NextResponse.json({ signedUrl: data.signedUrl, tmpPath: path });
  setCreatorCookie(res, creator);
  return res;
}
