// Transparent prompt translation: any language -> precise, descriptive English for the image and video models.
// Whether a prompt needs it is decided instantly, without a model (lib/promptLanguage.js).
// In Text mode, quoted on-image text is kept verbatim (original language and characters). Always fails open.
import { TOOLS } from './replicate';
import { reserveSpend } from './usage';
import { translateIfHebrew } from './generation';
import { NON_LATIN, QUOTED, needsTranslation, quotedParts } from './promptLanguage.js';

export { needsTranslation };

const TIMEOUT_MS = 7000;

// One request to one language model. Returns { out } on success, { limited: seconds } when Replicate says to slow
// down, or {} on any other failure.
async function ask(model, system, text, token) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
      method: 'POST', cache: 'no-store', signal: ctl.signal,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'wait=5' },
      // Google's models call the instructions "system_instruction"; the others call them "system_prompt".
      body: JSON.stringify({ input: { [model.startsWith('google/') ? 'system_instruction' : 'system_prompt']: system, prompt: text } }),
    });
    const p = await res.json().catch(() => ({}));
    if (res.status === 429) return { limited: Math.min(11, (Number(p.retry_after) || Number(res.headers.get('retry-after')) || 9) + 1) };
    if (!res.ok || p.status !== 'succeeded') { console.error('Translate:', model, res.status, p.status || '', String(p.detail || p.error || '').slice(0, 120)); return {}; }
    return { out: (Array.isArray(p.output) ? p.output.join('') : String(p.output || '')).trim() };
  } catch (e) { console.error('Translate:', model, e?.name === 'AbortError' ? 'no answer in time' : e?.message || e); return {}; }
  finally { clearTimeout(timer); }
}

async function llmTranslate(text, keepText) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return null;
  const system = 'You translate prompts for an AI image generator into precise, descriptive English. '
    + 'Keep every detail, subject, style, color, number and composition instruction; do not add new ideas. '
    + (keepText ? 'IMPORTANT: any text meant to be written ON the image (usually in quotes) must stay EXACTLY as written, in its original language and characters, inside double quotes. Do not translate or transliterate it. ' : '')
    + 'If the prompt is already English, return it unchanged. Output only the English prompt, no notes.';
  let waited = false;
  const started = Date.now();
  // What a model answered, cleaned; '' when it is not a usable English prompt.
  const usable = (model, raw) => {
    let out = String(raw || '').replace(/^(here is|here's|translation|english)[^:\n]*:\s*/i, '').trim();
    if (/^".*"$/s.test(out) && !/^"[^"]*"$/.test(text.trim())) out = out.slice(1, -1).trim();
    if (!out || out.length > text.length * 4 + 200 || NON_LATIN.test(out.replace(QUOTED, ''))) { console.error('Translate:', model, 'answer refused:', out.slice(0, 80)); return ''; }
    return out;
  };
  for (const model of TOOLS.translate.models) {
    if (Date.now() - started > 9000) break; // the picture itself still needs most of the request's time
    let r = await ask(model, system, text, token);
    // An account with a low balance may start only one run every ten seconds. Wait once and ask again.
    if (r.limited && !waited) { waited = true; await new Promise((ok) => setTimeout(ok, r.limited * 1000)); r = await ask(model, system, text, token); }
    if (!r.out) continue; // the model did not answer: the next one gets its turn
    let out = usable(model, r.out);
    // It answered, but not in English (a word or two left in the original language). Ask the same model once more.
    if (!out && Date.now() - started < 9000) out = usable(model, (await ask(model, `${system} Every word outside double quotes must be English.`, text, token)).out);
    if (!out) continue;
    console.log('Translated a prompt with', model, `in ${Date.now() - started} ms`);
    return out;
  }
  return null;
}

// Returns the English prompt to send to the model (or the original on any failure). Always automatic.
// Text inside quotes is what the person wants written IN the picture, so it stays exactly as they wrote it, in
// every language and for every model: the translator is told to leave it alone, and an answer that changed it
// is thrown away.
export async function toEnglishPrompt(text, { keepText = false, admin = false } = {}) {
  const original = String(text || '').trim();
  if (!original || !needsTranslation(original)) return original;
  keepText = keepText || quotedParts(original).length > 0;
  const spend = await reserveSpend(0.0005, { admin });
  let out = spend.ok ? await llmTranslate(original, keepText) : null;
  if (out && keepText) {
    // Every quoted on-image string must survive verbatim; otherwise fail open.
    const lost = quotedParts(original).some((q) => !out.includes(q));
    if (lost) out = null;
  }
  if (!out && spend.ok) await spend.release();
  if (out) return out;
  // Fallback: the old free Hebrew translator (not for Text mode, where it would translate the on-image text).
  if (!keepText && /[\u0590-\u05FF]/.test(original)) return translateIfHebrew(original);
  return original;
}
