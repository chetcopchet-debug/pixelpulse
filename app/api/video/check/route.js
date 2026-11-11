import { NextResponse } from 'next/server';
import { getSupabase } from '../../../../lib/supabase';
import { getCreatorId, isUuid } from '../../../../lib/identity';
import { getClientIp, paidFor } from '../../../../lib/credits';
import { rateLimit } from '../../../../lib/ratelimit';
import { bump } from '../../../../lib/usage';
import { grantPaid } from '../../../../lib/paid';
import { verifyStored, probeStored, removeSavedVideo } from '../../../../lib/videoJobs';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const clean = (v, n) => String(v ?? '').replace(/[^\x20-\x7e]/g, ' ').slice(0, n);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// POST { id, code?, message? } — a player on the visitor's device could not play one of their own videos.
// A player failing proves nothing about the file (old phone, unsupported format, weak connection), so the
// browser's word never removes or refunds anything. The SERVER reads the stored file itself:
//   the file is a video     -> kept. { ok: true, playable, format } tells the page what to say; the player's
//                              error and the file's format are written on the job so the cause can be found.
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
    const probe = await probeStored(row.public_url);
    const format = probe?.summary || 'format not read';
    if (mine) await sb.from('video_jobs').update({ error: `${player}; file is fine: ${format}`.slice(0, 300) }).eq('prediction_id', mine.prediction_id);
    console.error('video check: file is fine but a player failed', row.id, player, format);
    return NextResponse.json({ ok: true, playable: probe ? probe.web : null, format, why: probe?.why || '' });
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
