// Pre-publish moderation: text blocklist + Replicate NSFW image classifier.
import { runReplicate } from './replicate';
import { reserveSpend } from './usage';

// falcons-ai/nsfw_image_detection (ViT), pinned version; returns "normal" | "nsfw". ~$0.0003/run on T4.
const NSFW_VERSION = '97116600cabd3037e5f22ca08ffcc33b92cfacebf7ccd3609e9c1d29e43d3a8d';

// Hebrew words get letter boundaries (so סקס doesn't match inside סקסופון), allowing a one-letter prefix (ו/ה/ב/ל/מ/ש/כ)
// and common suffixes. HE(...) builds that pattern.
const HE = (words) => `(?<![\\u0590-\\u05FF])[והבלמשכ]?(?:${words})(?:ה|ית|יים|יות|ים|ות|י)?(?![\\u0590-\\u05FF])`;
const MINOR = new RegExp(String.raw`\b(child|children|kid|kids|minor|minors|underage|under[- ]?age|teen|teens|teenage|preteen|pre-teen|loli|lolita|shota|schoolgirl|schoolboy|young girl|young boy|little girl|little boy|baby|toddler|infant|\d{1,2}[- ]?(yo|y\/o|year[- ]?old))\b|` + HE('ילד|ילדה|קטין|קטינה|תינוק'), 'i');
// Ambiguous words only count in context: "nude" (not nude lipstick/shade...), "breast(s)" (not chicken/turkey/duck breast),
// "strip" only as stripping / stripper / striptease / strip club|show|tease|naked|down|off.
const SEXUAL = new RegExp(String.raw`\b(sexually|suggestive|nudes|nudity|naked|nsfw|sex|sexy|sexual|porn|porno|pornographic|erotic|explicit|topless|bottomless|lingerie|undress|undressed|undressing|stripping|stripper|strippers|striptease|strip[- ](club|show|tease|naked|down|off)|nipples?|genitals?|penis|vagina|boobs?|orgasm|fetish|bdsm|hentai|onlyfans|xxx)\b|\bnude\b(?!\s+(lipstick|lip|shade|shades|color|colour|tone|tones|palette|makeup|heels|nail|nails|polish|beige|swatch|pumps|blush|eyeshadow))|(?<!\b(chicken|turkey|duck|grilled|roast|roasted|fried)\s)\bbreasts?\b|` + HE('עירום|עירומה|סקס|סקסי|פורנו|ארוטי'), 'i');
// "rape" blocks unless it's the plant/crop (rape flowers, rapeseed); "suicide" unless the Suicide Squad title.
const VIOLENT = /\b(gore|beheading|decapitat\w*|dismember\w*|mutilat\w*|child abuse|raping|raped|rapist|sexual assault|self[- ]?harm)\b|\brape\b(?!\s*(flowers?|fields?|seeds?|plants?|crops?|oil|blossoms?|yellow))|\bsuicide\b(?!\s+squad)/i;
// "kill all" blocks unless the object is clearly harmless (lights, noise, engines, processes...).
const HATE = /\b(white power|genocide of)\b|\bkill all\b(?!\s+(the\s+)?(lights?|noise|sounds?|music|engines?|processes|tabs|bugs|germs|weeds|notifications))/i;
// Nazi slogans/propaganda block unless the prompt is clearly historical/museum/documentary framing (simple heuristic).
const NAZI = /\b(nazi propaganda|heil hitler)\b/i;
const HISTORY = /\b(museum|exhibit|exhibition|historical|history|documentary|archive|archival|memorial|holocaust remembrance)\b/i;
const DEEPFAKE = /\b(deepfake|deep fake|face ?swap|undress\w* (her|him)|revenge porn)\b/i;
// Small list of very frequently targeted real people; combined with sexual terms -> block.
const CELEB = /\b(taylor swift|ariana grande|billie eilish|emma watson|scarlett johansson|selena gomez|kim kardashian|kylie jenner|beyonce|rihanna|zendaya|margot robbie|jenna ortega|messi|ronaldo|trump|biden|obama|putin|netanyahu|elon musk)\b/i;

// Minors (or girl/boy, only in this combination) + revealing clothing / suggestive framing -> treated as sexual content of minors.
const KIDISH = /\b(girls?|boys?)\b/i;
const REVEALING = /\b(bikini|bikinis|swimsuit|swimsuits|underwear|panties|bra|bras|thong|thongs|cleavage|shirtless|in bed|sexually|suggestive|seductive|sensual|provocative|revealing|lingerie|undressed)\b/i;
// Extra checks only for routes that transform a real person's photo (Face Lock, Edit).
const PERSON_EDIT = /\b(remove (her|his|their) clothes|take off (her|his|their) (shirt|top|dress|clothes)|without clothes|no clothes|clothes off|birthday suit|see[- ]?through|wet t-?shirt|bikini|bikinis|swimsuit|swimsuits|underwear|topless|shirtless|bare[- ]?chested)\b/i;

// Obfuscation normalizer: leetspeak inside words that also contain letters (so "16:9" stays, "4k" -> "ak" is harmless),
// punctuation between letters removed ("s.e.x" -> "sex"), and runs of 3+ spaced single letters collapsed ("s e x y" -> "sexy").
const LEET = { 4: 'a', 3: 'e', 0: 'o', 1: 'i', '@': 'a', $: 's' };
export function normalizeForModeration(text) {
  let t = String(text || '').toLowerCase();
  t = t.replace(/[a-z0-9@$]+/g, (w) => (/[a-z]/.test(w) && /[0-9@$]/.test(w) ? w.replace(/[4301@$]/g, (c) => LEET[c]) : w));
  t = t.replace(/(?<=[a-z])[.\-_*'`~|]+(?=[a-z])/g, '');
  t = t.replace(/\b[a-z](?:[\s.\-_*]+[a-z]\b){2,}/g, (m) => m.replace(/[^a-z]/g, ''));
  return t;
}

function checkOne(t) {
  if (SEXUAL.test(t) && MINOR.test(t)) return 'Content involving minors in a sexual context is not allowed.';
  if ((MINOR.test(t) || KIDISH.test(t)) && REVEALING.test(t)) return 'Content involving minors in a sexual context is not allowed.';
  if (SEXUAL.test(t) && CELEB.test(t)) return 'Sexual content of real people is not allowed.';
  if (DEEPFAKE.test(t)) return 'Deepfake or non-consensual imagery is not allowed.';
  if (SEXUAL.test(t)) return 'Sexual content is not allowed.';
  if (VIOLENT.test(t)) return 'Graphic violence or self-harm is not allowed.';
  if (HATE.test(t) || (NAZI.test(t) && !HISTORY.test(t))) return 'Hateful content is not allowed.';
  return null;
}

// Checks both the original and the normalized text.
export function checkPromptText(text) {
  const t = String(text || '').toLowerCase();
  return checkOne(t) || checkOne(normalizeForModeration(t));
}

// Face Lock / Edit only (in addition to checkPromptText): requests to undress or sexualize a real person's photo.
export function checkPersonEditText(text) {
  const t = String(text || '').toLowerCase();
  if (PERSON_EDIT.test(t) || PERSON_EDIT.test(normalizeForModeration(t))) return 'Undressing or sexualizing a real person’s photo is not allowed.';
  return null;
}

// One user-facing message (English) for every route that blocks a prompt.
export function blockedMessage(reason) {
  return `${String(reason || 'This content is not allowed.').replace(/ can’t be published to the feed\./, ' is not allowed.')}`;
}

// ---- Output image check (falcons-ai classifier) ----
// Returns 'normal' | 'nsfw' | 'unavailable'. Records ~$0.0003 in the daily spend total (never blocked by the cap).
export async function classifyImage(imageUrl, { budgetMs = 15_000 } = {}) {
  if (!process.env.REPLICATE_API_TOKEN || !imageUrl) return 'unavailable';
  await reserveSpend(0.0003, { admin: true });
  const r = await runReplicate({ version: NSFW_VERSION, input: { image: imageUrl }, budgetMs });
  const label = String(Array.isArray(r.output) ? r.output[0] : r.output || '').trim().toLowerCase();
  if (label === 'normal' || label === 'nsfw') return label;
  console.error('NSFW classifier unavailable:', r.error, r.output);
  return 'unavailable';
}
export const SAFETY_BUSY_MSG = 'Safety check is busy, please try again in a minute. Your credits were refunded.';
// Pure decision: policy 'closed' blocks when the classifier is unavailable, 'open' lets the image through.
// Returns null (allow) or { status, error }.
export function outputGate(label, policy) {
  if (label === 'normal') return null;
  if (label === 'nsfw') return { status: 422, error: blockedMessage('This image looks explicit and is not allowed.') };
  return policy === 'closed' ? { status: 503, error: SAFETY_BUSY_MSG } : null;
}
// Convenience: classify + decide.
export async function checkOutputImage(imageUrl, policy) {
  return outputGate(await classifyImage(imageUrl), policy);
}

// Returns { ok: true } | { ok: false, reason, retry? }
export async function moderateForPublish({ prompt, imageUrl }) {
  const textReason = checkPromptText(prompt);
  if (textReason) return { ok: false, reason: textReason };
  if (!process.env.REPLICATE_API_TOKEN) return { ok: false, reason: 'Safety check unavailable, try again later.', retry: true };
  const label = await classifyImage(imageUrl, { budgetMs: 25_000 });
  if (label === 'normal') return { ok: true };
  if (label === 'nsfw') return { ok: false, reason: 'This image looks explicit, so it can’t be published to the feed. It stays in your private gallery.' };
  return { ok: false, reason: 'Safety check is busy — please try publishing again in a minute.', retry: true };
}
