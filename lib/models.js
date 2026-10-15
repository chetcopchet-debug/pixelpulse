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

// Image-guided generation (img2img). follow: 0..1 = how closely to follow the guide image.
export const GUIDED = { label: 'Guided', cost: 3, usd: 0.025, model: 'black-forest-labs/flux-dev' };
export function guidedTier(imageUrl, follow) {
  const f = Math.min(1, Math.max(0, Number.isFinite(follow) ? follow : 0.5));
  const strength = Math.round((1 - f * 0.4) * 100) / 100; // follow 0 -> 1.0 (loose), 1 -> 0.6 (close); 0.53 tested too close
  return { ...GUIDED, input: (prompt) => ({ prompt, image: imageUrl, prompt_strength: strength, output_format: 'webp', output_quality: 90, go_fast: true, megapixels: '1', num_inference_steps: 28 }) };
}
