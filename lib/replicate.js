// Generic server-side Replicate runner (Prefer: wait + short polling).
// Pass `model` ("owner/name", official models endpoint) or `version` (64-hex id, community models).
export async function runReplicate({ model, version, input, budgetMs = 50_000 }) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return { error: 'config' };
  const url = version ? 'https://api.replicate.com/v1/predictions' : `https://api.replicate.com/v1/models/${model}/predictions`;
  const started = Date.now();
  let res;
  try {
    res = await fetch(url, {
      method: 'POST', cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'wait=30' },
      body: JSON.stringify(version ? { version, input } : { input }),
    });
  } catch (e) { console.error('Replicate network error:', e); return { error: 'upstream' }; }
  let p = await res.json().catch(() => ({}));
  if (!res.ok) { console.error('Replicate error:', res.status, p); return { error: 'upstream' }; }
  while (!['succeeded', 'failed', 'canceled'].includes(p.status) && p.urls?.get && Date.now() - started < budgetMs) {
    await new Promise((r) => setTimeout(r, 1200));
    const s = await fetch(p.urls.get, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }).catch(() => null);
    if (s && s.ok) p = await s.json();
  }
  if (p.status === 'succeeded') return { output: p.output };
  if (p.status === 'failed' || p.status === 'canceled') { console.error('Prediction failed:', p.error); return { error: 'failed' }; }
  return { error: 'timeout' };
}

export const TOOLS = {
  // Official model, ~$0.002/image (T4). 2x upscale.
  sharpen: { model: 'nightmareai/real-esrgan', input: (image) => ({ image, scale: 2, face_enhance: false }) },
  // Community model, pinned version, ~$0.00047/run (T4).
  cutout: { version: 'a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc',
    input: (image) => ({ image, format: 'png', background_type: 'rgba' }) },
  // Official model, $0.05/image. White mask = repaint.
  repaint: { model: 'black-forest-labs/flux-fill-pro',
    input: (image, mask, prompt) => ({ image, mask, prompt, steps: 50, guidance: 60, output_format: 'png', safety_tolerance: 2, prompt_upsampling: false }) },
  // Official model, billed per token (fractions of a cent per call).
  amplify: { model: 'meta/meta-llama-3-8b-instruct' },
};

export const firstUrl = (out) => (Array.isArray(out) ? out[0] : typeof out === 'string' ? out : out?.url || null);
