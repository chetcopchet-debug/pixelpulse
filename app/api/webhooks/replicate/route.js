import { NextResponse } from 'next/server';
import { readJob } from '../../../../lib/animateJob';
import { finalizeJob, PREDICTION_ID_RE } from '../../../../lib/videoJobs';
import { bump } from '../../../../lib/usage';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// Replicate calls this when a video prediction completes (succeeded, failed or canceled).
// Trust model: the URL carries OUR signed job token (creator, charge, source); the body only tells us which
// prediction finished. finalizeJob() then asks Replicate for that prediction itself, so a forged body can
// neither invent a result nor trigger a refund for a run that did not fail.
export async function POST(request) {
  // Counted so the admin page can show whether Replicate's calls reach this deployment at all.
  await bump('hook:replicate', 1, 1e9).catch(() => {});
  const job = readJob(new URL(request.url).searchParams.get('job'));
  if (!job || !job.u) return NextResponse.json({ error: 'unknown job' }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!PREDICTION_ID_RE.test(id) || (job.p && job.p !== id)) return NextResponse.json({ error: 'bad prediction id' }, { status: 400 });
  const out = await finalizeJob({ ...job, p: id });
  // Not finished on our side yet (e.g. storage hiccup): answer 503 so Replicate retries the webhook.
  return NextResponse.json({ ok: out.status !== 'processing', status: out.status }, { status: out.status === 'processing' ? 503 : 200 });
}
