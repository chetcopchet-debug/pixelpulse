// Is this prompt written in English? Pure and unit tested (test/promptLanguage.test.mjs).
// The models read English best, so a prompt in any other language is translated first. Finding out must be
// instant and free, because most prompts are English and must not wait for a translator:
//  - any letter outside the Latin alphabet (Cyrillic, Arabic, Devanagari, Chinese, Japanese, Korean, ...) settles it;
//  - so does an accented Latin letter;
//  - otherwise the words decide: small, very common words of other Latin-alphabet languages against the small
//    words of English. Words that exist in English too ("die", "van", "no", "pour") are not counted for anyone.
export const NON_LATIN = /[Ͱ-ϿЀ-ԯ԰-֏֐-׿؀-ۿݐ-ݿऀ-෿฀-๿Ⴀ-ჿ぀-ヿ㐀-鿿가-힯豈-﫿]/;
const LATIN_ACCENT = /[À-ÖØ-öø-ÿĀ-žƠ-ưȘ-țẞ]/;
export const QUOTED = /"([^"]+)"|“([^”]+)”|«([^»]+)»|״([^״]+)״|„([^“”]+)[“”]/g;

const set = (s) => new Set(s.trim().split(/\s+/));
const ENGLISH = set('the of and with for from by is are it this that these those into over under near very at to in on a an as but or not his her its their while behind above below through');
// Small words: articles, prepositions, conjunctions.
const SMALL = set(`
  el la los las del al y con una un unos unas por para que muy es en su sus como sobre entre pero este esta
  um uma com em os dos da das na nos nas ao aos pelo pela sem seu sua muito
  le les et avec une du au aux dans est sur sous ce cette ces qui chez tres
  der das und mit ein eine einen einem einer im ist auf von zum zur bei nach aus dem sehr ohne
  il gli di che della dello nel nella sono lo dei delle tra molto senza
  het een voor naar
  bir ve ile
  och att ett`);
// A few everyday things people ask pictures of, for short prompts that have no small words at all.
const THINGS = set(`
  gato perro mujer hombre playa ciudad noche rojo blanco casa bosque cielo flor coche calle luna lluvia nieve fuego agua retrato paisaje
  cachorro mulher homem praia cidade noite vermelho preto branco floresta montanha retrato paisagem chuva lua
  chien femme homme maison plage ville nuit rouge bleu noir blanc montagne soleil ciel fleur paysage pluie neige
  katze hund frau mann haus stadt nacht wald berg blau schwarz sonne meer himmel blume landschaft regen schnee
  gatto donna uomo notte rosso nero bianco bosco montagna cielo fiore spiaggia ritratto paesaggio pioggia`);

export function needsTranslation(text) {
  const t = String(text || '');
  if (NON_LATIN.test(t)) return true;
  if (LATIN_ACCENT.test(t)) return true;
  // Words in capitals (LA, IT, AO, MIT) are names and abbreviations, not small words.
  const words = (t.match(/[A-Za-z]+/g) || []).filter((w) => !(w.length > 1 && w === w.toUpperCase())).map((w) => w.toLowerCase());
  if (!words.length) return false;
  let other = 0, english = 0;
  for (const w of words) { if (SMALL.has(w) || THINGS.has(w)) other += 1; else if (ENGLISH.has(w)) english += 1; }
  if (!other) return false;
  return other >= 2 ? other >= english : english === 0 && words.length <= 8;
}
export const quotedParts = (t) => [...String(t).matchAll(QUOTED)].map((m) => m.slice(1).find(Boolean)).filter(Boolean);

// A short idea ("a cat on a roof") is worth filling in; a prompt someone already wrote out in full is theirs to keep.
const IMPROVE_MAX_WORDS = 30, IMPROVE_MAX_CHARS = 220;
export function shortIdea(text) {
  const t = String(text || '').trim();
  return Boolean(t) && t.length <= IMPROVE_MAX_CHARS && t.split(/\s+/).length <= IMPROVE_MAX_WORDS;
}
