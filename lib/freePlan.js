// Free credit rules (pure, unit tested in test/freePlan.test.mjs).
// A visitor without an account gets nothing free and cannot create (lib/needAccount.js stops the request first).
// A signed-in account gets a daily allowance, with a per-network daily ceiling so opening many accounts on one
// network gains little, while several real people on a shared network (one mobile carrier address, an office)
// each still get their own credits.
export const DAILY_CREDITS = 10;      // signed-in account, every UTC day
export const GUEST_TRIAL = 0;         // no free creations without an account
export const ACCOUNT_NET_DAILY = 30;  // account credits one network may use per day (3 accounts)
export const FOREVER = '9999-12-31';

export function freePlan(signedIn) {
  return signedIn
    ? { guest: false, limit: DAILY_CREDITS, netLimit: ACCOUNT_NET_DAILY, ownKey: (uid) => `uid:${uid}`, netKey: (ip) => `ipacct:${ip}`, day: undefined }
    : { guest: true, limit: GUEST_TRIAL, netLimit: 0, ownKey: (uid) => `trial:${uid}`, netKey: (ip) => `iptrial:${ip}`, day: FOREVER };
}
// Credits still free for this identity, given what it and its network already used.
// Counters are clamped at zero first: a refund can push a counter below zero, and that must never turn into extra credits.
const spent = (n) => Math.max(0, Number(n) || 0);
export const freeLeft = (plan, used, netUsed) => Math.max(0, Math.min(plan.limit - spent(used), plan.netLimit - spent(netUsed)));
