// Request time budget. Vercel stops a function at maxDuration (60s) without running any cleanup, so every slow step
// takes only what is left and the request finishes (refund included) before the platform kills it.
export const REQUEST_BUDGET_MS = 50_000; // 10s headroom under maxDuration = 60

export function makeDeadline(totalMs = REQUEST_BUDGET_MS, now = Date.now) {
  const end = now() + totalMs;
  const left = () => Math.max(0, end - now());
  // Time for one step: at most `max`, keeping `reserve` ms for the steps after it. 0 = no time, skip the step.
  const budget = (max, reserve = 0) => Math.max(0, Math.min(max, left() - reserve));
  return { end, left, budget };
}

// Seconds for Replicate's "Prefer: wait=N" header (1..60).
export const preferWait = (ms) => Math.max(1, Math.min(60, Math.floor(ms / 1000)));

// Run a refund at most once (both the error path and the finally safety net may call it).
export function once(fn) {
  let done = false;
  return async (...a) => { if (done) return; done = true; await fn(...a); };
}
