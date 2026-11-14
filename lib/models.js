// Server-side allowlist: model id -> Replicate model + the exact input it is called with.
// Names, prices and credits come from lib/catalog.js, so the interface and the server can't disagree.
// Every input below was checked against the input schema Replicate publishes for the model (see lib/modelCheck.js).
import { IMAGE_MODELS, VIDEO_MODELS } from './catalog.js';

// Ideogram 4.5, with no source image, takes only two sizes: "1024x1024", or "source", where it picks the size
// itself. (Its other sizes are listed in the schema but its notes say they need a source image, and a run with
// one of them fails with "The input was invalid".) So a square is asked for by size, and the other shapes by
// "source" plus a plain sentence about the shape.
const IDEOGRAM_SHAPE = { '16:9': 'Wide landscape picture, 16:9 aspect ratio.', '9:16': 'Tall vertical picture, 9:16 aspect ratio.' };
const IMAGE_RUN = {
  // quality is fixed here and nowhere else. Replicate's default is "auto", which costs almost three times "medium";
  // nothing a visitor sends can change it, because this function only takes the prompt and the ratio.
  'gpt-image': { model: 'openai/gpt-image-2.6-sunburst',
    input: (prompt, ratio) => ({ prompt, aspect_ratio: ratio, quality: 'medium', number_of_images: 1, output_format: 'webp', moderation: 'auto' }) },
  ideogram: { model: 'ideogram-ai/ideogram-4-5',
    input: (prompt, ratio) => (IDEOGRAM_SHAPE[ratio]
      ? { prompt: `${prompt}\n\n${IDEOGRAM_SHAPE[ratio]}`, size: 'source', quality: 'medium', num_images: 1 }
      : { prompt, size: '1024x1024', quality: 'medium', num_images: 1 }) },
  'flux-3': { model: 'black-forest-labs/flux-3-image',
    input: (prompt, ratio) => ({ prompt, aspect_ratio: ratio, resolution: '1k', grounding: false, safety_tolerance: 2, output_format: 'webp', output_quality: 90 }) },
  'nano-banana': { model: 'google/nano-banana-2.1',
    input: (prompt, ratio) => ({ prompt, aspect_ratio: ratio, resolution: '1K', google_search: false, image_search: false, output_format: 'jpg' }) },
  'seedream-5': { model: 'bytedance/seedream-5-lite',
    input: (prompt, ratio) => ({ prompt, aspect_ratio: ratio, size: '2K', sequential_image_generation: 'disabled', max_images: 1, output_format: 'jpeg' }) },
  'recraft-41': { model: 'recraft-ai/recraft-v4.1',
    input: (prompt, ratio) => ({ prompt, aspect_ratio: ratio }) },
  'flux-2-pro': { model: 'black-forest-labs/flux-2-pro',
    input: (prompt, ratio) => ({ prompt, aspect_ratio: ratio, resolution: '1 MP', safety_tolerance: 2, output_format: 'webp', output_quality: 90 }) },
  grok: { model: 'xai/grok-imagine-image',
    input: (prompt, ratio) => ({ prompt, aspect_ratio: ratio }) },
  fast: { model: 'black-forest-labs/flux-schnell',
    input: (prompt, ratio) => ({ prompt, aspect_ratio: ratio, output_format: 'webp', output_quality: 90 }) },
};
export const MODEL_TIERS = Object.fromEntries(IMAGE_MODELS.map((m) => [m.id, { label: m.label, cost: m.cost, usd: m.usd, ...IMAGE_RUN[m.id] }]));
export const DEFAULT_TIER = 'fast';
// Models that are trusted with lettering: text inside quotes is kept as written instead of being translated.
export const TEXT_TIERS = ['ideogram', 'gpt-image', 'nano-banana'];

// Text-to-video picker models: PAID credits only. The price of a run comes from videoQuote() in lib/videoPricing.js;
// cost/usd here are the default option's.
const vr = (ratio, allowed) => (allowed.includes(ratio) ? ratio : '16:9');
const R3 = ['16:9', '9:16', '1:1'];
const R2 = ['16:9', '9:16'];
const VIDEO_RUN = {
  'seedance-25': { model: 'bytedance/seedance-2.5',
    input: (prompt, ratio, d = 5, r = '720p') => ({ prompt, aspect_ratio: vr(ratio, R3), duration: d, resolution: r, generate_audio: true, watermark: false }) },
  'kling-4': { model: 'kwaivgi/kling-v4.0',
    input: (prompt, ratio, d = 5, r = '720p') => ({ prompt, aspect_ratio: vr(ratio, R3), duration: d, resolution: r }) },
  veo: { model: 'google/veo-3.1-fast',
    input: (prompt, ratio, d = 4, r = '720p') => ({ prompt, aspect_ratio: vr(ratio, R2), duration: d, resolution: r, generate_audio: true }) },
  'kling-4-flash': { model: 'kwaivgi/kling-v4-flash',
    input: (prompt, ratio, d = 5) => ({ prompt, aspect_ratio: vr(ratio, R3), duration: d }) },
  omni: { model: 'google/gemini-omni-1.2-flash',
    input: (prompt, ratio, d = 5, r = '720p') => ({ prompt, aspect_ratio: vr(ratio, R2), duration: d, resolution: r }) },
  'grok-video': { model: 'xai/grok-imagine-video',
    input: (prompt, ratio, d = 5, r = '720p') => ({ prompt, aspect_ratio: vr(ratio, R3), duration: d, resolution: r }) },
  'h3-lite': { model: 'minimax/h3-lite',
    input: (prompt, ratio, d = 5, r = '768p') => ({ prompt, ratio: vr(ratio, R3), duration: d, resolution: r === '480p' ? '480P' : '768P' }) },
  wan: { model: 'wan-video/wan-2.2-t2v-fast',
    input: (prompt, ratio, d = 5, r = '480p') => ({ prompt, aspect_ratio: vr(ratio, R2), resolution: r, num_frames: 81, frames_per_second: 16, interpolate_output: false, go_fast: true }) },
};
// The input each model reads the first frame from, for a video that starts from a picture. Read from the input
// schema Replicate publishes for each model. The rest of the input is the same as for text-to-video.
const VIDEO_IMAGE_INPUT = { 'seedance-25': 'image', 'kling-4': 'start_image', veo: 'image', 'kling-4-flash': 'start_image', omni: 'image', 'grok-video': 'image', 'h3-lite': 'first_frame_image' };
export const VIDEO_TIERS = Object.fromEntries(VIDEO_MODELS.map((m) => [m.id, { label: m.label, cost: m.cost, usd: m.usd, ...VIDEO_RUN[m.id], imageInput: VIDEO_IMAGE_INPUT[m.id] || null }]));

// Premium tools: PAID credits only (free daily credits can't be used). Each is a distinct model.
export const PREMIUM = {
  // Image -> 5s video (81 frames @16fps, 480p). Replicate: $0.05 per video (model page, 14 Nov 2026).
  animate: { label: 'Animate', cost: 10, usd: 0.05, paidOnly: true, model: 'wan-video/wan-2.2-i2v-fast',
    input: (image, prompt) => ({ image, prompt, num_frames: 81, frames_per_second: 16, resolution: '480p', go_fast: true }) },
  // Reference face + prompt -> new image with the same identity. Replicate: $0.039 per image.
  facelock: { label: 'Face Lock', cost: 7, usd: 0.039, paidOnly: true, model: 'google/nano-banana',
    input: (image, prompt, ratio) => ({ prompt, image_input: [image], aspect_ratio: ratio || '1:1', output_format: 'png' }) },
};

// Image-guided generation (img2img). follow: 0..1 = how closely to follow the guide image.
export const GUIDED = { label: 'Guided', cost: 5, usd: 0.025, model: 'black-forest-labs/flux-dev' };
export function guidedTier(imageUrl, follow) {
  const f = Math.min(1, Math.max(0, Number.isFinite(follow) ? follow : 0.5));
  const strength = Math.round((1 - f * 0.4) * 100) / 100; // follow 0 -> 1.0 (loose), 1 -> 0.6 (close); 0.53 tested too close
  return { ...GUIDED, input: (prompt) => ({ prompt, image: imageUrl, prompt_strength: strength, output_format: 'webp', output_quality: 90, go_fast: true, megapixels: '1', num_inference_steps: 28 }) };
}
