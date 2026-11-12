import { runImageTool } from '../../../lib/imagetool';
import { MAX_PROMPT_LENGTH } from '../../../lib/generation';
import { toEnglishPrompt } from '../../../lib/translate';
import { checkPromptText, blockedMessage as blocked } from '../../../lib/moderation';
import { runReplicate, firstUrl, TOOLS } from '../../../lib/replicate';
import { prepareArea, finishArea } from '../../../lib/areaEdit';
import { tempFile, fetchBytes } from '../../../lib/tempFile';

// Edit an area: only the part of the image that was marked is made again.
// prepare() runs before runImageTool charges or records spend, so a block here costs nothing.

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const MAX_MASK = 4 * 1024 * 1024; // data URL chars

async function prepare(body) {
  const mask = body?.mask;
  if (typeof mask !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(mask) || mask.length > MAX_MASK) {
    return { error: 'The marked area did not arrive. Paint over the part you want to change and try again.' };
  }
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) return { error: 'Describe what should be in the marked part.' };
  if (prompt.length > MAX_PROMPT_LENGTH) return { error: `Prompt is too long (max ${MAX_PROMPT_LENGTH}).` };
  const badOriginal = checkPromptText(prompt);
  if (badOriginal) return { error: blocked(badOriginal) };
  const english = await toEnglishPrompt(prompt); // the model reads English: any other language is translated first
  const badEnglish = checkPromptText(english);
  if (badEnglish) return { error: blocked(badEnglish) };
  const args = [mask, english];
  args.promptLabel = prompt; // the Library shows what was asked for, in the person's own words
  return { args };
}

// The marked part is cut out with room around it, enlarged so the model works on it at full detail, repainted,
// shrunk back and laid over the original. Everything outside the marking stays exactly as it was.
async function run({ row, extra }) {
  const [mask, prompt] = extra;
  const original = await fetchBytes(row.public_url);
  if (!original) return { error: 'upstream' };
  let prep;
  try { prep = await prepareArea(original, Buffer.from(mask.slice(mask.indexOf(',') + 1), 'base64')); }
  catch (e) { console.error('Area edit prepare:', e); prep = { error: 'image' }; }
  if (prep.error === 'empty') return { message: 'Nothing was marked. Paint over the part you want to change.', status: 400 };
  if (prep.error) return { message: "This image can't be opened for editing.", status: 400 };
  const image = await tempFile(prep.image, 'image/jpeg'), area = await tempFile(prep.mask, 'image/png');
  try {
    if (!image || !area) return { error: 'upstream' };
    const r = await runReplicate({ model: TOOLS.repaint.model, input: TOOLS.repaint.input(image.url, area.url, prompt), budgetMs: 40_000 });
    const out = r.output ? firstUrl(r.output) : null;
    if (!out) return r;
    console.log(`Area edit: image ${prep.W}x${prep.H}, cut ${prep.plan.crop.w}x${prep.plan.crop.h}, sent ${prep.plan.model.w}x${prep.plan.model.h}${prep.plan.full ? ' (whole image)' : ''}`);
    return { checkUrl: out, finish: async () => { const bytes = await fetchBytes(out); return bytes ? finishArea(prep, bytes) : null; } };
  } finally { await Promise.all([image?.remove(), area?.remove()]); }
}

export async function POST(request) {
  return runImageTool(request, { tool: 'repaint', cost: 8, usd: 0.05, label: 'Edit an area', storeTier: 'repaint', outputPolicy: 'closed' /* repaints any of your images incl. uploaded photos of people: fail closed */, limit: { n: 15, ms: 60 * 60_000 }, prepare, run });
}
