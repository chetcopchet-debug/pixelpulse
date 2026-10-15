import { runImageTool } from '../../../lib/imagetool';
import { MAX_PROMPT_LENGTH } from '../../../lib/generation';
import { toEnglishPrompt } from '../../../lib/translate';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const MAX_MASK = 4 * 1024 * 1024; // data URL chars

async function prepare(body) {
  const mask = body?.mask;
  if (typeof mask !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(mask) || mask.length > MAX_MASK) {
    return { error: 'Invalid mask. Paint the area to repaint.' };
  }
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) return { error: 'Describe what should appear in the painted area.' };
  if (prompt.length > MAX_PROMPT_LENGTH) return { error: `Prompt is too long (max ${MAX_PROMPT_LENGTH}).` };
  const english = await toEnglishPrompt(prompt);
  const args = [mask, english];
  return { args };
}

export async function POST(request) {
  return runImageTool(request, { tool: 'repaint', cost: 5, usd: 0.05, label: 'Repaint', limit: { n: 15, ms: 60 * 60_000 }, prepare });
}
