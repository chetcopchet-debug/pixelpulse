import test from 'node:test';
import assert from 'node:assert/strict';
import { freePlan, freeLeft, GUEST_TRIAL, DAILY_CREDITS } from '../lib/freePlan.js';

test('a visitor without an account gets nothing free; an account gets a daily allowance', () => {
  const g = freePlan(false), a = freePlan(true);
  assert.equal(GUEST_TRIAL, 0);
  assert.equal(g.guest, true); assert.equal(g.limit, 0);
  assert.equal(a.guest, false); assert.equal(a.limit, DAILY_CREDITS); assert.equal(a.day, undefined);
});
test('a guest never has free credits, whatever the counters say', () => {
  const g = freePlan(false);
  assert.equal(freeLeft(g, 0, 0), 0);
  assert.equal(freeLeft(g, null, undefined), 0);
  assert.equal(freeLeft(g, -5, -5), 0, 'not even after refunds to an old trial counter');
});
test('guest and account counters never share a key', () => {
  const g = freePlan(false), a = freePlan(true);
  assert.notEqual(g.ownKey('u1'), a.ownKey('u1'));
  assert.notEqual(g.netKey('1.2.3.4'), a.netKey('1.2.3.4'));
});
test('what an account has left: own limit first, then the network ceiling, never below zero', () => {
  const a = freePlan(true);
  assert.equal(freeLeft(a, 0, 0), 10);
  assert.equal(freeLeft(a, 4, 0), 6);
  assert.equal(freeLeft(a, 10, 0), 0);
  assert.equal(freeLeft(a, 0, 25), 5);   // network almost used up by other accounts
  assert.equal(freeLeft(a, 0, 99), 0);
});
test('three accounts on one network can each use their full day', () => {
  const a = freePlan(true);
  assert.ok(a.netLimit >= a.limit * 3);
});
