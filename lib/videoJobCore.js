// Pure helpers for video jobs (no imports, unit tested in test/videoJobs.test.mjs).
export const PREDICTION_ID_RE = /^[a-z0-9]{8,64}$/;
export const outputUrl = (p) => (Array.isArray(p?.output) ? p.output[0] : typeof p?.output === 'string' ? p.output : null) || null;
// 'processing' | 'ready' | 'failed' | 'unknown' (Replicate unreachable)
export function jobOutcome(p) {
  if (!p || typeof p.status !== 'string') return 'unknown';
  if (p.status === 'failed' || p.status === 'canceled') return 'failed';
  if (p.status !== 'succeeded') return 'processing';
  return outputUrl(p) ? 'ready' : 'failed'; // succeeded without an output counts as a failure (refund)
}
export const jobKind = (job) => (job.e ? `effect:${job.e}` : job.t ? `video:${job.t}` : 'animate');
// Rebuild the job fields from a stored row (used when no browser token is around).
export function jobFromRow(row) {
  const kind = String(row.kind || 'animate');
  return {
    p: row.prediction_id, u: row.uid, s: row.source_id || null, c: Number(row.cost) || 0,
    ...(kind.startsWith('effect:') ? { e: kind.slice(7) } : {}), ...(kind.startsWith('video:') ? { t: kind.slice(6) } : {}),
    ...(row.prompt ? { pr: row.prompt } : {}), ...(row.aspect_ratio ? { r: row.aspect_ratio } : {}),
  };
}
// The webhook URL carries a signed token (no prediction id yet); Replicate's call adds the id.
export const webhookFields = (origin, token) => ({
  webhook: `${origin}/api/webhooks/replicate?job=${encodeURIComponent(token)}`,
  webhook_events_filter: ['completed'],
});
