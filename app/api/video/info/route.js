import { NextResponse } from 'next/server';
import { getSupabase } from '../../../../lib/supabase';
import { isUuid } from '../../../../lib/identity';
import { getClientIp } from '../../../../lib/credits';
import { rateLimit } from '../../../../lib/ratelimit';
import { probeStored, makeWebReady } from '../../../../lib/videoJobs';
import { converterVersion } from '../../../../lib/transcode';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// GET ?id=<video id> -> the technical format of a stored video (codec, profile, size, where the index sits)
// and whether this deployment can convert videos. For support and debugging: it answers "why doesn't this
// play on my phone" without downloading anything. It returns no content, no address and no owner, and the id
// is a random value only the owner (and anyone they shared the video with) knows.
//
// GET ?id=<video id>&convert=1 -> also brings that video to the format every phone plays, now. This is the same
// conversion that happens by itself when the owner opens the site or when their player fails; here it can be
// asked for directly (support, or fixing videos saved before conversion existed). It never deletes a video,
// charges or refunds; converting an already converted video does nothing.
export async function GET(request) {
  if (!await rateLimit(`vinfo:${getClientIp(request)}`, 20, 60_000)) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  const converter = await converterVersion();
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ converter: converter || 'not available' });
  const sb = getSupabase();
  if (!sb || !isUuid(id)) return NextResponse.json({ error: 'Video not found.' }, { status: 404 });
  const { data: row } = await sb.from('images').select('id, public_url, storage_path').eq('id', id).maybeSingle();
  if (!row || !/\.mp4$/i.test(row.storage_path || '')) return NextResponse.json({ error: 'Video not found.' }, { status: 404 });
  if (new URL(request.url).searchParams.get('convert') === '1') {
    const res = await makeWebReady(sb, row).catch((e) => ({ changed: false, format: 'unknown', why: String(e?.message || e) }));
    return NextResponse.json({ converted: res.changed, how: res.how || null, was: res.was || null, format: res.format, why: res.why || '', converter: converter || 'not available' });
  }
  const p = await probeStored(row.public_url);
  if (!p) return NextResponse.json({ error: 'The file could not be read.' }, { status: 502 });
  return NextResponse.json({ format: p.summary, codec: p.codec, profile: p.profile ?? null, level: p.level ?? null, width: p.width ?? null, height: p.height ?? null,
    sound: p.audio || null, indexFirst: Boolean(p.indexFirst), playsEverywhere: p.web, why: p.why || '', converter: converter || 'not available' });
}
