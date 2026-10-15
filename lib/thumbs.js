// Thumbnail convention (client + server safe): images/i/<name>.<ext>  ->  images/t/<name>.webp (≈400px wide)
export const THUMB_WIDTH = 400;
export const CACHE_SECONDS = '31536000'; // object names are random and never reused -> safe to cache for a year
const RE = /\/images\/i\/([A-Za-z0-9_-]+)\.(webp|png|jpg|jpeg)(\?.*)?$/;
export function thumbPath(storagePath) {
  const m = /^i\/([A-Za-z0-9_-]+)\.[a-z]+$/.exec(storagePath || '');
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
