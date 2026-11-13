import test from 'node:test';
import assert from 'node:assert/strict';
import { doorExists, doorOpens, TEST_EMAIL } from '../lib/testDoor.js';

const secret = 'x'.repeat(40);

test('the test door exists only on a preview build that has the secret', () => {
  assert.equal(doorExists({ VERCEL_ENV: 'preview', TEST_LOGIN_SECRET: secret }), true);
  assert.equal(doorExists({ VERCEL_ENV: 'production', TEST_LOGIN_SECRET: secret }), false); // the real site, even if the secret leaked into it
  assert.equal(doorExists({ VERCEL_ENV: 'development', TEST_LOGIN_SECRET: secret }), false);
  assert.equal(doorExists({ TEST_LOGIN_SECRET: secret }), false); // not on Vercel at all
  assert.equal(doorExists({ VERCEL_ENV: 'preview' }), false); // a preview without the secret
  assert.equal(doorExists({ VERCEL_ENV: 'preview', TEST_LOGIN_SECRET: 'short' }), false); // a weak secret opens nothing
});

test('only the exact secret opens it', () => {
  const env = { VERCEL_ENV: 'preview', TEST_LOGIN_SECRET: secret };
  assert.equal(doorOpens(env, secret), true);
  assert.equal(doorOpens(env, secret + 'x'), false);
  assert.equal(doorOpens(env, secret.slice(1)), false);
  assert.equal(doorOpens(env, ''), false);
  assert.equal(doorOpens(env, null), false);
  assert.equal(doorOpens(env, undefined), false);
  assert.equal(doorOpens({ VERCEL_ENV: 'production', TEST_LOGIN_SECRET: secret }, secret), false);
});

test('the test account cannot be reached by a sign-in email', () => {
  assert.match(TEST_EMAIL, /@example\.com$/); // a reserved address: mail to it goes nowhere
});
