// For pages the server draws (prices, contact, not found): the visitor's language comes from the cookie the
// language picker sets, or from what the browser asks for. Each request gets its own translator.
import { cookies, headers } from "next/headers";
import { LANGS, LANG_COOKIE, isLang, pickLang, makeT } from "./index.js";
import es from "./es.js"; import pt from "./pt.js"; import fr from "./fr.js"; import de from "./de.js"; import it from "./it.js";
import ja from "./ja.js"; import ko from "./ko.js"; import zh from "./zh.js"; import id from "./id.js";

const DICTS = { es, pt, fr, de, it, ja, ko, zh, id };

export async function serverLang() {
  const c = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLang(c)) return c;
  const asked = ((await headers()).get("accept-language") || "").split(",").map((x) => x.split(";")[0]);
  return pickLang(asked);
}
export async function getT() {
  const lang = await serverLang();
  const { t, tm } = makeT(DICTS[lang] || null);
  const tag = (LANGS.find((l) => l.id === lang) || LANGS[0]).tag;
  return { t, tm, lang, tag, num: (n) => Number(n).toLocaleString(tag) };
}
