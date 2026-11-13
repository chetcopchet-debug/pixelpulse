// Transparent prompt translation: any language -> precise, descriptive English for the image and video models.
// Whether a prompt needs it is decided instantly, without a model (lib/promptLanguage.js).
// In Text mode, quoted on-image text is kept verbatim (original language and characters). Always fails open.
import { TOOLS } from './replicate';
import { reserveSpend, bump } from './usage';
import { translateIfHebrew } from './generation';
import { NON_LATIN, QUOTED, needsTranslation, quotedParts, shortIdea } from './promptLanguage.js';

export { needsTranslation, shortIdea };

const TIMEOUT_MS = 7000;

// One request to one language model. Returns { out } on success, { limited: seconds } when Replicate says to slow
// down, or {} on any other failure. `budgetMs` is all the time it may take: Replicate holds the request for a
// few seconds, and when the answer is not ready by then (a busy model, or an account being slowed down) the run
// is asked about again until it is, instead of being given up on.
async function ask(model, system, text, token, budgetMs = TIMEOUT_MS) {
  const end = Date.now() + budgetMs;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const timed = async (url, init) => {
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), Math.max(500, end - Date.now()));
    try { return await fetch(url, { ...init, cache: 'no-store', signal: ctl.signal }); } finally { clearTimeout(timer); }
  };
  try {
    const res = await timed(`https://api.replicate.com/v1/models/${model}/predictions`, {
      method: 'POST', headers: { ...headers, Prefer: `wait=${Math.max(1, Math.min(5, Math.floor(budgetMs / 1000) - 1))}` },
      // Google's models call the instructions "system_instruction"; the others call them "system_prompt".
      body: JSON.stringify({ input: { [model.startsWith('google/') ? 'system_instruction' : 'system_prompt']: system, prompt: text } }),
    });
    let p = await res.json().catch(() => ({}));
    if (res.status === 429) return { limited: Math.min(11, (Number(p.retry_after) || Number(res.headers.get('retry-after')) || 9) + 1) };
    while (res.ok && (p.status === 'starting' || p.status === 'processing') && p.urls?.get && end - Date.now() > 900) {
      await new Promise((ok) => setTimeout(ok, 700));
      const again = await timed(p.urls.get, { headers });
      if (again.ok) p = await again.json().catch(() => p);
    }
    if (!res.ok || p.status !== 'succeeded') {
      if (p.urls?.cancel && (p.status === 'starting' || p.status === 'processing')) fetch(p.urls.cancel, { method: 'POST', headers }).catch(() => {}); // nobody is waiting for it any more
      console.error('Translate:', model, res.status, p.status || '', String(p.detail || p.error || '').slice(0, 120)); return {};
    }
    return { out: (Array.isArray(p.output) ? p.output.join('') : String(p.output || '')).trim() };
  } catch (e) { console.error('Translate:', model, e?.name === 'AbortError' ? 'no answer in time' : e?.message || e); return {}; }
}

const KEEP_TEXT = 'IMPORTANT: any text meant to be written ON the image (usually in quotes) must stay EXACTLY as written, in its original language and characters, inside double quotes. Do not translate or transliterate it. ';
// Directions the improve button can take an idea in. One of each is drawn for every press, so two presses in a
// row do not come back with the same picture. The idea itself, its subject and its details, never changes.
const ANGLES = ['a low angle looking up', 'a high angle looking down', 'an extreme close-up', 'a wide establishing view', 'an over-the-shoulder view', 'a symmetrical head-on view', 'a tilted, dynamic angle', 'a view through something in the foreground'];
const LIGHTS = ['golden hour sun', 'soft overcast light', 'hard midday light with deep shadows', 'blue hour after sunset', 'neon and reflections at night', 'a single window light', 'backlight with a glowing rim', 'candle or fire light', 'fog with light beams'];
const MOODS = ['calm and quiet', 'dramatic and tense', 'playful and bright', 'mysterious', 'nostalgic and warm', 'epic and grand', 'dreamlike', 'raw and documentary'];
const STYLES = ['photorealistic', 'cinematic film still', '35mm analog photo with grain', 'studio product shot', 'watercolor painting', 'flat vector illustration', '3D render with soft materials', 'ink drawing with one accent color', 'paper-cut collage', 'oil painting with visible brushwork'];
const MOVES = ['a slow push-in', 'a smooth tracking shot from the side', 'a slow orbit around the subject', 'a rising crane shot', 'a handheld follow', 'a slow pull-back reveal', 'a locked-off shot where only the subject moves'];
const pick = (list) => list[Math.floor(Math.random() * list.length)];
export function newDirection(kind) {
  return kind === 'video' ? `${pick(MOVES)}, ${pick(LIGHTS)}, ${pick(MOODS)}` : `${pick(ANGLES)}, ${pick(LIGHTS)}, ${pick(MOODS)}, ${pick(STYLES)}`;
}

// What the language model is told. `improve`: false (translate only), 'image' or 'video' (also fill the idea in).
// `press`: the person pressed the improve button ({ direction, avoid: [earlier versions], long }). Then the model is
// asked to understand the idea and take it in the given direction, and not to repeat what it already offered.
function instructions(keepText, improve, press = null) {
  if (!improve) return 'You translate prompts for an AI image generator into precise, descriptive English. '
    + 'Keep every detail, subject, style, color, number and composition instruction; do not add new ideas. '
    + (keepText ? KEEP_TEXT : '')
    + 'If the prompt is already English, return it unchanged. Output only the English prompt, no notes.';
  const rules = 'Do not add people, brands, or the names of real persons or artists that were not in the idea. Do not add any text to be written in the picture. '
    + (keepText ? KEEP_TEXT : '')
    + 'If the idea is not in English, translate it. Output only the prompt, no notes and no quotes around it.';
  if (press) {
    return `You are a creative director writing one prompt for an AI ${improve} generator, in English, at most ${press.long ? 130 : 70} words. `
      + 'First understand what the person means: the subject, what matters to them, and anything they asked for. Keep all of that; never change what the idea is about, and never drop a detail they gave. '
      + (press.long ? 'Their prompt is already detailed: keep its content, make it clearer and more vivid, and settle anything it left open. ' : '')
      + `Then take it in this creative direction, as far as it does not contradict what they asked for: ${press.direction}. `
      + (improve === 'video' ? 'Describe one continuous shot: what moves and how, and the camera movement. ' : 'Describe the setting, the composition and the light concretely. ')
      + (press.avoid?.length ? `You already offered the versions below. This one must be clearly different from each of them in angle, light, mood and style:\n${press.avoid.map((v, i) => `${i + 1}. ${v}`).join('\n')}\n` : '')
      + rules;
  }
  return `You turn a short idea into one prompt for an AI ${improve} generator, in English, at most 60 words. `
    + 'Keep the subject and every detail the person gave, and do not change what the idea is about. '
    + (improve === 'video'
      ? 'Add only what makes the shot clear: what moves and how, one camera movement, the setting, the light and the mood. Describe one continuous shot. '
      : 'Add only what makes the picture clear: the setting, the light, the composition, the mood, and a fitting visual style when none was given. ')
    + rules;
}

async function llmTranslate(text, keepText, improve = false, press = null) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return null;
  const system = instructions(keepText, improve, press);
  // An improved prompt is longer than the idea it came from; a translation is not.
  const tooLong = (out) => out.length > (improve ? (press?.long ? 1400 : 800) : text.length * 4 + 200);
  let waited = false;
  const started = Date.now();
  const each = improve ? 12_000 : TIMEOUT_MS, all = improve ? 16_000 : 9000; // one model, and all of them together
  const left = () => Math.max(1500, Math.min(each, all - (Date.now() - started)));
  // What a model answered, cleaned; '' when it is not a usable English prompt.
  const usable = (model, raw) => {
    let out = String(raw || '').replace(/^(here is|here's|translation|english)[^:\n]*:\s*/i, '').trim();
    if (/^".*"$/s.test(out) && !/^"[^"]*"$/.test(text.trim())) out = out.slice(1, -1).trim();
    if (!out || tooLong(out) || NON_LATIN.test(out.replace(QUOTED, ''))) { console.error('Translate:', model, 'answer refused:', out.slice(0, 80)); return ''; }
    return out;
  };
  for (const model of TOOLS.translate.models) {
    if (Date.now() - started > all - 1500) break; // the picture itself still needs most of the request's time
    let r = await ask(model, system, text, token, left());
    // An account with a low balance may start only one run every ten seconds. Wait once and ask again.
    if (r.limited && !waited) { waited = true; await new Promise((ok) => setTimeout(ok, r.limited * 1000)); r = await ask(model, system, text, token, left()); }
    if (!r.out) continue; // the model did not answer: the next one gets its turn
    let out = usable(model, r.out);
    // It answered, but not in English (a word or two left in the original language). Ask the same model once more.
    if (!out && Date.now() - started < all - 1500) out = usable(model, (await ask(model, `${system} Every word outside double quotes must be English.`, text, token, left())).out);
    if (!out) continue;
    console.log('Translated a prompt with', model, `in ${Date.now() - started} ms`);
    return out;
  }
  return null;
}

// Filling in an idea is free for the person and costs the site a fraction of a cent, so each account gets a
// fixed number a day (the button in the prompt box and the automatic one before a generation count together).
// Past that, prompts are simply used as written. Each call here counts one.
export const IMPROVE_DAILY = 50;
export async function improveAllowed(creatorId, admin = false) {
  if (admin) return true;
  if (!creatorId) return false;
  return (await bump(`improve:${creatorId}`, 1, IMPROVE_DAILY).catch(() => 0)) !== null;
}

// Returns { prompt, improved }: the English prompt to send to the model (the original on any failure), and whether
// a short idea was filled in on the way. Translation is always automatic. Filling in happens only when the caller
// asks for it (`improve`: 'image' or 'video') and the text is a short idea.
// Text inside quotes is what the person wants written IN the picture, so it stays exactly as they wrote it, in
// every language and for every model: the model is told to leave it alone, and an answer that changed it
// is thrown away.
// `press`: the improve button was pressed ({ avoid: [earlier versions] }). It always improves, whatever the length,
// and each press goes in a newly drawn direction.
export async function preparePrompt(text, { keepText = false, admin = false, improve = false, press = null } = {}) {
  const original = String(text || '').trim();
  const fill = improve && (press || shortIdea(original)) ? improve : false;
  const how = press && fill ? { direction: newDirection(fill), avoid: (press.avoid || []).slice(-3).map((v) => String(v).slice(0, 500)), long: !shortIdea(original) } : null;
  const translate = needsTranslation(original);
  if (!original || (!translate && !fill)) return { prompt: original, improved: false };
  keepText = keepText || quotedParts(original).length > 0;
  const spend = await reserveSpend(0.0005, { admin });
  const kept = (out) => (out && keepText && quotedParts(original).some((q) => !out.includes(q)) ? null : out); // every quoted string must survive
  const started = Date.now();
  let out = spend.ok ? kept(await llmTranslate(original, keepText, fill, how)) : null;
  let improved = Boolean(out && fill);
  // Filling in did not work, but the prompt still has to be English: translate it plainly, if there is time.
  if (!out && fill && translate && spend.ok && Date.now() - started < 5000) { out = kept(await llmTranslate(original, keepText, false)); improved = false; }
  if (!out && spend.ok) await spend.release();
  if (out) return { prompt: out, improved: improved && out !== original };
  // Fallback: the old free Hebrew translator (not for Text mode, where it would translate the on-image text).
  if (!keepText && /[\u0590-\u05FF]/.test(original)) return { prompt: await translateIfHebrew(original), improved: false };
  return { prompt: original, improved: false };
}

// The English prompt alone, for the tools that only translate.
export async function toEnglishPrompt(text, opts = {}) {
  return (await preparePrompt(text, { ...opts, improve: false })).prompt;
}
