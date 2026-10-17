import { runImageTool } from '../../../lib/imagetool';
import { MAX_PROMPT_LENGTH } from '../../../lib/generation';
import { toEnglishPrompt, TRANSLATE_BUSY_MSG } from '../../../lib/translate';
import { checkPromptText, checkPersonEditText, blockedMessage } from '../../../lib/moderation';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
const EDIT_COST = 8; // flux-kontext-pro is $0.04/image

async function prepare(body) {
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) return { error: 'Describe the change, e.g. "make it night".' };
  if (prompt.length > MAX_PROMPT_LENGTH) return { error: `Prompt is too long (max ${MAX_PROMPT_LENGTH}).` };
  const badOriginal = checkPromptText(prompt);
  if (badOriginal) return { error: blockedMessage(badOriginal) };
  const personBad = checkPersonEditText(prompt);
  if (personBad) return { error: blockedMessage(personBad) };
  const english = await toEnglishPrompt(prompt, { strict: true }); // real-person photo: fail closed
  if (english === null) return { error: TRANSLATE_BUSY_MSG };
  const bad = checkPromptText(english) || checkPersonEditText(english);
  if (bad) return { error: blockedMessage(bad) };
  const args = [english];
  args.promptLabel = prompt;
  return { args };
}

export async function POST(request) {
  return runImageTool(request, { tool: 'edit', cost: EDIT_COST, usd: 0.04, label: 'Edit', limit: { n: 20, ms: 60 * 60_000 }, prepare, storeTier: 'edit', outputPolicy: 'closed' /* real-person photo: fail closed */ });
}
