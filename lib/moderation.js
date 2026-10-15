// Pre-publish moderation: text blocklist + Replicate NSFW image classifier.
import { runReplicate } from './replicate';

// falcons-ai/nsfw_image_detection (ViT), pinned version; returns "normal" | "nsfw". ~$0.0003/run on T4.
const NSFW_VERSION = '97116600cabd3037e5f22ca08ffcc33b92cfacebf7ccd3609e9c1d29e43d3a8d';

const MINOR = /\b(child|children|kid|kids|minor|minors|underage|under[- ]?age|teen|teens|teenage|preteen|pre-teen|loli|lolita|shota|schoolgirl|schoolboy|young girl|young boy|little girl|little boy|baby|toddler|infant|\d{1,2}[- ]?(yo|y\/o|year[- ]?old))\b|ילד|ילדה|קטין|קטינה|תינוק/i;
const SEXUAL = /\b(nude|nudes|naked|nsfw|sex|sexy|sexual|porn|porno|erotic|explicit|topless|bottomless|lingerie|undress|undressed|strip|stripping|nipples?|genitals?|penis|vagina|boobs?|breasts?|orgasm|fetish|bdsm|hentai|onlyfans|xxx)\b|עירום|עירומה|סקס|פורנו|ארוטי/i;
const VIOLENT = /\b(gore|beheading|decapitat\w*|dismember\w*|mutilat\w*|child abuse|rape|raping|sexual assault|self[- ]?harm|suicide)\b/i;
const HATE = /\b(nazi propaganda|kill all|genocide of|white power|heil hitler)\b/i;
const DEEPFAKE = /\b(deepfake|deep fake|face ?swap|undress\w* (her|him)|revenge porn)\b/i;
// Small list of very frequently targeted real people; combined with sexual terms -> block.
const CELEB = /\b(taylor swift|ariana grande|billie eilish|emma watson|scarlett johansson|selena gomez|kim kardashian|kylie jenner|beyonce|rihanna|zendaya|margot robbie|jenna ortega|messi|ronaldo|trump|biden|obama|putin|netanyahu|elon musk)\b/i;

export function checkPromptText(text) {
  const t = String(text || '').toLowerCase();
  if (SEXUAL.test(t) && MINOR.test(t)) return 'Content involving minors in a sexual context is not allowed.';
  if (SEXUAL.test(t) && CELEB.test(t)) return 'Sexual content of real people is not allowed.';
  if (DEEPFAKE.test(t)) return 'Deepfake or non-consensual imagery is not allowed.';
  if (SEXUAL.test(t)) return 'Sexual content can’t be published to the feed.';
  if (VIOLENT.test(t)) return 'Graphic violence or self-harm can’t be published to the feed.';
  if (HATE.test(t)) return 'Hateful content is not allowed.';
  return null;
}

// Returns { ok: true } | { ok: false, reason, retry? }
export async function moderateForPublish({ prompt, imageUrl }) {
  const textReason = checkPromptText(prompt);
  if (textReason) return { ok: false, reason: textReason };
  if (!process.env.REPLICATE_API_TOKEN) return { ok: false, reason: 'Safety check unavailable, try again later.', retry: true };
  const r = await runReplicate({ version: NSFW_VERSION, input: { image: imageUrl }, budgetMs: 25_000 });
  const label = String(Array.isArray(r.output) ? r.output[0] : r.output || '').trim().toLowerCase();
  if (label === 'normal') return { ok: true };
  if (label === 'nsfw') return { ok: false, reason: 'This image looks explicit, so it can’t be published to the feed. It stays in your private gallery.' };
  console.error('Moderation unavailable:', r.error, r.output);
  return { ok: false, reason: 'Safety check is busy — please try publishing again in a minute.', retry: true };
}
