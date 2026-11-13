// The interface in several languages.
//
// How it works: the English text IS the key. Code says t("Add credits") and gets the text in the visitor's
// language, or the English itself when there is no translation. Values go in with braces:
// t("{n} credits", { n: 5 }).
//
// Adding text later: write it in English inside t("…") (or N("…") where a list is defined outside a component,
// and t(item) where it is shown), then run `node scripts/i18n.mjs`. It lists every text a language is missing;
// the test suite fails until each language file (app/i18n/<id>.js) has it.
import { createElement, Fragment } from "react";

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

// ---- in the browser: one language at a time ----
let cur = makeT(null);
let curLang = "en";
export const t = (key, vars) => cur.t(key, vars);
export const tm = (msg) => cur.tm(msg);
export const sm = (msg) => cur.sm(msg);
// Marks a text for translation where it is defined outside a component; it is translated where it is shown.
export const N = (s) => s;
export const lang = () => curLang;
export const langTag = () => (LANGS.find((l) => l.id === curLang) || LANGS[0]).tag;
export const num = (n) => Number(n).toLocaleString(langTag());
export function applyDict(id, dict) { curLang = isLang(id) ? id : "en"; cur = makeT(dict || null); }

const LOADERS = {
  es: () => import("./es.js"), pt: () => import("./pt.js"), fr: () => import("./fr.js"), de: () => import("./de.js"), it: () => import("./it.js"),
  ja: () => import("./ja.js"), ko: () => import("./ko.js"), zh: () => import("./zh.js"), id: () => import("./id.js"),
};
// Only the chosen language is downloaded.
export async function loadDict(id) { return LOADERS[id] ? (await LOADERS[id]()).default : null; }

// A sentence with a link or bold words inside: "See the <a>Refund policy</a>." The marked part is handed to
// tags.a (or tags.b, ...), so each language can put it where its grammar wants it.
export function rich(str, tags) {
  const out = [];
  const re = /<(\w+)>(.*?)<\/\1>/g;
  let i = 0, m;
  while ((m = re.exec(str))) {
    if (m.index > i) out.push(str.slice(i, m.index));
    out.push(createElement(Fragment, { key: out.length }, tags[m[1]] ? tags[m[1]](m[2]) : m[2]));
    i = m.index + m[0].length;
  }
  if (i < str.length) out.push(str.slice(i));
  return out;
}
