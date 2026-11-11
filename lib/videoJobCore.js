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

// ---- what is inside an MP4 (enough to say whether phones and browsers can play it) ----
const fourcc = (b, i) => String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);
const u32 = (b, i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const find = (b, tag, from = 0) => { const t = [tag.charCodeAt(0), tag.charCodeAt(1), tag.charCodeAt(2), tag.charCodeAt(3)]; for (let i = from; i + 4 <= b.length; i++) if (b[i] === t[0] && b[i + 1] === t[1] && b[i + 2] === t[2] && b[i + 3] === t[3]) return i; return -1; };
const VIDEO_CODECS = { avc1: 'H.264', avc3: 'H.264', hvc1: 'H.265 (HEVC)', hev1: 'H.265 (HEVC)', av01: 'AV1', vp09: 'VP9', mp4v: 'MPEG-4 Part 2' };
const H264_PROFILES = { 66: 'Baseline', 77: 'Main', 88: 'Extended', 100: 'High', 110: 'High 10-bit', 122: 'High 4:2:2', 244: 'High 4:4:4' };
// Returns { codec, name, profile?, level?, width?, height?, indexFirst, web, summary }.
// web: true = plays in every current browser; false = known not to play in some (says why); null = cannot tell.
export function probeMp4(bytes) {
  if (!hasVideoSignature(bytes) || fourcc(bytes, 4) !== 'ftyp') return { codec: null, web: null, summary: 'not an MP4 file' };
  // Order of the top-level parts: the index ("moov") before or after the picture data ("mdat").
  let moov = -1, mdat = -1;
  for (let i = 0; i + 8 <= bytes.length;) {
    let size = u32(bytes, i); const type = fourcc(bytes, i + 4);
    if (type === 'moov' && moov < 0) moov = i; if (type === 'mdat' && mdat < 0) mdat = i;
    if (size === 1) size = u32(bytes, i + 12); // 64-bit size: clips here are far below 4 GB, the low half is enough
    if (size === 0 || size < 8) break;
    i += size;
  }
  const indexFirst = moov >= 0 && (mdat < 0 || moov < mdat);
  let out = { codec: null, indexFirst, web: null, summary: 'no video track found' };
  for (let at = find(bytes, 'stsd'); at >= 0; at = find(bytes, 'stsd', at + 4)) {
    const entry = at + 12; if (entry + 36 > bytes.length) break;
    const codec = fourcc(bytes, entry + 4);
    if (!VIDEO_CODECS[codec]) continue; // an audio track
    const width = (bytes[entry + 32] << 8) | bytes[entry + 33], height = (bytes[entry + 34] << 8) | bytes[entry + 35];
    let profile = null, level = null, web = null, why = '';
    if (codec === 'avc1' || codec === 'avc3') {
      const c = find(bytes, 'avcC', entry); if (c >= 0 && c + 8 <= bytes.length) { profile = bytes[c + 5]; level = bytes[c + 7]; }
      web = profile === null ? null : [66, 77, 88, 100].includes(profile);
      if (web === false) why = 'this H.264 variant is not supported by most phones';
    } else if (codec === 'hvc1' || codec === 'hev1') { web = false; why = 'H.265 does not play in many browsers'; }
    else if (codec === 'mp4v') { web = false; why = 'this old format does not play in browsers'; }
    const name = `${VIDEO_CODECS[codec]}${profile !== null ? ` ${H264_PROFILES[profile] || `profile ${profile}`}` : ''}${level ? ` level ${(level / 10).toFixed(1)}` : ''}`;
    out = { codec, name, profile, level, width, height, indexFirst, web, why, summary: `${name}, ${width}x${height}, index ${indexFirst ? 'at the start' : 'at the end'}` };
    break;
  }
  return out;
}
