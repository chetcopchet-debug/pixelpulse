// Sign-in links must come back to the address the visitor is on (so previews work), but only to our own hosts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { returnOrigin, SITE_URL } from '../lib/site.js';

const from = (url) => returnOrigin({ url });

test('a preview deployment returns to itself', () => {
  assert.equal(from('https://pixelpulse-git-ui-new-interface-caissa3.vercel.app/api/auth/start'), 'https://pixelpulse-git-ui-new-interface-caissa3.vercel.app');
});
test('the live site returns to the live site', () => {
  assert.equal(from(`${SITE_URL}/api/auth/google`), new URL(SITE_URL).origin);
});
test('local development returns to localhost', () => {
  assert.equal(from('http://localhost:3000/api/auth/start'), 'http://localhost:3000');
});
test('anything else falls back to the live site', () => {
  assert.equal(from('https://evil.example.com/api/auth/start'), SITE_URL);
  assert.equal(from('http://something.vercel.app/api/auth/start'), SITE_URL); // not https
  assert.equal(from('not a url'), SITE_URL);
});
