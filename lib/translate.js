// Transparent prompt translation: any language -> precise, descriptive English for Flux / Ideogram.
// Non-Latin scripts are detected instantly; Latin-script prompts only go to the LLM when they look non-English.
// In Text mode, quoted on-image text is kept verbatim (original language and characters). Fails open unless strict.
import { TOOLS } from './replicate';
import { reserveSpend } from './usage';
import { translateIfHebrew } from './generation';

const TIMEOUT_MS = 4000;
// Letters outside Latin: Hebrew, Arabic, Cyrillic, Greek, CJK, Kana, Hangul, Thai, Devanagari, etc.
const NON_LATIN = /[\u0370-\u03FF\u0400-\u052F\u0530-\u058F\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u0900-\u0DFF\u0E00-\u0E7F\u10A0-\u10FF\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF]/;
const LATIN_ACCENT = /[À-ÖØ-öø-ÿĀ-žƠ-ưȘ-țẞ]/;
// Frequent function words of common Latin-script languages that are not English words.
const FOREIGN_WORDS = new Set(('el los las del y con una unos por para que muy en es '
  + 'le les des et avec une du au aux sur dans est pour '
  + 'der die das und mit ein eine einen im ist auf von zum zur '
  + 'il gli di che della nel con per sono '
  + 'um uma com em não os das dos na no '
  + 'het een van en op met '
  + 'bir ve ile '
  + 'och att med ett').split(' '));
const QUOTED = /"([^"]+)"|“([^”]+)”|«([^»]+)»|״([^״]+)״|„([^“”]+)[“”]/g;

export function needsTranslation(text) {
  const t = String(text || '');
  if (NON_LATIN.test(t)) return true;
  if (LATIN_ACCENT.test(t)) return true;
  const words = t.toLowerCase().match(/[a-z]+/g) || [];
  return words.filter((w) => FOREIGN_WORDS.has(w)).length >= (words.length > 6 ? 2 : 1);
}
const quotedParts = (t) => [...String(t).matchAll(QUOTED)].map((m) => m.slice(1).find(Boolean)).filter(Boolean);

async function llmTranslate(text, keepText, timeoutMs = TIMEOUT_MS) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return null;
  const system = 'You translate prompts for an AI image generator into precise, descriptive English. '
    + 'Keep every detail, subject, style, color, number and composition instruction; do not add new ideas. '
    + (keepText ? 'IMPORTANT: any text meant to be written ON the image (usually in quotes) must stay EXACTLY as written, in its original language and characters, inside double quotes. Do not translate or transliterate it. ' : '')
    + 'If the prompt is already English, return it unchanged. Output only the English prompt, no notes.';
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`https://api.replicate.com/v1/models/${TOOLS.amplify.model}/predictions`, {
      method: 'POST', cache: 'no-store', signal: ctl.signal,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'wait=4' },
      body: JSON.stringify({ input: { system_prompt: system, prompt: text, max_tokens: 600, temperature: 0.1 } }),
    });
    const p = await res.json().catch(() => ({}));
    if (!res.ok || p.status !== 'succeeded') return null;
    let out = (Array.isArray(p.output) ? p.output.join('') : String(p.output || '')).trim();
    out = out.replace(/^(here is|here's|translation|english)[^:\n]*:\s*/i, '').trim();
    if (/^".*"$/s.test(out) && !/^"[^"]*"$/.test(text.trim())) out = out.slice(1, -1).trim();
    if (!out || out.length > text.length * 4 + 200 || NON_LATIN.test(out.replace(QUOTED, ''))) return null;
    return out;
  } catch { return null; }
  finally { clearTimeout(timer); }
}

// Returns the English prompt to send to the image model (or the original on any failure).
// strict: true -> returns null when the text needed translation and translation failed (callers on real-person routes
// fail CLOSED with TRANSLATE_BUSY_MSG instead of moderating a text they could not read). budgetMs caps the LLM wait.
export const TRANSLATE_BUSY_MSG = 'Translation is busy right now. Please try again in a moment, or write the prompt in English.';
export async function toEnglishPrompt(text, { keepText = false, admin = false, strict = false, budgetMs = TIMEOUT_MS } = {}) {
  const original = String(text || '').trim();
  if (!original || !needsTranslation(original)) return original;
  const spend = budgetMs >= 1000 ? await reserveSpend(0.0005, { admin }) : { ok: false, release: async () => {} };
  let out = spend.ok ? await llmTranslate(original, keepText, Math.min(TIMEOUT_MS, budgetMs)) : null;
  if (out && keepText) {
    // Every quoted on-image string must survive verbatim; otherwise fail open.
    const lost = quotedParts(original).some((q) => !out.includes(q));
    if (lost) out = null;
  }
  if (!out && spend.ok) await spend.release();
  if (out) return out;
  // Fallback: the old free Hebrew translator (not for Text mode, where it would translate the on-image text).
  if (!keepText && /[\u0590-\u05FF]/.test(original) && budgetMs >= 1000) {
    const he = await translateIfHebrew(original);
    if (he && he !== original && !/[\u0590-\u05FF]/.test(he)) return he;
  }
  return strict ? null : original;
}
