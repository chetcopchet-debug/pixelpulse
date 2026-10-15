// Server-side allowlist: tier -> Replicate model + input mapping. Shared constants are safe for the client.
export const MODEL_TIERS = {
  fast: { label: 'Fast', cost: 1, model: 'black-forest-labs/flux-schnell',
    input: (prompt, ratio) => ({ prompt, aspect_ratio: ratio, output_format: 'webp', output_quality: 90 }) },
  quality: { label: 'Quality', cost: 2, model: 'black-forest-labs/flux-1.1-pro',
    input: (prompt, ratio) => ({ prompt, aspect_ratio: ratio, output_format: 'webp', output_quality: 90, safety_tolerance: 2, prompt_upsampling: false }) },
  text: { label: 'Text', cost: 2, model: 'ideogram-ai/ideogram-v3-turbo',
    input: (prompt, ratio) => ({ prompt, aspect_ratio: ratio, magic_prompt_option: 'Off' }) },
};
export const DEFAULT_TIER = 'fast';
