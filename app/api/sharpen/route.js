import { runImageTool } from '../../../lib/imagetool';
import { withErrorLog } from '../../../lib/monitor';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
async function POSTHandler(request) {
  return runImageTool(request, { tool: 'sharpen', cost: 1, usd: 0.002, label: 'Sharpen', limit: { n: 20, ms: 60 * 60_000 } });
}

export const POST = withErrorLog('/api/sharpen', POSTHandler);
