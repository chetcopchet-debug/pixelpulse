import { runImageTool } from '../../../lib/imagetool';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export async function POST(request) {
  return runImageTool(request, { tool: 'cutout', cost: 0, usd: 0.0005, label: 'Cutout', limit: { n: 10, ms: 60 * 60_000 } });
}
