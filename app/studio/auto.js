// Auto: picks the image model that fits what the prompt asks for.
// It runs on the device while the prompt is typed, so the button always shows which model will run and what it
// costs before anything is charged. The server then gets an ordinary request for that model.
import { imageModels } from "./models.js";

const QUOTED = /["“”„«»״]([^"“”„«»״\n]{2,80})["“”„«»״]|(^|\s)'([^'\n]{2,80})'(?=\s|$|[.,!?;:])/;

// Each kind of request: how to recognise it, and the models to use, best first. Every list ends with the 1-credit
// model, so a small balance still gets a picture.
const KINDS = [
  { id: "text", why: "Your prompt asks for words in the image", picks: ["ideogram", "nano-banana", "fast"],
    en: /\b(text|words?|lettering|typography|title|headline|caption|slogan|signs?|signage|label|posters?|banners?|flyers?|wordmark|menu|invitation|infographic|says|written|that reads|spell(s|ed|ing)?)\b/g,
    he: ["טקסט", "כיתוב", "כתוב", "כותרת", "שלט", "פוסטר", "כרזה", "באנר", "הזמנה", "תפריט", "סלוגן", "מילים", "המילה"] },
  { id: "complex", why: "A long, detailed prompt", picks: ["gpt-image", "nano-banana", "fast"],
    en: /\b(diagram|chart|map|comic strip|panels?|storyboard|interface|mockup|screenshot|blueprint|instructions?|step[- ]by[- ]step|exactly|collage|grid of|labell?ed)\b/g,
    he: ["תרשים", "מפה", "קומיקס", "ממשק", "שלבים", "בדיוק", "קולאז"] },
  { id: "design", why: "Looks like a design or illustration", picks: ["recraft-41", "seedream-5", "grok", "fast"],
    en: /\b(illustration|vector|icons?|logo|stickers?|flat|pattern|mascot|emoji|line art|clip ?art|t-?shirt|coloring page|brand(ing)?|badge|emblem|minimal(ist)?|isometric|doodle|svg)\b/g,
    he: ["איור", "וקטור", "אייקון", "לוגו", "סמל", "מדבקה", "מיתוג", "דף צביעה", "מינימליסטי", "סטיקר"] },
  { id: "photo", why: "Looks like a realistic photo", picks: ["flux-3", "flux-2-pro", "grok", "fast"],
    en: /\b(photo(graph(y|ic)?)?|photoreal(istic|ism)?|realistic|portrait|headshot|product shot|studio (shot|light(ing)?)|dslr|35mm|85mm|bokeh|macro|close-?up|candid|editorial|interior|real estate|food photography|shot on)\b/g,
    he: ["צילום", "תמונה ריאליסטית", "ריאליסטי", "מציאותי", "פורטרט", "תמונת מוצר", "תקריב", "סטודיו"] },
  { id: "style", why: "A stylised, cinematic look", picks: ["grok", "fast"],
    en: /\b(anime|manga|cartoon|cinematic|moody|noir|cyberpunk|fantasy|concept art|dramatic|epic|comic book|pixar|ghibli|oil painting|watercolou?r|painting|3d render)\b/g,
    he: ["אנימה", "מנגה", "מצויר", "קולנועי", "סייברפאנק", "פנטזיה", "ציור שמן", "צבעי מים", "אפל", "דרמטי"] },
];
const ANY = { id: "any", why: "A good all-rounder for this prompt", picks: ["nano-banana", "grok", "fast"] };

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
