// The model list (client-safe): names, makers, what each is for, and what one run costs us.
// Sorted best-first inside each section. The server charges from this same table (lib/models.js builds on it).
import { CREDIT_USD, APPROX_BUFFER, VIDEO_PRICING, videoQuote } from './videoPricing.js';

// usd = Replicate's price for one image. approx = that price is the maker's list price and was not confirmed
// on Replicate; it is charged with a buffer on top until someone checks it (see /admin).
const image = (id, label, by, desc, listUsd, src, approx = false) => {
  const usd = Math.round(listUsd * (approx ? APPROX_BUFFER : 1) * 10000) / 10000;
  return { id, label, by, desc, usd, listUsd, approx, src, cost: Math.ceil(usd / CREDIT_USD - 1e-9) };
};
export const IMAGE_MODELS = [
  image('gpt-image', 'GPT Image 2.6 Sunburst', 'OpenAI', 'Follows long, detailed prompts. Sharp text', 0.09, 'price tracker quoting Replicate (medium quality)'),
  image('ideogram', 'Ideogram 4.5', 'Ideogram', 'Posters, logos and layouts with exact lettering', 0.06, "Ideogram's list price (medium quality)", true),
  image('flux-3', 'FLUX 3 Image', 'Black Forest Labs', 'Rich, natural photos with fine texture', 0.048, "Black Forest Labs' list price (1K)", true),
  image('nano-banana', 'Nano Banana 2.1', 'Google', 'Fast all-rounder with clean text', 0.0336, "Google's list price (1K)", true),
  image('seedream-5', 'Seedream 5 Lite', 'ByteDance', 'Crisp 2K images at a fair price', 0.035, 'listing of Replicate prices'),
  image('recraft-41', 'Recraft V4.1', 'Recraft', 'Illustration, brand art and design', 0.035, "Recraft's list price", true),
  image('flux-2-pro', 'FLUX.2 Pro', 'Black Forest Labs', 'Realistic photos, good value', 0.03, "Black Forest Labs' list price (1 megapixel)", true),
  image('grok', 'Grok Imagine', 'xAI', 'Bold, moody, cinematic looks', 0.02, 'Replicate model page'),
  image('fast', 'FLUX Schnell', 'Black Forest Labs', 'Quick drafts in seconds', 0.003, 'Replicate pricing page'),
];

const video = (id, label, by, desc, eta) => {
  const p = VIDEO_PRICING[id]; const q = videoQuote(id, p.def.d, p.def.r, '16:9');
  return { id, label, by, desc, eta, cost: q.cost, usd: q.usd, approx: Boolean(p.approx), src: p.src, secs: p.def.d, res: p.def.r };
};
export const VIDEO_MODELS = [
  video('seedance-25', 'Seedance 2.5', 'ByteDance', 'Leads the rankings. Film-like motion with sound', 180),
  video('kling-4', 'Kling 4.0', 'Kuaishou', 'Realistic people and action, up to 1080p', 180),
  video('veo', 'Veo 3.1 Fast', 'Google', 'Cinematic clips with sound', 120),
  video('kling-4-flash', 'Kling 4 Flash', 'Kuaishou', 'Quicker Kling with sound, 720p', 100),
  video('omni', 'Gemini Omni 1.2 Flash', 'Google', 'Strong quality for the price, with sound', 100),
  video('grok-video', 'Grok Imagine Video', 'xAI', 'Fast social clips with sound', 90),
  video('h3-lite', 'MiniMax H3 Lite', 'MiniMax', 'Good motion at a low price', 100),
  video('wan', 'Wan 2.2 Fast', 'Wan', 'Cheapest drafts at 480p', 60),
];
export const isVideoModel = (id) => VIDEO_MODELS.some((m) => m.id === id);

// Models that were offered before and are gone. Saved items made with them still show the right name.
export const RETIRED = {
  'imagen-ultra': 'Imagen 4 Ultra', quality: 'FLUX 1.1 Pro', 'flux-ultra': 'FLUX 1.1 Pro Ultra', seedream: 'Seedream 4', imagen: 'Imagen 4', recraft: 'Recraft V3',
  text: 'Ideogram V3 Turbo', 'text-pro': 'Ideogram V3 Balanced',
  'video:veo-lite': 'Veo 3.1 Lite', 'video:kling': 'Kling 2.5 Turbo Pro', 'video:hailuo': 'Hailuo 02', 'video:seedance': 'Seedance 1 Lite',
};
