// Server-side allowlist: tier -> Replicate model + input mapping. Shared constants are safe for the client.
export const MODEL_TIERS = {
  fast: { label: 'Fast', cost: 1, usd: 0.003, model: 'black-forest-labs/flux-schnell',
    input: (prompt, ratio) => ({ prompt, aspect_ratio: ratio, output_format: 'webp', output_quality: 90 }) },
  quality: { label: 'Quality', cost: 4, usd: 0.04, model: 'black-forest-labs/flux-1.1-pro',
    input: (prompt, ratio) => ({ prompt, aspect_ratio: ratio, output_format: 'webp', output_quality: 90, safety_tolerance: 2, prompt_upsampling: false }) },
  text: { label: 'Text', cost: 3, usd: 0.03, model: 'ideogram-ai/ideogram-v3-turbo',
    input: (prompt, ratio) => ({ prompt, aspect_ratio: ratio, magic_prompt_option: 'Off' }) },
};
export const DEFAULT_TIER = 'fast';

// Premium tools: PAID credits only (free daily credits can't be used). Each is a distinct model.
export const PREMIUM = {
  // Image -> 5s video (81 frames @16fps, 480p). Replicate: $0.05 per video.
  animate: { label: 'Animate', cost: 15, usd: 0.05, paidOnly: true, model: 'wan-video/wan-2.2-i2v-fast',
    input: (image, prompt) => ({ image, prompt, num_frames: 81, frames_per_second: 16, resolution: '480p', go_fast: true }) },
  // Reference face + prompt -> new image with the same identity. Replicate: $0.039 per image.
  facelock: { label: 'Face Lock', cost: 6, usd: 0.039, paidOnly: true, model: 'google/nano-banana',
    input: (image, prompt, ratio) => ({ prompt, image_input: [image], aspect_ratio: ratio || '1:1', output_format: 'png' }) },
};

// Image-guided generation (img2img). follow: 0..1 = how closely to follow the guide image.
export const GUIDED = { label: 'Guided', cost: 3, usd: 0.025, model: 'black-forest-labs/flux-dev' };
export function guidedTier(imageUrl, follow) {
  const f = Math.min(1, Math.max(0, Number.isFinite(follow) ? follow : 0.5));
  const strength = Math.round((1 - f * 0.4) * 100) / 100; // follow 0 -> 1.0 (loose), 1 -> 0.6 (close); 0.53 tested too close
  return { ...GUIDED, input: (prompt) => ({ prompt, image: imageUrl, prompt_strength: strength, output_format: 'webp', output_quality: 90, go_fast: true, megapixels: '1', num_inference_steps: 28 }) };
}
