// How to read Replicate's answer to a run request. No dependencies, so it is shared and tested on its own.

// Does this answer to "start a run" mean the model is gone for good?
export function isDiscontinued(status, body) {
  const text = `${body?.title || ''} ${body?.detail || ''} ${typeof body?.error === 'string' ? body.error : ''}`;
  if (status === 404) return true; // Replicate has no model by this name any more
  return status === 422 && /version disabled|currently disabled|discontinued|deprecated|no longer (available|supported)|retired/i.test(text);
}
// What an answer says about a model: 'dead' | 'alive' | 'limited' (asked too fast) | 'unknown'.
export function readAnswer(status, body) {
  if (isDiscontinued(status, body)) return 'dead';
  if (status === 201 || status === 200) return 'alive';                 // Replicate took the request
  if (status === 422) return 'alive';                                   // it looked at the input and refused it: the model is there
  if (status === 429) return 'limited';
  return 'unknown';
}
// An input that can never produce anything: no prompt, and every other value replaced by one the model rejects.
export function refusedInput(sample) {
  const out = { __check__: '__check__' };
  for (const [k, v] of Object.entries(sample || {})) {
    if (k === 'prompt') continue;
    out[k] = typeof v === 'string' ? '__check__' : typeof v === 'number' ? -987 : v;
  }
  return out;
}
