import { runImageTool } from '../../../lib/imagetool';
import { refusalLog } from '../../../lib/refusals';
import { consumeCutoutPass } from '../../../lib/cutoutPass';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
// 1 credit, like HD. Free only with a one-time server-signed pass issued when a Sticker/Emoji was generated.
async function handlePost(request) {
  return runImageTool(request, {
    tool: 'cutout', cost: 1, usd: 0.0005, label: 'Cutout', limit: { n: 20, ms: 60 * 60_000 },
    freePass: (body, row, creator) => consumeCutoutPass(body?.pass, row.id, creator.id),
  });
}

// Every refusal is written to the log with its reason (lib/refusals.js).
export const POST = refusalLog('cutout', handlePost);
