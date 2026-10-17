import { NextResponse } from 'next/server';
import { getSupabase } from '../../../../lib/supabase';
import { verifyReplicateSignature, advanceJob, fetchPrediction, rowToJob } from '../../../../lib/videoJobs';
import { withErrorLog } from '../../../../lib/monitor';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// Replicate calls this when a video prediction completes, so the video is saved (or the credits refunded) even if the
// user closed the tab. With REPLICATE_WEBHOOK_SECRET set the signature is required; either way the prediction is
// re-read from the Replicate API, so a forged body can only trigger processing of a real job we created.
async function POSTHandler(request) {
  const body = await request.text();
  const secret = process.env.REPLICATE_WEBHOOK_SECRET;
  if (secret) {
    const ok = verifyReplicateSignature({ id: request.headers.get('webhook-id'), timestamp: request.headers.get('webhook-timestamp'),
      signature: request.headers.get('webhook-signature'), body, secret });
    if (!ok) return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
  }
  let evt; try { evt = JSON.parse(body); } catch { return NextResponse.json({ error: 'Bad body.' }, { status: 400 }); }
  const pred = typeof evt?.id === 'string' && /^[a-z0-9]{8,64}$/i.test(evt.id) ? evt.id : null;
  if (!pred) return NextResponse.json({ ok: true, ignored: true });
  const sb = getSupabase(); if (!sb) return NextResponse.json({ error: 'Unavailable.' }, { status: 503 });
  const { data: row, error } = await sb.from('video_jobs').select('*').eq('pred_id', pred).maybeSingle();
  if (error || !row) return NextResponse.json({ ok: true, ignored: true }); // not a video job of ours (or migration 010 missing)
  if (row.status === 'done' || row.status === 'refunded') return NextResponse.json({ ok: true, status: row.status });
  const p = (await fetchPrediction(pred)) || (secret ? evt : null);
  const res = await advanceJob(sb, rowToJob(row), p);
  // 500 on "still processing" after a completed event makes Replicate retry the delivery later.
  return NextResponse.json({ ok: true, status: res.status }, { status: res.status === 'processing' && p && ['succeeded', 'failed', 'canceled'].includes(p.status) ? 500 : 200 });
}

export const POST = withErrorLog('/api/webhooks/replicate', POSTHandler);
