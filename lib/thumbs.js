// Thumbnail convention (client + server safe): images/i/<name>.<ext>  ->  images/t/<name>.webp (≈400px wide)
export const THUMB_WIDTH = 400;
export const CACHE_SECONDS = '31536000'; // object names are random and never reused -> safe to cache for a year
const RE = /\/images\/i\/([A-Za-z0-9_-]+)\.(webp|png|jpg|jpeg)(\?.*)?$/;
export function thumbPath(storagePath) {
  const m = /^i\/([A-Za-z0-9_-]+)\.[a-z0-9]+$/.exec(storagePath || ''); // also .mp4: a video's poster frame lives here
  return m ? `t/${m[1]}.webp` : null;
}
export function thumbUrl(url) {
  if (typeof url !== 'string') return url;
  return RE.test(url) ? url.replace(RE, '/images/t/$1.webp') : url;
}
export function ratioWH(ratio, w = THUMB_WIDTH) {
  const [a, b] = String(ratio || '1:1').split(':').map(Number);
  return a > 0 && b > 0 ? { width: w, height: Math.round((w * b) / a) } : { width: w, height: w };
}

// A video's poster (one still frame) lives where an image's thumbnail would: images/i/<name>.mp4 -> images/t/<name>.webp.
// It is saved the first time the owner plays the video, so lists never have to load video files.
const VIDEO_RE = /\/images\/i\/([A-Za-z0-9_-]+)\.mp4(\?.*)?$/i;
export function posterUrl(url) {
  return typeof url === 'string' && VIDEO_RE.test(url) ? url.replace(VIDEO_RE, '/images/t/$1.webp') : null;
}
