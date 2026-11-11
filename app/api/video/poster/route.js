import { NextResponse } from 'next/server';
import { getSupabase } from '../../../../lib/supabase';
import { getCreatorId, isUuid } from '../../../../lib/identity';
import { getClientIp } from '../../../../lib/credits';
import { rateLimit } from '../../../../lib/ratelimit';
import { makeThumb } from '../../../../lib/generation';
import { sniffType } from '../../../../lib/imageproc';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const MAX_BYTES = 600 * 1024;

// POST { id, data } — data is one still frame of the visitor's OWN video (a JPEG/PNG/WebP data URL taken by the
// player while it plays). It is re-encoded to a small WebP and stored where an image's thumbnail would be, so
// lists can show a picture instead of loading the whole video file.
// The frame comes from the owner's browser, so it is only as trustworthy as the owner; it is shown in the
// owner's own library. Before videos are shown to other people, posters must be made on the server instead.
export async function POST(request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: 'Service temporarily unavailable.' }, { status: 503 });
  const creator = getCreatorId(request);
  const body = await request.json().catch(() => ({}));
  if (creator.isNew || !isUuid(body?.id)) return NextResponse.json({ error: 'Video not found.' }, { status: 404 });
  if (!await rateLimit(`vposter:${creator.id}:${getClientIp(request)}`, 60, 60 * 60_000)) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  const m = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(typeof body?.data === 'string' ? body.data : '');
  if (!m || m[1].length > MAX_BYTES * 1.4) return NextResponse.json({ error: 'Invalid picture.' }, { status: 400 });
  const bytes = Buffer.from(m[1], 'base64');
  if (bytes.length < 500 || bytes.length > MAX_BYTES || !['image/jpeg', 'image/png', 'image/webp'].includes(sniffType(bytes))) return NextResponse.json({ error: 'Invalid picture.' }, { status: 400 });

  const { data: row } = await sb.from('images').select('id, storage_path, creator_id').eq('id', body.id).maybeSingle();
  if (!row || row.creator_id !== creator.id || !/\.mp4$/i.test(row.storage_path || '')) return NextResponse.json({ error: 'Video not found.' }, { status: 404 });

  const ok = await makeThumb(sb, row.storage_path, bytes);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Could not save the picture.' }, { status: 500 });
}
