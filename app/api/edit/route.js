import { runImageTool } from '../../../lib/imagetool';
import { refusalLog } from '../../../lib/refusals';
import { MAX_PROMPT_LENGTH } from '../../../lib/generation';
import { toEnglish } from '../../../lib/translate';
import { checkPromptText, checkPersonEditText, blockedMessage } from '../../../lib/moderation';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
const EDIT_COST = 8; // flux-kontext-pro is $0.04/image

async function prepare(body) {
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) return { error: 'Describe the change, e.g. "make it night".' };
  if (prompt.length > MAX_PROMPT_LENGTH) return { error: `Prompt is too long (max ${MAX_PROMPT_LENGTH}).` };
  const personBad = checkPersonEditText(prompt);
  if (personBad) return { error: blockedMessage(personBad) };
  const tr = await toEnglish(prompt); const english = tr.prompt;
  const bad = checkPromptText(english) || checkPersonEditText(english);
  if (bad) return { error: blockedMessage(bad) };
  const args = [english];
  if (tr.untranslated) args.notice = 'untranslated'; // said on the screen
  args.promptLabel = prompt;
  return { args };
}

async function handlePost(request) {
  return runImageTool(request, { tool: 'edit', cost: EDIT_COST, usd: 0.04, label: 'Edit', limit: { n: 20, ms: 60 * 60_000 }, prepare, storeTier: 'edit', outputPolicy: 'closed' /* real-person photo: fail closed */ });
}

// Every refusal is written to the log with its reason (lib/refusals.js).
export const POST = refusalLog('edit', handlePost);
