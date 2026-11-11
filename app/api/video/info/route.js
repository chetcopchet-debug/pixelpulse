import { NextResponse } from 'next/server';
import { getSupabase } from '../../../../lib/supabase';
import { isUuid } from '../../../../lib/identity';
import { getClientIp } from '../../../../lib/credits';
import { rateLimit } from '../../../../lib/ratelimit';
import { probeStored } from '../../../../lib/videoJobs';
import { converterVersion } from '../../../../lib/transcode';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// GET ?id=<video id> -> the technical format of a stored video (codec, profile, size, where the index sits)
// and whether this deployment can convert videos. For support and debugging: it answers "why doesn't this
// play on my phone" without downloading anything. It returns no content, no address and no owner, and the id
// is a random value only the owner (and anyone they shared the video with) knows.
export async function GET(request) {
  if (!await rateLimit(`vinfo:${getClientIp(request)}`, 20, 60_000)) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  const converter = await converterVersion();
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ converter: converter || 'not available' });
  const sb = getSupabase();
  if (!sb || !isUuid(id)) return NextResponse.json({ error: 'Video not found.' }, { status: 404 });
  const { data: row } = await sb.from('images').select('public_url, storage_path').eq('id', id).maybeSingle();
  if (!row || !/\.mp4$/i.test(row.storage_path || '')) return NextResponse.json({ error: 'Video not found.' }, { status: 404 });
  const p = await probeStored(row.public_url);
  if (!p) return NextResponse.json({ error: 'The file could not be read.' }, { status: 502 });
  return NextResponse.json({ format: p.summary, codec: p.codec, profile: p.profile ?? null, level: p.level ?? null, width: p.width ?? null, height: p.height ?? null,
    sound: p.audio || null, indexFirst: Boolean(p.indexFirst), playsEverywhere: p.web, why: p.why || '', converter: converter || 'not available' });
}
