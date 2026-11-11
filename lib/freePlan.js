// Free credit rules (pure, unit tested in test/freePlan.test.mjs).
// Guest (not signed in): a one-time trial. Signed-in account: a daily allowance.
// Both also have a per-network daily ceiling, so clearing cookies or opening many accounts on one network gains little,
// while several real people on a shared network (one mobile carrier address, an office) each still get their own credits.
export const DAILY_CREDITS = 10;      // signed-in account, every UTC day
export const GUEST_TRIAL = 3;         // visitor without an account, once
export const GUEST_NET_DAILY = 9;     // trial credits one network may use per day (3 visitors)
export const ACCOUNT_NET_DAILY = 30;  // account credits one network may use per day (3 accounts)
export const FOREVER = '9999-12-31';

export function freePlan(signedIn) {
  return signedIn
    ? { guest: false, limit: DAILY_CREDITS, netLimit: ACCOUNT_NET_DAILY, ownKey: (uid) => `uid:${uid}`, netKey: (ip) => `ipacct:${ip}`, day: undefined }
    : { guest: true, limit: GUEST_TRIAL, netLimit: GUEST_NET_DAILY, ownKey: (uid) => `trial:${uid}`, netKey: (ip) => `iptrial:${ip}`, day: FOREVER };
}
// Credits still free for this identity, given what it and its network already used.
export const freeLeft = (plan, used, netUsed) => Math.max(0, Math.min(plan.limit - (Number(used) || 0), plan.netLimit - (Number(netUsed) || 0)));
