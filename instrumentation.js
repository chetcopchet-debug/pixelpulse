// Runs once when a server instance starts. Everything the code already reports with console.error is also
// counted (lib/errorLog.js), so /admin can show what went wrong today without reading logs, which are kept for
// only an hour. A request that crashes outright is counted too.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || globalThis.__ppErrors) return;
  globalThis.__ppErrors = true;
  const { noteError, textOf } = await import('./lib/errorLog.js');
  const original = console.error.bind(console);
  console.error = (...args) => {
    original(...args);
    try { noteError('server', textOf(args)); } catch { /* counting must never break the thing being reported */ }
  };
}

export async function onRequestError(err, request) {
  try {
    const { noteError } = await import('./lib/errorLog.js');
    noteError('crash', `${String(request?.path || '').split('?')[0]} ${err?.message || err}`);
  } catch { /* nothing to do */ }
}
