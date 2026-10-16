// Video pricing (client-safe, shared by UI and server). Replicate prices verified on each model page, 2026-10-16:
//   google/veo-3.1-fast        $0.15/s with audio (720p and 1080p same price); 4/6/8 s; 16:9, 9:16
//   kwaivgi/kling-v2.5-turbo-pro $0.07/s; 5/10 s; 16:9, 9:16, 1:1; no resolution option (1080p output)
//   xai/grok-imagine-video     $0.05/s (480p and 720p same price); 1-15 s; 16:9, 9:16, 1:1 ...
//   minimax/hailuo-02          per video: 512p 6s $0.10, 512p 10s $0.15, 768p 6s $0.27, 768p 10s $0.45, 1080p 6s $0.48 (10s only <=768p); no aspect option
//   bytedance/seedance-1-lite  per second: 480p $0.018, 720p $0.036, 1080p $0.072; 4-12 s
//   wan-video/wan-2.2-t2v-fast per video (81 frames @16fps ~5s): 480p $0.05, 720p $0.10; 16:9, 9:16
// Credits = ceil(usd / 0.0057) (1 credit ~ $0.0057 base cost -> >=50% margin, same formula as #53/#54), then rounded
// up to a multiple of 5 below 20 or at/above 40 credits, which reproduces every #54 price (110/65/45/50/32/10).
export const CREDIT_USD = 0.0057;
export const VIDEO_PRICING = {
  veo: { durations: [4, 6, 8], resolutions: ['720p', '1080p'], ratios: ['16:9', '9:16'], def: { d: 4, r: '720p' }, usd: (d) => 0.15 * d },
  kling: { durations: [5, 10], resolutions: ['1080p'], ratios: ['16:9', '9:16', '1:1'], def: { d: 5, r: '1080p' }, usd: (d) => 0.07 * d },
  'grok-video': { durations: [5, 10, 15], resolutions: ['480p', '720p'], ratios: ['16:9', '9:16', '1:1'], def: { d: 5, r: '720p' }, usd: (d) => 0.05 * d },
  hailuo: { durations: [6, 10], resolutions: ['512p', '768p', '1080p'], ratios: ['16:9'], def: { d: 6, r: '768p' },
    usd: (d, r) => ({ '512p:6': 0.10, '512p:10': 0.15, '768p:6': 0.27, '768p:10': 0.45, '1080p:6': 0.48 })[`${r}:${d}`] ?? null },
  seedance: { durations: [5, 10], resolutions: ['480p', '720p', '1080p'], ratios: ['16:9', '9:16', '1:1'], def: { d: 5, r: '720p' },
    usd: (d, r) => ({ '480p': 0.018, '720p': 0.036, '1080p': 0.072 })[r] * d },
  wan: { durations: [5], resolutions: ['480p', '720p'], ratios: ['16:9', '9:16'], def: { d: 5, r: '480p' }, usd: (d, r) => ({ '480p': 0.05, '720p': 0.10 })[r] },
};
export function creditsForUsd(usd) {
  const c = Math.ceil(usd / CREDIT_USD - 1e-9);
  return c < 20 || c >= 40 ? Math.ceil(c / 5) * 5 : c;
}
// Returns { usd, cost, d, r, ratio } or null if the combination isn't allowed. Server uses this as the source of truth.
export function videoQuote(model, d, r, ratio) {
  const p = VIDEO_PRICING[model]; if (!p) return null;
  d = Number(d); if (!p.durations.includes(d) || !p.resolutions.includes(r)) return null;
  const usd = p.usd(d, r); if (!Number.isFinite(usd) || usd <= 0) return null;
  return { usd: Math.round(usd * 1000) / 1000, cost: creditsForUsd(usd), d, r, ratio: p.ratios.includes(ratio) ? ratio : p.ratios[0] };
}
export const videoOptionOk = (model, d, r) => !!videoQuote(model, d, r);
