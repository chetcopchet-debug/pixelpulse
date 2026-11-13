// Transparent prompt translation: any language -> precise, descriptive English for the image and video models.
// Whether a prompt needs it is decided instantly, without a model (lib/promptLanguage.js).
// In Text mode, quoted on-image text is kept verbatim (original language and characters). Always fails open.
import { TOOLS } from './replicate';
import { reserveSpend, bump } from './usage';
import { translateIfHebrew } from './generation';
import { NON_LATIN, QUOTED, needsTranslation, quotedParts, shortIdea } from './promptLanguage.js';

export { needsTranslation, shortIdea };

// How long a prompt may take, all models together. A model that is still working is waited for, up to here.
const TRANSLATE_MS = 25_000, IMPROVE_MS = 40_000;

// One request to one language model. Returns { out } on success, { limited: seconds } when Replicate says to slow
// down, or {} on any other failure. `budgetMs` is all the time it may take: Replicate holds the request for a
// few seconds, and when the answer is not ready by then (a busy model, or an account being slowed down) the run
// is asked about again until it is, instead of being given up on.
// `stop.done` turns true when another model already answered: this run is then cancelled quietly.
async function ask(model, system, text, token, budgetMs = TRANSLATE_MS, extra = null, stop = null) {
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
      body: JSON.stringify({ input: { [model.startsWith('google/') ? 'system_instruction' : 'system_prompt']: system, prompt: text, ...(extra || {}) } }),
    });
    let p = await res.json().catch(() => ({}));
    if (res.status === 429) return { limited: Math.min(11, (Number(p.retry_after) || Number(res.headers.get('retry-after')) || 9) + 1) };
    while (res.ok && (p.status === 'starting' || p.status === 'processing') && p.urls?.get && end - Date.now() > 900 && !stop?.done) {
      await new Promise((ok) => setTimeout(ok, 700));
      const again = await timed(p.urls.get, { headers });
      if (again.ok) p = await again.json().catch(() => p);
    }
    if (!res.ok || p.status !== 'succeeded') {
      if (p.urls?.cancel && (p.status === 'starting' || p.status === 'processing')) fetch(p.urls.cancel, { method: 'POST', headers }).catch(() => {}); // nobody is waiting for it any more
      if (stop?.done) return {};
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
    // A press writes a structured prompt, the way carefully written prompts for the leading models are built:
    // one labelled line for each part. Pro is the same structure, written by a stronger model, with more room.
    const pro = press.level === 'pro';
    const parts = improve === 'video'
      ? ['Scene: where and when, the setting and atmosphere', 'Subjects: who or what is in it, their look and clothing', 'Action and pacing: what happens, beat by beat, and how fast', 'Camera: the shot, the lens feel and one camera movement', 'Lighting: the light, its direction and colour', 'Expressions: faces and body language, when there are people or animals', ...(press.sound ? ['Sound: ambience, effects and music mood; any spoken line inside double quotes'] : [])]
      : ['Scene: where and when, the setting and atmosphere', 'Subjects: who or what is in it, their look and clothing', 'Action: what is happening in this instant', 'Camera: the angle, the framing and the lens feel', 'Lighting: the light, its direction and colour', 'Expressions: faces and body language, when there are people or animals', 'Style: the medium and the finish'];
    return `You are a creative director writing one prompt for an AI ${improve} generator, in English, at most ${pro ? 190 : press.long ? 140 : 100} words in all. `
      + 'First understand what the person means: the subject, what matters to them, and anything they asked for. Keep all of that; never change what the idea is about, and never drop a detail they gave. '
      + (press.long ? 'Their prompt is already detailed: keep its content, make it clearer and more vivid, and settle anything it left open. ' : '')
      + (press.auto
        // Before a creation, with nobody choosing: no surprises. Their style if they gave one, otherwise a natural one.
        ? 'Style: if they named a visual style, a look or a medium, keep exactly that. If they did not, make it realistic and cinematic, in the way that fits the subject. Do not invent an unusual style, angle or mood. '
        : `Then take it in this creative direction, as far as it does not contradict what they asked for: ${press.direction}. `)
      + `Write it as labelled lines, each on its own line, in this order, leaving out a line that does not apply:\n${parts.join('\n')}\n`
      + 'Each line is concrete and visual. Start every line with its label and a colon. '
      + (press.avoid?.length ? `You already offered the versions below. This one must be clearly different from each of them in angle, light, mood and style:\n${press.avoid.map((v, i) => `${i + 1}. ${v}`).join('\n')}\n` : '')
      + 'Write only what is there: never write what is absent ("no people", "no text"). '
      + rules;
  }
  return `You turn a short idea into one prompt for an AI ${improve} generator, in English, at most 60 words. `
    + 'Keep the subject and every detail the person gave, and do not change what the idea is about. '
    + (improve === 'video'
      ? 'Add only what makes the shot clear: what moves and how, one camera movement, the setting, the light and the mood. Describe one continuous shot. '
      : 'Add only what makes the picture clear: the setting, the light, the composition, the mood, and a fitting visual style when none was given. ')
    + rules;
}

async function llmTranslate(text, keepText, improve = false, press = null, budgetMs = 0) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return null;
  const system = instructions(keepText, improve, press);
  // An improved prompt is longer than the idea it came from; a translation is not.
  const tooLong = (out) => out.length > (improve ? (press ? 1900 : 800) : text.length * 4 + 200);
  const started = Date.now();
  const pro = press?.level === 'pro';
  // All the time there is. A model that is still working on its answer is waited for until then, not given up on.
  const all = budgetMs || (improve ? IMPROVE_MS : TRANSLATE_MS);
  // When the first model has not answered by now, the next one is asked too, and the first answer wins.
  const hedge = improve ? (pro ? 15_000 : 10_000) : 6000;
  const left = () => Math.max(1500, all - (Date.now() - started));
  // What a model answered, cleaned; '' when it is not a usable English prompt.
  const usable = (model, raw) => {
    let out = String(raw || '').replace(/^(here is|here's|translation|english)[^:\n]*:\s*/i, '').trim();
    if (/^".*"$/s.test(out) && !/^"[^"]*"$/.test(text.trim())) out = out.slice(1, -1).trim();
    if (!out || tooLong(out) || NON_LATIN.test(out.replace(QUOTED, ''))) { console.error('Translate:', model, 'answer refused:', out.slice(0, 80)); return ''; }
    return out;
  };
  // A press writes a longer answer; Gemini Flash is asked first there, the other model is the backup.
  const models = pro ? TOOLS.improvePro.models : press ? TOOLS.improve.models : TOOLS.translate.models;
  const extraFor = (model) => (pro ? TOOLS.improvePro.extra[model] || null : null);
  const stop = { done: false };
  let waited = false;
  // One model, start to finish: its usable answer, or '' when it gave none.
  const tryModel = async (model) => {
    let r = await ask(model, system, text, token, left(), extraFor(model), stop);
    // An account with a low balance may start only one run every ten seconds. Wait once and ask again.
    if (r.limited && !waited && !stop.done) { waited = true; await new Promise((ok) => setTimeout(ok, r.limited * 1000)); r = await ask(model, system, text, token, left(), extraFor(model), stop); }
    if (!r.out) return '';
    let out = usable(model, r.out);
    // It answered, but not in English (a word or two left in the original language). Ask the same model once more.
    if (!out && !stop.done && Date.now() - started < all - 3000) out = usable(model, (await ask(model, `${system} Every word outside double quotes must be English.`, text, token, left(), extraFor(model), stop)).out);
    return out;
  };
  const won = await new Promise((resolve) => {
    let i = 0, running = 0, timer = null;
    const end = (v) => { clearTimeout(timer); stop.done = true; resolve(v); };
    const next = () => {
      clearTimeout(timer);
      if (stop.done) return;
      if (i >= models.length || Date.now() - started > all - 3000) { if (!running) end(null); return; }
      const model = models[i++]; running++;
      if (i < models.length) timer = setTimeout(next, hedge);
      tryModel(model).catch(() => '').then((out) => {
        running--;
        if (stop.done) return;
        if (out) end({ out, model });
        else next(); // this one gave nothing: the next gets its turn right away (or, with none left, the ones still working are waited for)
      });
    };
    next();
  });
  if (!won) return null;
  console.log(improve ? (pro ? 'Improved a prompt (Pro) with' : 'Improved a prompt with') : 'Translated a prompt with', won.model, `in ${Date.now() - started} ms`);
  llmTranslate.last = won.model;
  return won.out;
}

// Filling in an idea with the standard model is free for the person and costs the site a fraction of a cent, so
// each account gets a fixed number a day: 10, or 50 with a Yelvo Pro subscription. The button and the automatic
// one before a generation count together. Past that, prompts are simply used as written, and the button offers
// the Pro improvement (one credit) instead. Each call here counts one.
export const IMPROVE_DAILY = 10, IMPROVE_DAILY_PRO = 50;
export async function improveAllowed(creatorId, admin = false, subscriber = false) {
  if (admin) return true;
  if (!creatorId) return false;
  return (await bump(`improve:${creatorId}`, 1, subscriber ? IMPROVE_DAILY_PRO : IMPROVE_DAILY).catch(() => 0)) !== null;
}

// Returns { prompt, improved }: the English prompt to send to the model (the original on any failure), and whether
// a short idea was filled in on the way. Translation is always automatic. Filling in happens only when the caller
// asks for it (`improve`: 'image' or 'video') and the text is a short idea.
// Text inside quotes is what the person wants written IN the picture, so it stays exactly as they wrote it, in
// every language and for every model: the model is told to leave it alone, and an answer that changed it
// is thrown away.
// `press`: the improve button was pressed ({ avoid: [earlier versions] }). It always improves, whatever the length,
// and each press goes in a newly drawn direction. press.auto: asked for by the screen before a creation, not by a
// press: short ideas only, neutral style.
// `budgetMs`: all the time the caller can give (a creation that is itself waiting gives less).
// `sound`: the video model makes sound, so the improved prompt also says what is heard.
export async function preparePrompt(text, { keepText = false, admin = false, improve = false, press = null, sound = false, budgetMs = 0 } = {}) {
  const original = String(text || '').trim();
  const fill = improve && ((press && !press.auto) || shortIdea(original)) ? improve : false;
  // The automatic improvement (no press, or press.auto) writes the same structured prompt as the standard button,
  // with the standard model, but in a neutral style: the variety belongs to the button. Only for a short idea.
  const how = !fill ? null : press && !press.auto
    ? { direction: newDirection(fill), avoid: (press.avoid || []).slice(-3).map((v) => String(v).slice(0, 700)), long: !shortIdea(original), level: press.level === 'pro' ? 'pro' : 'std', sound: Boolean(press.sound) }
    : { avoid: [], long: false, level: 'std', sound: Boolean(press?.sound || sound), auto: true };
  const translate = needsTranslation(original);
  if (!original || (!translate && !fill)) return { prompt: original, improved: false };
  keepText = keepText || quotedParts(original).length > 0;
  const spend = await reserveSpend(0.0005, { admin });
  const kept = (out) => (out && keepText && quotedParts(original).some((q) => !out.includes(q)) ? null : out); // every quoted string must survive
  const started = Date.now();
  let out = spend.ok ? kept(await llmTranslate(original, keepText, fill, how, budgetMs)) : null;
  let improved = Boolean(out && fill);
  // Filling in did not work, but the prompt still has to be English: translate it plainly, if there is time.
  if (!out && fill && translate && spend.ok) { const rest = (budgetMs || IMPROVE_MS + 10_000) - (Date.now() - started); if (rest > 4000) { out = kept(await llmTranslate(original, keepText, false, null, Math.min(rest, TRANSLATE_MS))); improved = false; } }
  if (!out && spend.ok) await spend.release();
  if (out) return { prompt: out, improved: improved && out !== original, model: llmTranslate.last || null };
  // Fallback: the old free Hebrew translator (not for Text mode, where it would translate the on-image text).
  if (!keepText && /[\u0590-\u05FF]/.test(original)) return { prompt: await translateIfHebrew(original), improved: false };
  return { prompt: original, improved: false };
}

// The English prompt alone, for the tools that only translate.
export async function toEnglishPrompt(text, opts = {}) {
  return (await preparePrompt(text, { ...opts, improve: false })).prompt;
}
