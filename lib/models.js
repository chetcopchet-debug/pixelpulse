// Server-side allowlist: tier -> Replicate model + input mapping. Shared constants are safe for the client.
export const MODEL_TIERS = {
  fast: { label: 'Fast', cost: 1, usd: 0.003, model: 'black-forest-labs/flux-schnell',
    input: (prompt, ratio) => ({ prompt, aspect_ratio: ratio, output_format: 'webp', output_quality: 90 }) },
  quality: { label: 'Quality', cost: 8, usd: 0.04, model: 'black-forest-labs/flux-1.1-pro',
    input: (prompt, ratio) => ({ prompt, aspect_ratio: ratio, output_format: 'webp', output_quality: 90, safety_tolerance: 2, prompt_upsampling: false }) },
  text: { label: 'Text', cost: 6, usd: 0.03, model: 'ideogram-ai/ideogram-v3-turbo',
    input: (prompt, ratio) => ({ prompt, aspect_ratio: ratio, magic_prompt_option: 'Off' }) },
  // ---- Picker models (credits >= cost / $0.0057 -> >=50% margin on Pulse Pro net per credit) ----
  'imagen-ultra': { label: 'Imagen 4 Ultra', cost: 11, usd: 0.06, model: 'google/imagen-4-ultra',
    input: (prompt, ratio) => ({ prompt, aspect_ratio: ratio, safety_filter_level: 'block_only_high', output_format: 'jpg' }) },
  grok: { label: 'Grok Imagine', cost: 4, usd: 0.02, model: 'xai/grok-imagine-image',
    input: (prompt, ratio) => ({ prompt, aspect_ratio: ratio }) },
  'flux-ultra': { label: 'FLUX Ultra', cost: 11, usd: 0.06, model: 'black-forest-labs/flux-1.1-pro-ultra',
    input: (prompt, ratio) => ({ prompt, aspect_ratio: ratio, output_format: 'jpg', safety_tolerance: 2, raw: false }) },
  seedream: { label: 'Seedream 4', cost: 6, usd: 0.03, model: 'bytedance/seedream-4',
    input: (prompt, ratio) => ({ prompt, aspect_ratio: ratio, size: '2K', max_images: 1, enhance_prompt: false }) },
  imagen: { label: 'Imagen 4', cost: 8, usd: 0.04, model: 'google/imagen-4',
    input: (prompt, ratio) => ({ prompt, aspect_ratio: ratio, safety_filter_level: 'block_only_high', output_format: 'jpg' }) },
  recraft: { label: 'Recraft V3', cost: 8, usd: 0.04, model: 'recraft-ai/recraft-v3',
    input: (prompt, ratio) => ({ prompt, aspect_ratio: ratio }) },
  'text-pro': { label: 'Text Pro', cost: 11, usd: 0.06, model: 'ideogram-ai/ideogram-v3-balanced',
    input: (prompt, ratio) => ({ prompt, aspect_ratio: ratio, magic_prompt_option: 'Off' }) },
};
export const DEFAULT_TIER = 'fast';
export const TEXT_TIERS = ['text', 'text-pro'];

// Text-to-video picker models: PAID credits only, fixed duration/resolution per run (price is per run).
const vr = (ratio, allowed) => (allowed.includes(ratio) ? ratio : '16:9');
export const VIDEO_TIERS = {
  veo: { label: 'Veo 3.1 Fast', cost: 110, usd: 0.60, model: 'google/veo-3.1-fast', // $0.15/s with audio x 4s
    input: (prompt, ratio) => ({ prompt, aspect_ratio: vr(ratio, ['16:9', '9:16']), duration: 4, resolution: '720p', generate_audio: true }) },
  kling: { label: 'Kling 2.5 Turbo Pro', cost: 65, usd: 0.35, model: 'kwaivgi/kling-v2.5-turbo-pro', // $0.07/s x 5s
    input: (prompt, ratio) => ({ prompt, aspect_ratio: vr(ratio, ['16:9', '9:16', '1:1']), duration: 5 }) },
  'grok-video': { label: 'Grok Imagine Video', cost: 45, usd: 0.25, model: 'xai/grok-imagine-video', // $0.05/s x 5s
    input: (prompt, ratio) => ({ prompt, aspect_ratio: vr(ratio, ['16:9', '9:16', '1:1']), duration: 5, resolution: '720p' }) },
  hailuo: { label: 'Hailuo 02', cost: 50, usd: 0.27, model: 'minimax/hailuo-02', // 768p 6s = $0.27
    input: (prompt) => ({ prompt, duration: 6, resolution: '768p', prompt_optimizer: false }) },
  seedance: { label: 'Seedance 1 Lite', cost: 32, usd: 0.18, model: 'bytedance/seedance-1-lite', // 720p $0.036/s x 5s
    input: (prompt, ratio) => ({ prompt, aspect_ratio: vr(ratio, ['16:9', '9:16', '1:1']), duration: 5, resolution: '720p' }) },
  wan: { label: 'Wan 2.2 Fast', cost: 10, usd: 0.05, model: 'wan-video/wan-2.2-t2v-fast', // 480p = $0.05/video
    input: (prompt, ratio) => ({ prompt, aspect_ratio: vr(ratio, ['16:9', '9:16']), resolution: '480p', num_frames: 81, frames_per_second: 16, interpolate_output: false, go_fast: true }) },
};

// Premium tools: PAID credits only (free daily credits can't be used). Each is a distinct model.
export const PREMIUM = {
  // Image -> 5s video (81 frames @16fps, 480p). Replicate: $0.05 per video.
  animate: { label: 'Animate', cost: 15, usd: 0.05, paidOnly: true, model: 'wan-video/wan-2.2-i2v-fast',
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
