// Auto: picks the image model that fits what the prompt asks for.
// It runs on the device while the prompt is typed, so the button always shows which model will run and what it
// costs before anything is charged. The server then gets an ordinary request for that model.
import { N } from "../i18n/index.js";
import { imageModels } from "./models.js";

const QUOTED = /["“”„«»״]([^"“”„«»״\n]{2,80})["“”„«»״]|(^|\s)'([^'\n]{2,80})'(?=\s|$|[.,!?;:])/;

// Each kind of request: how to recognise it, and the models to use, best first. Every list ends with the 1-credit
// model, so a small balance still gets a picture.
const KINDS = [
  { id: "text", why: N("Your prompt asks for words in the image"), picks: ["ideogram", "nano-banana", "fast"],
    en: /\b(text|words?|lettering|typography|title|headline|caption|slogan|signs?|signage|label|posters?|banners?|flyers?|wordmark|menu|invitation|infographic|says|written|that reads|spell(s|ed|ing)?)\b/g,
    he: ["טקסט", "כיתוב", "כתוב", "כותרת", "שלט", "פוסטר", "כרזה", "באנר", "הזמנה", "תפריט", "סלוגן", "מילים", "המילה"] },
  { id: "complex", why: N("A long, detailed prompt"), picks: ["gpt-image", "nano-banana", "fast"],
    en: /\b(diagram|chart|map|comic strip|panels?|storyboard|interface|mockup|screenshot|blueprint|instructions?|step[- ]by[- ]step|exactly|collage|grid of|labell?ed)\b/g,
    he: ["תרשים", "מפה", "קומיקס", "ממשק", "שלבים", "בדיוק", "קולאז"] },
  { id: "design", why: N("Looks like a design or illustration"), picks: ["recraft-41", "seedream-5", "grok", "fast"],
    en: /\b(illustration|vector|icons?|logo|stickers?|flat|pattern|mascot|emoji|line art|clip ?art|t-?shirt|coloring page|brand(ing)?|badge|emblem|minimal(ist)?|isometric|doodle|svg)\b/g,
    he: ["איור", "וקטור", "אייקון", "לוגו", "סמל", "מדבקה", "מיתוג", "דף צביעה", "מינימליסטי", "סטיקר"] },
  { id: "photo", why: N("Looks like a realistic photo"), picks: ["flux-3", "flux-2-pro", "grok", "fast"],
    en: /\b(photo(graph(y|ic)?)?|photoreal(istic|ism)?|realistic|portrait|headshot|product shot|studio (shot|light(ing)?)|dslr|35mm|85mm|bokeh|macro|close-?up|candid|editorial|interior|real estate|food photography|shot on)\b/g,
    he: ["צילום", "תמונה ריאליסטית", "ריאליסטי", "מציאותי", "פורטרט", "תמונת מוצר", "תקריב", "סטודיו"] },
  { id: "style", why: N("A stylised, cinematic look"), picks: ["grok", "fast"],
    en: /\b(anime|manga|cartoon|cinematic|moody|noir|cyberpunk|fantasy|concept art|dramatic|epic|comic book|pixar|ghibli|oil painting|watercolou?r|painting|3d render)\b/g,
    he: ["אנימה", "מנגה", "מצויר", "קולנועי", "סייברפאנק", "פנטזיה", "ציור שמן", "צבעי מים", "אפל", "דרמטי"] },
];
const ANY = { id: "any", why: N("A good all-rounder for this prompt"), picks: ["nano-banana", "grok", "fast"] };

// What kind of request a prompt is. Text in quotes counts strongly towards "words in the image".
export function promptKind(prompt) {
  const raw = String(prompt || ""); const text = raw.toLowerCase();
  let best = ANY, top = 0;
  for (const k of KINDS) {
    let n = (text.match(k.en) || []).length + k.he.filter((w) => raw.includes(w)).length;
    if (k.id === "text" && QUOTED.test(raw)) n += 3;
    if (k.id === "complex" && (raw.length >= 420 || raw.trim().split(/\s+/).length >= 70)) n += 3;
    if (n > top) { top = n; best = k; } // on a tie the earlier kind wins: the list is in order of priority
  }
  return best;
}

// The model Auto would run for this prompt and this wallet.
// Returns { id, kind, why, fitted } where `fitted` means a cheaper model was chosen because the balance doesn't
// cover the first choice. If the balance covers nothing, the first choice is returned and the usual
// "sign in" or "add credits" step follows.
// `off`: ids of models their provider has switched off. Auto never picks one of those.
export function autoPick(prompt, wallet, off) {
  const kind = promptKind(prompt);
  const cost = (id) => imageModels.find((m) => m.id === id)?.cost ?? Infinity;
  const can = (id) => !wallet || !wallet.loaded || wallet.admin || (wallet.paid || 0) >= cost(id) || (wallet.free || 0) >= cost(id);
  const gone = off instanceof Set ? off : new Set(off || []);
  let picks = kind.picks.filter((id) => Number.isFinite(cost(id)) && !gone.has(id));
  // Every model for this kind of prompt is off: fall back to anything that still runs, cheapest last resort first.
  if (!picks.length) picks = imageModels.filter((m) => !gone.has(m.id)).map((m) => m.id).reverse();
  const id = picks.find(can) || picks[0];
  return { id, kind: kind.id, why: kind.why, fitted: id !== picks[0] };
}

// ---- video ----
// The same idea for video: what the prompt asks for decides the model. Best first; every list ends with the
// cheapest model. Models with sound come first when the prompt is about something heard.
const VKINDS = [
  { id: "sound", why: N("Your prompt has speech, music or sound"), picks: ["seedance-25", "veo", "omni", "grok-video", "wan"],
    en: /\b(says?|said|speak(s|ing)?|talk(s|ing)?|dialogue|sing(s|ing)?|song|voice|music|sound|whispers?|shouts?|laugh(s|ing)?|roar(s|ing)?|thunder|narrat\w+|sound:)/g,
    he: ["אומר", "מדבר", "שר ", "שרה", "קול", "מוזיקה", "צליל", "לוחש", "צועק", "צוחק", "רעם"] },
  { id: "people", why: N("Realistic people and action"), picks: ["kling-4", "seedance-25", "h3-lite", "wan"],
    en: /\b(man|woman|men|women|person|people|girl|boy|child(ren)?|face|portrait|athlete|dancer|runs?|running|fight(s|ing)?|danc(e|es|ing)|jump(s|ing)?|sport|chase|walk(s|ing)?)\b/g,
    he: ["איש", "אישה", "אנשים", "ילד", "ילדה", "פנים", "רץ", "רצה", "רוקד", "רוקדת", "קופץ", "ספורט", "הולך", "הולכת"] },
  { id: "social", why: N("A quick, bold clip"), picks: ["grok-video", "h3-lite", "wan"],
    en: /\b(meme|tiktok|reel|shorts?|viral|funny|loop|gif|anime|cartoon)\b/g,
    he: ["מם", "טיקטוק", "ריל", "מצחיק", "לופ", "אנימה", "מצויר"] },
];
const VANY = { id: "any", why: N("Film-like motion with fine detail"), picks: ["seedance-25", "omni", "h3-lite", "wan"] };
function videoKind(prompt) {
  const raw = String(prompt || ""); const text = raw.toLowerCase();
  let best = VANY, top = 0;
  for (const k of VKINDS) { const n = (text.match(k.en) || []).length + k.he.filter((w) => raw.includes(w)).length; if (n > top) { top = n; best = k; } }
  return best;
}

// What to recommend for a prompt: the model that makes the most of it, whatever it costs, and a cheap one beside it.
//   best   the first choice for this kind of prompt
//   pick   the best one the balance covers (the same as best when it can be paid for)
//   saver  the cheapest that still suits the prompt
//   short  how many credits are missing for `best` (0 when it is covered, or when the balance is not known)
// `kind`: "image" or "video". `priceOf(id)`: what one run costs right now (a video's length and quality count).
// Video is paid from bought credits only. `off`: models that are switched off.
// `cap`: the most `pick` may cost. Auto for video uses it, so that Auto never runs the most expensive models by
// itself; those are only offered, in the card after the improve button. `best` and `short` ignore the cap.
export const VIDEO_AUTO_CAP = 100;
export function recommend(prompt, kind, wallet, off, priceOf, cap = Infinity) {
  const video = kind === "video";
  const k = video ? videoKind(prompt) : promptKind(prompt);
  const gone = off instanceof Set ? off : new Set(off || []);
  const cost = (id) => { const c = priceOf(id); return Number.isFinite(c) ? c : Infinity; };
  let picks = k.picks.filter((id) => Number.isFinite(cost(id)) && !gone.has(id));
  if (!picks.length) return null;
  const known = Boolean(wallet && wallet.loaded && !wallet.admin);
  const have = !known ? Infinity : video ? wallet.paid || 0 : Math.max(wallet.paid || 0, wallet.free || 0);
  const best = picks[0];
  const saver = picks.reduce((a, b) => (cost(b) < cost(a) ? b : a), best);
  const within = picks.filter((id) => cost(id) <= cap);
  // The first choice under the cap. With a cap and nothing under it, there is no pick at all (pick: null): Auto
  // never runs a model above its cap, and the caller falls back to the model the person chose.
  const top = within[0] || (Number.isFinite(cap) ? null : saver);
  const pick = within.find((id) => cost(id) <= have) || top;
  return { kind: k.id, why: k.why, best, pick, saver, fitted: pick !== top, short: known ? Math.max(0, cost(best) - have) : 0, cost };
}
