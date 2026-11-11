import test from 'node:test';
import assert from 'node:assert/strict';
import { freePlan, freeLeft, GUEST_TRIAL, DAILY_CREDITS, FOREVER } from '../lib/freePlan.js';

test('a guest gets a one-time trial, an account gets a daily allowance', () => {
  const g = freePlan(false), a = freePlan(true);
  assert.equal(g.guest, true); assert.equal(g.limit, GUEST_TRIAL); assert.equal(g.day, FOREVER);
  assert.equal(a.guest, false); assert.equal(a.limit, DAILY_CREDITS); assert.equal(a.day, undefined);
});
test('trial and account credits are counted separately, per identity and per network', () => {
  const g = freePlan(false), a = freePlan(true);
  assert.notEqual(g.ownKey('u1'), a.ownKey('u1'));
  assert.notEqual(g.netKey('1.2.3.4'), a.netKey('1.2.3.4'));
  assert.notEqual(g.ownKey('u1'), g.ownKey('u2'));
});
test('what is left: own limit first, then the network ceiling, never below zero', () => {
  const g = freePlan(false);
  assert.equal(freeLeft(g, 0, 0), 3);
  assert.equal(freeLeft(g, 2, 0), 1);
  assert.equal(freeLeft(g, 3, 0), 0);
  assert.equal(freeLeft(g, 0, 8), 1);   // network almost used up by other visitors
  assert.equal(freeLeft(g, 0, 99), 0);
  assert.equal(freeLeft(g, null, undefined), 3);
  const a = freePlan(true);
  assert.equal(freeLeft(a, 4, 0), 6);
  assert.equal(freeLeft(a, 0, 25), 5);
});
test('a network of three visitors can each finish the trial', () => {
  const g = freePlan(false);
  assert.ok(g.netLimit >= g.limit * 3);
});
