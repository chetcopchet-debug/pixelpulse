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
