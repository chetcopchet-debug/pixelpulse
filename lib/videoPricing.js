// Video pricing (client-safe, shared by UI and server).
// `usd` is what Replicate charges for one run. Where each price was read:
//   bytedance/seedance-2.5       $0.1028/s at 480p, $0.2312/s at 720p (price trackers quoting replicate.com, Oct-Nov 2026); 4-30 s
//   kwaivgi/kling-v4.0           $0.157/s at 720p, $0.235/s at 1080p (Pricing section of the model page); 3-30 s
//   kwaivgi/kling-v4-flash       $0.094/s, 720p only, with sound (Pricing section of the model page); 3-20 s
//   google/veo-3.1-fast          $0.15/s with audio, 720p and 1080p the same (model page, 2026-10-16); 4/6/8 s
//   google/gemini-omni-1.2-flash $0.035/s at 360p, $0.105/s at 720p, $0.155/s at 1080p (Pricing section of the model page, 14 Nov 2026); 3-15 s
//   xai/grok-imagine-video       $0.05/s at 480p, $0.07/s at 720p (xAI's price list and listings of Replicate prices, Nov 2026); 1-15 s
//   minimax/h3-lite              $0.025/s at 480P, $0.04/s at 768P (Replicate blog, 2026-11-03); 4-15 s
//   wan-video/wan-2.2-t2v-fast   per video (81 frames @16fps, about 5 s): 480p $0.05, 720p $0.10 (model page, 2026-10-16)
// A price marked `approx` was not confirmed on Replicate. It is charged with APPROX_BUFFER on top until it is,
// and /admin lists it as not verified.
// Credits = ceil(usd / 0.0057) (1 credit ~ $0.0057 base cost -> >=50% margin), then rounded up to a multiple of 5
// below 20 or at/above 40 credits.
export const CREDIT_USD = 0.0057;
export const APPROX_BUFFER = 1.15;
const R3 = ['16:9', '9:16', '1:1'];
const R2 = ['16:9', '9:16'];
export const VIDEO_PRICING = {
  'seedance-25': { durations: [5, 10], resolutions: ['480p', '720p'], ratios: R3, def: { d: 5, r: '720p' }, src: 'price trackers quoting Replicate',
    usd: (d, r) => ({ '480p': 0.1028, '720p': 0.2312 })[r] * d },
  'kling-4': { durations: [5, 10], resolutions: ['720p', '1080p'], ratios: R3, def: { d: 5, r: '720p' }, src: 'Replicate model page',
    usd: (d, r) => ({ '720p': 0.157, '1080p': 0.235 })[r] * d },
  veo: { durations: [4, 6, 8], resolutions: ['720p', '1080p'], ratios: R2, def: { d: 4, r: '720p' }, src: 'Replicate model page', usd: (d) => 0.15 * d },
  'kling-4-flash': { durations: [5, 10], resolutions: ['720p'], ratios: R3, def: { d: 5, r: '720p' }, src: 'Replicate model page', usd: (d) => 0.094 * d },
  // 360p is offered as "Draft": a quick, low-quality try before paying for full quality.
  omni: { durations: [5, 10, 15], resolutions: ['360p', '720p', '1080p'], ratios: R2, def: { d: 5, r: '720p' }, src: 'Replicate model page',
    usd: (d, r) => ({ '360p': 0.035, '720p': 0.105, '1080p': 0.155 })[r] * d },
  'grok-video': { durations: [5, 10, 15], resolutions: ['480p', '720p'], ratios: R3, def: { d: 5, r: '720p' }, src: 'listing of Replicate prices, Nov 2026',
    usd: (d, r) => ({ '480p': 0.05, '720p': 0.07 })[r] * d },
  'h3-lite': { durations: [5, 10], resolutions: ['480p', '768p'], ratios: R3, def: { d: 5, r: '768p' }, src: 'Replicate blog',
    usd: (d, r) => ({ '480p': 0.025, '768p': 0.04 })[r] * d },
  wan: { durations: [5], resolutions: ['480p', '720p'], ratios: R2, def: { d: 5, r: '480p' }, src: 'Replicate model page', usd: (d, r) => ({ '480p': 0.05, '720p': 0.10 })[r] },
};
// Models that can start a video from a picture (the first frame). Wan is not here: its text model cannot, and a
// picture is animated with Wan's own image model at a fixed price ("Animate").
// The price of such a run was not read on Replicate for any of them. It is taken to be the text-to-video price
// and, like every unverified price, charged with APPROX_BUFFER on top; /admin lists it as not verified.
export const VIDEO_FROM_IMAGE = ['seedance-25', 'kling-4', 'veo', 'kling-4-flash', 'omni', 'grok-video', 'h3-lite'];
export const videoTakesImage = (model) => VIDEO_FROM_IMAGE.includes(model);
// Video models that make sound with the picture (from each model's description). A prompt written for one of
// these also says what is heard.
export const VIDEO_WITH_SOUND = ['seedance-25', 'veo', 'kling-4-flash', 'omni', 'grok-video'];
export function creditsForUsd(usd) {
  const c = Math.ceil(usd / CREDIT_USD - 1e-9);
  return c < 20 || c >= 40 ? Math.ceil(c / 5) * 5 : c;
}
// Returns { usd, cost, d, r, ratio } or null if the combination isn't allowed. Server uses this as the source of truth.
// `usd` already includes the buffer for a price that isn't verified. `image`: the run starts from a picture.
export function videoQuote(model, d, r, ratio, image = false) {
  const p = Object.prototype.hasOwnProperty.call(VIDEO_PRICING, model) ? VIDEO_PRICING[model] : null; if (!p) return null;
  d = Number(d); if (!p.durations.includes(d) || !p.resolutions.includes(r)) return null;
  const list = p.usd(d, r); if (!Number.isFinite(list) || list <= 0) return null;
  if (image && !videoTakesImage(model)) return null;
  const usd = Math.round(list * (p.approx || image ? APPROX_BUFFER : 1) * 1000) / 1000;
  return { usd, cost: creditsForUsd(usd), d, r, ratio: p.ratios.includes(ratio) ? ratio : p.ratios[0] };
}
export const videoOptionOk = (model, d, r) => !!videoQuote(model, d, r);
// The cheapest run a model offers (for "from" prices).
export function videoFrom(model) {
  const p = VIDEO_PRICING[model]; if (!p) return null;
  let best = null;
  for (const d of p.durations) for (const r of p.resolutions) { const q = videoQuote(model, d, r); if (q && (!best || q.cost < best.cost)) best = q; }
  return best;
}
