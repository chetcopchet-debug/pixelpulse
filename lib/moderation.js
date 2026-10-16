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
const SEXUAL = new RegExp(String.raw`\b(nudes|nudity|naked|nsfw|sex|sexy|sexual|porn|porno|pornographic|erotic|explicit|topless|bottomless|lingerie|undress|undressed|undressing|stripping|stripper|strippers|striptease|strip[- ](club|show|tease|naked|down|off)|nipples?|genitals?|penis|vagina|boobs?|orgasm|fetish|bdsm|hentai|onlyfans|xxx)\b|\bnude\b(?!\s+(lipstick|lip|shade|shades|color|colour|tone|tones|palette|makeup|heels|nail|nails|polish|beige|swatch|pumps|blush|eyeshadow))|(?<!\b(chicken|turkey|duck|grilled|roast|roasted|fried)\s)\bbreasts?\b|` + HE('עירום|עירומה|סקס|סקסי|פורנו|ארוטי'), 'i');
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

export function checkPromptText(text) {
  const t = String(text || '').toLowerCase();
  if (SEXUAL.test(t) && MINOR.test(t)) return 'Content involving minors in a sexual context is not allowed.';
  if (SEXUAL.test(t) && CELEB.test(t)) return 'Sexual content of real people is not allowed.';
  if (DEEPFAKE.test(t)) return 'Deepfake or non-consensual imagery is not allowed.';
  if (SEXUAL.test(t)) return 'Sexual content is not allowed.';
  if (VIOLENT.test(t)) return 'Graphic violence or self-harm is not allowed.';
  if (HATE.test(t) || (NAZI.test(t) && !HISTORY.test(t))) return 'Hateful content is not allowed.';
  return null;
}

// One user-facing message for every route that blocks a prompt (English / Hebrew).
export function blockedMessage(reason) {
  return `${String(reason || 'This content is not allowed.').replace(/ can’t be published to the feed\./, ' is not allowed.')} / התוכן הזה אסור ליצירה.`;
}

// Returns { ok: true } | { ok: false, reason, retry? }
export async function moderateForPublish({ prompt, imageUrl }) {
  const textReason = checkPromptText(prompt);
  if (textReason) return { ok: false, reason: textReason };
  if (!process.env.REPLICATE_API_TOKEN) return { ok: false, reason: 'Safety check unavailable, try again later.', retry: true };
  await reserveSpend(0.0003, { admin: true }); // counted in the daily spend total, never blocks safety checks
  const r = await runReplicate({ version: NSFW_VERSION, input: { image: imageUrl }, budgetMs: 25_000 });
  const label = String(Array.isArray(r.output) ? r.output[0] : r.output || '').trim().toLowerCase();
  if (label === 'normal') return { ok: true };
  if (label === 'nsfw') return { ok: false, reason: 'This image looks explicit, so it can’t be published to the feed. It stays in your private gallery.' };
  console.error('Moderation unavailable:', r.error, r.output);
  return { ok: false, reason: 'Safety check is busy — please try publishing again in a minute.', retry: true };
}
