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
// `bypass` is Vercel's "Protection Bypass for Automation" secret: when a deployment is behind Vercel's login wall
// (preview deployments usually are), outside services can only reach it with this value in the address.
export const webhookFields = (origin, token, bypass) => ({
  webhook: `${origin}/api/webhooks/replicate?job=${encodeURIComponent(token)}${bypass ? `&x-vercel-protection-bypass=${encodeURIComponent(bypass)}` : ''}`,
  webhook_events_filter: ['completed'],
});

// ---- is this really a video file? ----
// MP4/MOV files carry "ftyp" at bytes 4..8; WebM/Matroska files start with the EBML marker.
export const MIN_VIDEO_BYTES = 8 * 1024; // anything smaller is an error page or an empty file, not a clip
export function hasVideoSignature(bytes) {
  if (!bytes || bytes.length < 12) return false;
  const ftyp = bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
  const ebml = bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  return ftyp || ebml;
}
export const looksLikeVideo = (bytes) => Boolean(bytes) && bytes.length >= MIN_VIDEO_BYTES && hasVideoSignature(bytes);
// Short description of what was received instead, for the job's error note (never the content itself).
export function describeBytes(bytes, contentType) {
  const n = bytes ? bytes.length : 0;
  const head = bytes ? Array.from(bytes.subarray(0, 12)).map((b) => b.toString(16).padStart(2, '0')).join('') : '';
  return `type ${contentType || 'unknown'}, ${n} bytes, starts ${head || 'empty'}`;
}
// After how many failed attempts to save a finished video we stop and give the credits back.
export const MAX_SAVE_TRIES = 4;
