// The parts of the language system that need nothing else: the list of languages, picking one, and the
// translator itself. Kept apart so tests and scripts can load them.
export const LANGS = [
  { id: "en", tag: "en", name: "English" },
  { id: "es", tag: "es", name: "Español" },
  { id: "pt", tag: "pt-BR", name: "Português (Brasil)" },
  { id: "fr", tag: "fr", name: "Français" },
  { id: "de", tag: "de", name: "Deutsch" },
  { id: "it", tag: "it", name: "Italiano" },
  { id: "ja", tag: "ja", name: "日本語" },
  { id: "ko", tag: "ko", name: "한국어" },
  { id: "zh", tag: "zh-CN", name: "简体中文" },
  { id: "id", tag: "id", name: "Bahasa Indonesia" },
];
export const LANG_COOKIE = "pp_lang";
export const isLang = (id) => LANGS.some((l) => l.id === id);

// From what a browser asks for ("pt-BR", "zh-Hans-CN", "de-AT", ...) to one of our languages. English when
// none of them is ours.
export function pickLang(wanted) {
  for (const w of wanted || []) {
    const base = String(w || "").trim().toLowerCase().split(/[-_]/)[0];
    const id = base === "in" ? "id" : base; // "in" is the old code for Indonesian
    if (isLang(id)) return id;
  }
  return "en";
}

const fill = (s, vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m)) : s);

// A translator for one dictionary ({ "English": "Translation" }, or null for English).
// t(key, vars): interface text. tm(message): a message that arrived from the server in English; it is found by
// its exact words, or by a key with braces that it fits ("{name} costs {n} credits.").
export function makeT(dict) {
  const t = (key, vars) => fill((dict && dict[key]) || key, vars);
  let patterns = null;
  const tm = (msg) => {
    if (typeof msg !== "string" || !msg || !dict) return msg || "";
    if (dict[msg]) return dict[msg];
    if (!patterns) {
      patterns = Object.keys(dict).filter((k) => k.includes("{")).map((k) => {
        const names = [];
        const re = new RegExp(`^${k.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{(\w+)\}/g, (m, n) => { names.push(n); return "(.+?)"; })}$`);
        return { k, re, names };
      });
    }
    for (const p of patterns) {
      const m = p.re.exec(msg);
      if (m) { const vars = {}; p.names.forEach((n, i) => { vars[n] = m[i + 1]; }); return fill(dict[p.k], vars); }
    }
    // Two messages in one ("That model is gone. Your credits were refunded."): translate the first, then the rest.
    const cut = msg.search(/[.!?] (?=\S)/);
    if (cut > 0) { const head = tm(msg.slice(0, cut + 1)), rest = tm(msg.slice(cut + 2)); if (head !== msg.slice(0, cut + 1) && rest !== msg.slice(cut + 2)) return `${head} ${rest}`; }
    return msg;
  };
  // A message from the server. One we have no words for is replaced by a general one, so a page in another
  // language never shows a stray English sentence.
  const sm = (msg) => { const out = tm(msg); return dict && out === msg && msg ? t("Something went wrong. Try again.") : out; };
  return { t, tm, sm };
}
