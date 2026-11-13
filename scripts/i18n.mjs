// Lists every text of the interface and checks that each language has it.
//   node scripts/i18n.mjs          what each language is missing, and what it has that is no longer used
//   node scripts/i18n.mjs --keys   the English texts, one JSON list
// Texts are found where the code marks them: t("…"), N("…") and rich(t("…")), plus the model descriptions in
// lib/catalog.js. See app/i18n/index.js for how to add text.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LANG_IDS = ['es', 'pt', 'fr', 'de', 'it', 'ja', 'ko', 'zh', 'id'];
const files = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? (/(^|\/)(admin|api)$/.test(p) ? [] : files(p)) : /\.js$/.test(n) ? [p] : []; });
const MARK = /(?<![\w.$])(?:t|N)\(\s*("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\$]|\\.)*`)/g;

export async function collectKeys() {
  const keys = new Set();
  for (const f of files(join(root, 'app'))) {
    if (/app\/i18n\/(es|pt|fr|de|it|ja|ko|zh|id)\.js$/.test(f)) continue;
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(MARK)) { try { keys.add(Function(`return ${m[1]}`)()); } catch { /* not a plain text */ } }
  }
  const cat = await import(pathToFileURL(join(root, 'lib/catalog.js')).href);
  for (const m of [...cat.IMAGE_MODELS, ...cat.VIDEO_MODELS]) keys.add(m.desc);
  return [...keys].filter((k) => /\p{L}/u.test(k)).sort();
}
export async function loadDicts() {
  const out = {};
  for (const id of LANG_IDS) out[id] = (await import(pathToFileURL(join(root, `app/i18n/${id}.js`)).href)).default;
  return out;
}
const braces = (s) => (s.match(/\{\w+\}/g) || []).sort().join(' ');
const tags = (s) => (s.match(/<\/?\w+>/g) || []).sort().join(' ');
// What is wrong with each language: texts it lacks, texts whose {values} or <marks> differ from the English.
export async function problems() {
  const keys = await collectKeys(), dicts = await loadDicts(), out = {};
  for (const [id, d] of Object.entries(dicts)) {
    out[id] = {
      missing: keys.filter((k) => !d[k]),
      broken: keys.filter((k) => d[k] && (braces(d[k]) !== braces(k) || tags(d[k]) !== tags(k))),
      unused: Object.keys(d).filter((k) => !keys.includes(k)),
    };
  }
  return { keys, out };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--keys')) console.log(JSON.stringify(await collectKeys(), null, 0));
  else {
    const { keys, out } = await problems();
    console.log(`${keys.length} texts`);
    let bad = 0;
    for (const [id, p] of Object.entries(out)) {
      bad += p.missing.length + p.broken.length;
      console.log(`${id}: ${p.missing.length} missing, ${p.broken.length} with different values, ${p.unused.length} no longer used`);
      for (const k of p.missing) console.log(`  missing: ${JSON.stringify(k)}`);
      for (const k of p.broken) console.log(`  values differ: ${JSON.stringify(k)}`);
    }
    process.exit(bad ? 1 : 0);
  }
}
