import { NextResponse } from 'next/server';
import { getSupabase } from '../../../../lib/supabase';
import { getCreatorId, isUuid } from '../../../../lib/identity';
import { getClientIp, paidFor } from '../../../../lib/credits';
import { rateLimit } from '../../../../lib/ratelimit';
import { bump } from '../../../../lib/usage';
import { grantPaid } from '../../../../lib/paid';
import { verifyStored, makeWebReady, removeSavedVideo } from '../../../../lib/videoJobs';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const clean = (v, n) => String(v ?? '').replace(/[^\x20-\x7e]/g, ' ').slice(0, n);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// POST { id, code?, message? } — a player on the visitor's device could not play one of their own videos.
// A player failing proves nothing about the file (old phone, unsupported format, weak connection), so the
// browser's word never removes or refunds anything. The SERVER reads the stored file itself:
//   the file is a video     -> kept, and converted to the format every phone plays (H.264 4:2:0, index first).
//                              { ok: true, converted: true, item } gives the page the new address to play.
//                              If it could not be converted: { ok: true, playable, format }, with the player's
//                              error and the file's format written on the job so the cause can be found.
//   could not check         -> kept. { ok: true, unsure: true }
//   the file is missing or  -> only then, and only after a second read agrees: the video is removed and the
//   is not a video at all      credits it cost are returned once. { ok: false, removed, refunded, paid }
export async function POST(request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: 'Service temporarily unavailable.' }, { status: 503 });
  const creator = getCreatorId(request);
  const body = await request.json().catch(() => ({}));
  if (creator.isNew || !isUuid(body?.id)) return NextResponse.json({ error: 'Video not found.' }, { status: 404 });
  if (!await rateLimit(`vcheck:${creator.id}:${getClientIp(request)}`, 30, 60 * 60_000)) return NextResponse.json({ error: 'Too many checks. Try again later.' }, { status: 429 });

  const { data: row } = await sb.from('images').select('id, public_url, storage_path, creator_id').eq('id', body.id).maybeSingle();
  if (!row || row.creator_id !== creator.id || !/\.mp4$/i.test(row.storage_path || '')) return NextResponse.json({ error: 'Video not found.' }, { status: 404 });
  const { data: job } = await sb.from('video_jobs').select('prediction_id, uid, cost, refunded').eq('image_id', row.id).maybeSingle();
  const mine = job && job.uid === creator.id ? job : null;
  const player = `player error ${clean(body?.code, 3) || '?'}${body?.message ? ` "${clean(body.message, 140)}"` : ''}`;

  let check = await verifyStored(row.public_url);
  if (!check.ok && !check.unsure) { await pause(1200); const again = await verifyStored(row.public_url); if (again.ok || again.unsure) check = again; }

  if (check.ok) {
    // The file is a real video that this device could not play: bring it to the format every phone plays.
    // `again` (a second failure after a conversion) re-makes the picture from scratch instead of only repacking it.
    const res = await makeWebReady(sb, row, { always: body?.again === true }).catch((e) => ({ changed: false, format: 'unknown', why: String(e?.message || e) }));
    console.error('video check: a player failed on a good file', row.id, player, res.changed ? `converted (${res.how}): ${res.was} -> ${res.format}` : `not converted: ${res.format}; ${res.why || ''}`);
    if (res.changed) return NextResponse.json({ ok: true, converted: true, item: res.item, format: res.format });
    if (mine) await sb.from('video_jobs').update({ error: `${player}; file: ${res.format}; not converted: ${res.why || ''}`.slice(0, 300) }).eq('prediction_id', mine.prediction_id);
    return NextResponse.json({ ok: true, playable: res.playable ?? null, format: res.format, why: res.why || '' });
  }
  if (check.unsure) return NextResponse.json({ ok: true, unsure: true });

  let refunded = 0;
  if (mine) {
    if (mine.cost > 0 && !mine.refunded && await bump(`animref:${mine.prediction_id}`, 1, 1) !== null) {
      await grantPaid(creator.id, mine.cost).then(() => { refunded = mine.cost; }, (e) => console.error('video check refund', e));
    }
    await sb.from('video_jobs').update({ status: 'failed', error: `saved file unusable: ${check.why}`.slice(0, 300), refunded: mine.refunded || refunded > 0, finished_at: new Date().toISOString() }).eq('prediction_id', mine.prediction_id);
  }
  console.error('video check: removing unusable video', row.id, check.why);
  await removeSavedVideo(sb, row.id, row.storage_path);
  return NextResponse.json({ ok: false, removed: true, refunded, paid: await paidFor(creator) });
}
