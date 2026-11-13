// Preview builds only: ask Replicate whether every model we offer exists and accepts the inputs we send
// (lib/modelCheck.js), and print the result in the build log. Nothing is generated, nothing is charged.
// Whether a model still RUNS is a separate question (lib/modelHealth.js): /admin and a daily job ask that.
// Never fails the build.
if (process.env.VERCEL_ENV === 'preview' && process.env.REPLICATE_API_TOKEN) {
  try {
    const { liveCheck } = await import('../lib/modelCheck.js');
    const rows = await liveCheck();
    const bad = rows.filter((r) => r.ok !== true);
    console.log(`[models] ${rows.length} checked against Replicate, ${rows.length - bad.length} fine, ${bad.length} with a problem; ${rows.reduce((n, r) => n + r.inputs.length, 0)} inputs tried`);
    for (const r of bad) console.log(`[models] PROBLEM ${r.slug}: ${r.problems.join(' | ')}`);
  } catch (e) { console.log('[models] check skipped:', e?.message || e); }
}

// TEMPORARY (removed in the next commit): one real translation in each of ten languages, printed in the build log.
if (process.env.VERCEL_ENV === 'preview' && process.env.REPLICATE_API_TOKEN) {
  try {
    const { needsTranslation, NON_LATIN, QUOTED } = await import('../lib/promptLanguage.js');
    const system = 'You translate prompts for an AI image generator into precise, descriptive English. '
      + 'Keep every detail, subject, style, color, number and composition instruction; do not add new ideas. '
      + 'If the prompt is already English, return it unchanged. Output only the English prompt, no notes.';
    const ask = async (model, text) => {
      const res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`, 'Content-Type': 'application/json', Prefer: 'wait=5' }, body: JSON.stringify({ input: { system_prompt: system, prompt: text } }) });
      const p = await res.json().catch(() => ({}));
      if (res.status === 429) return { limited: (Number(p.retry_after) || 9) + 1 };
      if (!res.ok || p.status !== 'succeeded') return { fail: `${res.status} ${p.status || ''}` };
      return { out: (Array.isArray(p.output) ? p.output.join('') : String(p.output || '')).trim() };
    };
    const SAMPLES = [
      ['es', 'un gato negro durmiendo en un tejado al atardecer, estilo acuarela'], ['pt', 'uma raposa correndo na neve, luz da manhã, fotografia realista'],
      ['fr', 'une vieille librairie sous la pluie, lumière chaude aux fenêtres'], ['de', 'ein Leuchtturm im Sturm, dramatische Wolken, Ölgemälde'],
      ['ru', 'рыжий кот на подоконнике смотрит на снегопад'], ['ar', 'جمل يسير في الصحراء تحت سماء مليئة بالنجوم'],
      ['hi', 'बारिश में छाता लिए एक बच्ची, रंगीन सड़क, एनीमे शैली'], ['ja', '夕暮れの海辺を歩く白い犬、水彩画風'],
      ['ko', '비 오는 밤의 네온 거리, 우산을 쓴 사람'], ['zh', '雪山下的一座小木屋，清晨的阳光，写实摄影'],
    ];
    for (const [lang, text] of SAMPLES) {
      const t0 = Date.now(); let line = `[translate] ${lang} detect=${needsTranslation(text)}`;
      for (const model of ['openai/gpt-5-nano', 'anthropic/claude-4.5-haiku']) {
        let r = await ask(model, text);
        if (r.limited) { await new Promise((ok) => setTimeout(ok, r.limited * 1000)); r = await ask(model, text); }
        if (r.out && !NON_LATIN.test(r.out.replace(QUOTED, ''))) { line += ` model=${model} ms=${Date.now() - t0} -> ${r.out.slice(0, 150)}`; break; }
        line += ` (${model}: ${r.out ? 'answer not English' : r.fail || 'limited'})`;
      }
      console.log(line);
      await new Promise((ok) => setTimeout(ok, 10500));
    }
  } catch (e) { console.log('[translate] check skipped:', e?.message || e); }
}
