import { runImageTool } from '../../../lib/imagetool';
import { refusalLog } from '../../../lib/refusals';
import { doorOpens } from '../../../lib/testDoor';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
// TEST ADDRESS ONLY. This is in the `preview` branch and is not part of the site (it is never merged to main).
// A caller who holds the test door's secret can ask for Topaz instead of Real-ESRGAN (header x-test-upscaler: topaz):
// it enlarges a photo without repainting it. $0.08 a picture up to 24 megapixels (Replicate model page, 14 Nov 2026).
const TOPAZ = { model: 'topazlabs/image-upscale', input: (image) => ({ image, enhance_model: 'High Fidelity V2', upscale_factor: '2x', output_format: 'png', face_enhancement: false, subject_detection: 'None' }) };
async function handlePost(request) {
  const topaz = request.headers.get('x-test-upscaler') === 'topaz' && doorOpens(process.env, request.headers.get('x-test-login'));
  return runImageTool(request, { tool: 'sharpen', cost: 1, usd: topaz ? 0.08 : 0.002, label: 'Sharpen', limit: { n: 20, ms: 60 * 60_000 }, ...(topaz ? { toolDef: TOPAZ } : {}) });
}

// Every refusal is written to the log with its reason (lib/refusals.js).
export const POST = refusalLog('sharpen', handlePost);
