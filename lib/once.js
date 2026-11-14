// One press, one creation.
// The screen gives every press of Generate its own id (`rid`) and sends it with the request. The first request
// with an id goes ahead. Another one with the same id is turned down before anything is charged: a double tap
// that got past the button, or a browser or network that sent the same request twice.
// A request without an id (a page loaded before this existed) is treated as before.

export const DUPLICATE_MSG = 'This one is already being made.';
export const validRid = (rid) => (typeof rid === 'string' && /^[A-Za-z0-9._-]{6,80}$/.test(rid) ? rid : null);
// true the first time this creator sends this id (today), false after that. `claim` is the counter: bump() of
// lib/usage.js, given by the caller.
export async function firstTime(creatorId, rid, claim) {
  const id = validRid(rid);
  if (!id || !creatorId) return true;
  try { return (await claim(`once:${creatorId}:${id}`, 1, 1)) !== null; }
  catch { return true; } // the counter is out of reach: do not stop a real creation because of it
}
