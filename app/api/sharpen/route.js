import { runImageTool } from '../../../lib/imagetool';
import { refusalLog } from '../../../lib/refusals';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
async function handlePost(request) {
  return runImageTool(request, { tool: 'sharpen', cost: 1, usd: 0.002, label: 'Sharpen', limit: { n: 20, ms: 60 * 60_000 } });
}

// Every refusal is written to the log with its reason (lib/refusals.js).
export const POST = refusalLog('sharpen', handlePost);
