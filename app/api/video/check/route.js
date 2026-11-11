import { NextResponse } from 'next/server';
import { getSupabase } from '../../../../lib/supabase';
import { getCreatorId, isUuid } from '../../../../lib/identity';
import { getClientIp, paidFor } from '../../../../lib/credits';
import { rateLimit } from '../../../../lib/ratelimit';
import { bump } from '../../../../lib/usage';
import { grantPaid } from '../../../../lib/paid';
import { verifyStored, removeSavedVideo } from '../../../../lib/videoJobs';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// POST { id } — a player could not load one of the visitor's own videos. The SERVER reads the stored file:
//   file is fine       -> { ok: true }                      (the problem is on the device, nothing changes)
//   could not check    -> { ok: true, unsure: true }        (nothing changes)
//   file is unusable   -> the video is removed, the credits it cost are returned once -> { ok: false, refunded, paid }
// The browser's word is never enough for a refund; only what the server reads from storage counts.
export async function POST(request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: 'Service temporarily unavailable.' }, { status: 503 });
  const creator = getCreatorId(request);
  const body = await request.json().catch(() => ({}));
  if (creator.isNew || !isUuid(body?.id)) return NextResponse.json({ error: 'Video not found.' }, { status: 404 });
  if (!await rateLimit(`vcheck:${creator.id}:${getClientIp(request)}`, 30, 60 * 60_000)) return NextResponse.json({ error: 'Too many checks. Try again later.' }, { status: 429 });

  const { data: row } = await sb.from('images').select('id, public_url, storage_path, creator_id').eq('id', body.id).maybeSingle();
  if (!row || row.creator_id !== creator.id || !/\.mp4$/i.test(row.storage_path || '')) return NextResponse.json({ error: 'Video not found.' }, { status: 404 });

  const check = await verifyStored(row.public_url);
  if (check.ok) return NextResponse.json({ ok: true });
  if (check.unsure) return NextResponse.json({ ok: true, unsure: true });

  let refunded = 0;
  const { data: job } = await sb.from('video_jobs').select('prediction_id, uid, cost, refunded').eq('image_id', row.id).maybeSingle();
  if (job && job.uid === creator.id) {
    if (job.cost > 0 && !job.refunded && await bump(`animref:${job.prediction_id}`, 1, 1) !== null) {
      await grantPaid(creator.id, job.cost).then(() => { refunded = job.cost; }, (e) => console.error('video check refund', e));
    }
    await sb.from('video_jobs').update({ status: 'failed', error: `saved file unusable: ${check.why}`.slice(0, 300), refunded: job.refunded || refunded > 0, finished_at: new Date().toISOString() }).eq('prediction_id', job.prediction_id);
  }
  console.error('video check: removing unusable video', row.id, check.why);
  await removeSavedVideo(sb, row.id, row.storage_path);
  return NextResponse.json({ ok: false, removed: true, refunded, paid: await paidFor(creator) });
}
