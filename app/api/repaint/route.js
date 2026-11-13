import { runImageTool } from '../../../lib/imagetool';
import { MAX_PROMPT_LENGTH } from '../../../lib/generation';
import { toEnglishPrompt } from '../../../lib/translate';
import { checkPromptText, blockedMessage as blocked } from '../../../lib/moderation';
import { runReplicate, firstUrl, TOOLS } from '../../../lib/replicate';
import { prepareArea, finishArea, swapMask } from '../../../lib/areaEdit';
import { tempFile, fetchBytes } from '../../../lib/tempFile';

// Edit an area: only the part of the image that was marked is made again.
// prepare() runs before runImageTool charges or records spend, so a block here costs nothing.

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const MAX_MASK = 4 * 1024 * 1024; // data URL chars

async function prepare(body) {
  const startedAt = Date.now();
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
  const args = [mask, body?.translate === false ? prompt : english]; // translation switched off: the check above still read it in English
  args.promptLabel = prompt; // the Library shows what was asked for, in the person's own words
  args.startedAt = startedAt;
  return { args };
}

// The marked part is cut out with room around it, enlarged so the model works on it at full detail, repainted,
// shrunk back and laid over the original. Everything outside the marking stays exactly as it was.
// Ideogram 4.5 does the repainting; if it fails and there is time left in the request, FLUX Fill Pro is tried.
const COST = 13;   // Ideogram 4.5 at its list price of $0.06 plus the 15% margin for a price not read on Replicate
const USD = 0.069;
const TIME = 54_000; // a request has 60 seconds in all

async function run({ row, extra }) {
  const [mask, prompt] = extra;
  const left = () => TIME - (Date.now() - extra.startedAt);
  const original = await fetchBytes(row.public_url);
  if (!original) return { error: 'upstream' };
  let prep;
  try { prep = await prepareArea(original, Buffer.from(mask.slice(mask.indexOf(',') + 1), 'base64')); }
  catch (e) { console.error('Area edit prepare:', e); prep = { error: 'image' }; }
  if (prep.error === 'empty') return { message: 'Nothing was marked. Paint over the part you want to change.', status: 400 };
  if (prep.error) return { message: "This image can't be opened for editing.", status: 400 };
  const size = `image ${prep.W}x${prep.H}, cut ${prep.plan.crop.w}x${prep.plan.crop.h}, sent ${prep.plan.model.w}x${prep.plan.model.h}${prep.plan.full ? ' (whole image)' : ''}`;
  const files = [];
  const put = async (bytes, type) => { const f = await tempFile(bytes, type); if (f) files.push(f); return f; };
  try {
    const image = await put(prep.image, 'image/jpeg');
    if (!image) return { error: 'upstream' };
    let r = { error: 'upstream' }, out = null;
    for (const def of [TOOLS.repaint, TOOLS.repaintBackup]) {
      if (def !== TOOLS.repaint && (r.error === 'throttled' || left() < 30_000)) break; // no time for a second model
      const area = await put(def.blackChanges ? await swapMask(prep.mask) : prep.mask, 'image/png');
      if (!area) break;
      r = await runReplicate({ model: def.model, input: def.input(image.url, area.url, prompt), budgetMs: Math.max(10_000, Math.min(36_000, left() - 6_000)) });
      out = r.output ? firstUrl(r.output) : null;
      console.log(`Area edit with ${def.model}: ${out ? 'done' : `failed (${r.error})`}; ${size}`);
      if (out) break;
    }
    if (!out) return r;
    return { checkUrl: out, finish: async () => { const bytes = await fetchBytes(out); return bytes ? finishArea(prep, bytes) : null; } };
  } finally { await Promise.all(files.map((f) => f.remove())); }
}

export async function POST(request) {
  return runImageTool(request, { tool: 'repaint', cost: COST, usd: USD, label: 'Edit an area', storeTier: 'repaint', outputPolicy: 'closed' /* repaints any of your images incl. uploaded photos of people: fail closed */, limit: { n: 15, ms: 60 * 60_000 }, prepare, run });
}
