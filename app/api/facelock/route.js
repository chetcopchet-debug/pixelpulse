import { runImageTool } from '../../../lib/imagetool';
import { refusalLog } from '../../../lib/refusals';
import { MAX_PROMPT_LENGTH, VALID_RATIOS } from '../../../lib/generation';
import { toEnglish } from '../../../lib/translate';
import { checkPromptText, checkPersonEditText, blockedMessage } from '../../../lib/moderation';
import { PREMIUM } from '../../../lib/models';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
const FL = PREMIUM.facelock;

// Body: { id: <your photo with the face>, prompt, aspectRatio }
async function prepare(body) {
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) return { error: 'Describe the new scene, e.g. "as an astronaut on Mars".' };
  if (prompt.length > MAX_PROMPT_LENGTH) return { error: `Prompt is too long (max ${MAX_PROMPT_LENGTH}).` };
  const personBad = checkPersonEditText(prompt);
  if (personBad) return { error: blockedMessage(personBad) };
  const tr = await toEnglish(prompt); const english = tr.prompt;
  const bad = checkPromptText(english) || checkPersonEditText(english);
  if (bad) return { error: blockedMessage(bad) };
  const ratio = VALID_RATIOS.includes(body?.aspectRatio) ? body.aspectRatio : '1:1';
  const full = `Use the person in the reference photo. Keep their exact face, facial features, skin tone, age and identity unchanged and clearly recognizable. New image: ${english}`;
  const args = [full, ratio];
  if (tr.untranslated) args.notice = 'untranslated'; // said on the screen
  args.promptLabel = prompt; args.ratio = ratio;
  return { args };
}

async function handlePost(request) {
  return runImageTool(request, { tool: 'facelock', def: FL, cost: FL.cost, usd: FL.usd, label: FL.label, paidOnly: true, ownOnly: true,
    limit: { n: 20, ms: 60 * 60_000 }, prepare, storeTier: 'facelock', outputPolicy: 'closed' /* real-person photo: fail closed */ });
}

// Every refusal is written to the log with its reason (lib/refusals.js).
export const POST = refusalLog('facelock', handlePost);
