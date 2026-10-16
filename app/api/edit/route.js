import { runImageTool } from '../../../lib/imagetool';
import { MAX_PROMPT_LENGTH } from '../../../lib/generation';
import { toEnglishPrompt } from '../../../lib/translate';
import { checkPromptText } from '../../../lib/moderation';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
const EDIT_COST = 8; // flux-kontext-pro is $0.04/image

async function prepare(body) {
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) return { error: 'Describe the change, e.g. "make it night".' };
  if (prompt.length > MAX_PROMPT_LENGTH) return { error: `Prompt is too long (max ${MAX_PROMPT_LENGTH}).` };
  const english = await toEnglishPrompt(prompt);
  const bad = checkPromptText(english);
  if (bad) return { error: bad };
  const args = [english];
  args.promptLabel = prompt;
  return { args };
}

export async function POST(request) {
  return runImageTool(request, { tool: 'edit', cost: EDIT_COST, usd: 0.04, label: 'Edit', limit: { n: 20, ms: 60 * 60_000 }, prepare, storeTier: 'edit' });
}
