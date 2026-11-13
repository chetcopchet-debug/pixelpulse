// The test door: a way to sign in as one fixed test account, for checking a preview build as a signed-in
// person without an email. It has two locks, and both must hold:
//   1. Vercel says this build is a preview (never the real site), and
//   2. the caller sends the secret kept in Vercel as TEST_LOGIN_SECRET, which is saved for the `preview`
//      branch only, so the real site does not even have it.
// Anywhere else the door answers "not found", exactly like an address that does not exist.
import crypto from 'crypto';

// Nobody receives mail at example.com, so this account cannot be entered through the normal sign-in email.
export const TEST_EMAIL = 'preview-test@example.com';

export function doorExists(env) {
  return env.VERCEL_ENV === 'preview' && typeof env.TEST_LOGIN_SECRET === 'string' && env.TEST_LOGIN_SECRET.length >= 32;
}
export function doorOpens(env, given) {
  if (!doorExists(env) || typeof given !== 'string' || !given) return false;
  const a = crypto.createHash('sha256').update(given).digest(), b = crypto.createHash('sha256').update(env.TEST_LOGIN_SECRET).digest();
  return crypto.timingSafeEqual(a, b);
}
