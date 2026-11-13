// The interface in several languages.
//
// How it works: the English text IS the key. Code says t("Add credits") and gets the text in the visitor's
// language, or the English itself when there is no translation. Values go in with braces:
// t("{n} credits", { n: 5 }).
//
// Adding text later: write it in English inside t("…") (or N("…") where a list is defined outside a component,
// and t(item) where it is shown), then run `node scripts/i18n.mjs`. It lists every text a language is missing;
// the test suite fails until each language file (app/i18n/<id>.js) has it.

import { LANGS, isLang, makeT } from "./core.js";
export { LANGS, LANG_COOKIE, isLang, pickLang, makeT } from "./core.js";

// ---- in the browser: one language at a time ----
let cur = makeT(null);
let curLang = "en";
export const t = (key, vars) => cur.t(key, vars);
export const tm = (msg) => cur.tm(msg);
export const sm = (msg) => cur.sm(msg);
// One of something has its own words ("1 credit", not "1 credits"): the first text is used when vars.n is one.
// Mark both with N("…") so every language gets them.
export const tn = (one, many, vars) => t(Number(vars && vars.n) === 1 ? one : many, vars);
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
