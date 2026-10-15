import { runImageTool } from '../../../lib/imagetool';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export async function POST(request) {
  return runImageTool(request, { tool: 'sharpen', cost: 1, usd: 0.002, label: 'Sharpen', limit: { n: 20, ms: 60 * 60_000 } });
}
