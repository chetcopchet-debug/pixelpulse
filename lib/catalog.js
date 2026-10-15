// Model picker catalog (client-safe). Sorted best-first inside each section. Every id routes to ONE distinct model
// (see MODEL_TIERS / VIDEO_TIERS in lib/models.js). Costs must match the server.
export const IMAGE_MODELS = [
  { id: 'imagen-ultra', label: 'Imagen 4 Ultra', by: 'Google', icon: '✺', cost: 11, badge: 'Best', desc: 'Top photorealism and fine detail' },
  { id: 'grok', label: 'Grok Imagine', by: 'xAI', icon: '✕', cost: 4, badge: 'New', desc: 'Bold, creative looks from xAI' },
  { id: 'flux-ultra', label: 'FLUX Ultra', by: 'Black Forest Labs', icon: '◆', cost: 11, badge: 'Pro', desc: '4MP images with a raw photo feel' },
  { id: 'seedream', label: 'Seedream 4', by: 'ByteDance', icon: '❖', cost: 6, badge: 'Value', desc: 'Sharp 2K results at a low price' },
  { id: 'imagen', label: 'Imagen 4', by: 'Google', icon: '✹', cost: 8, badge: 'Photo', desc: 'Clean, natural photos and scenes' },
  { id: 'quality', label: 'Quality', by: 'FLUX 1.1 Pro', icon: '💎', cost: 8, badge: 'Detail', desc: 'Rich detail, great all-rounder' },
  { id: 'recraft', label: 'Recraft V3', by: 'Recraft', icon: '✎', cost: 8, badge: 'Design', desc: 'Illustration, posters and brand art' },
  { id: 'text-pro', label: 'Text Pro', by: 'Ideogram V3 Balanced', icon: '🔠', cost: 11, badge: 'Text', desc: 'Most accurate lettering and layouts' },
  { id: 'text', label: 'Text', by: 'Ideogram V3 Turbo', icon: '🔤', cost: 6, badge: 'Text', desc: 'Fast, readable text in images' },
  { id: 'fast', label: 'Fast', by: 'FLUX Schnell', icon: '⚡', cost: 1, badge: 'Fast', desc: 'Quick drafts in seconds' },
];
export const VIDEO_MODELS = [
  { id: 'veo', label: 'Veo 3.1 Fast', by: 'Google', icon: '✺', cost: 110, badge: 'Best', desc: 'Cinematic 4s clip with native sound', secs: 4 },
  { id: 'kling', label: 'Kling 2.5 Turbo Pro', by: 'Kuaishou', icon: '◈', cost: 65, badge: 'Motion', desc: 'Smooth, realistic motion · 5s', secs: 5 },
  { id: 'grok-video', label: 'Grok Imagine Video', by: 'xAI', icon: '✕', cost: 45, badge: 'New', desc: 'xAI video with sound · 5s 720p', secs: 5 },
  { id: 'hailuo', label: 'Hailuo 02', by: 'MiniMax', icon: '◍', cost: 50, badge: 'Physics', desc: 'Strong physics and action · 6s', secs: 6 },
  { id: 'seedance', label: 'Seedance 1 Lite', by: 'ByteDance', icon: '❖', cost: 32, badge: 'Value', desc: 'Good 720p video at a fair price · 5s', secs: 5 },
  { id: 'wan', label: 'Wan 2.2 Fast', by: 'Wan', icon: '≋', cost: 10, badge: 'Cheapest', desc: 'Quick 5s drafts at 480p', secs: 5 },
];
export const isVideoModel = (id) => VIDEO_MODELS.some((m) => m.id === id);
