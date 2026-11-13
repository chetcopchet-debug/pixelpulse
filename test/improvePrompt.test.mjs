// "Improve my prompt": which texts count as a short idea.
import test from 'node:test';
import assert from 'node:assert/strict';
import { shortIdea } from '../lib/promptLanguage.js';

test('a short idea is filled in; a prompt already written out in full is left alone', () => {
  assert.equal(shortIdea('a cat on a roof'), true);
  assert.equal(shortIdea('חתול על גג'), true);
  assert.equal(shortIdea(''), false);
  assert.equal(shortIdea('   '), false);
  assert.equal(shortIdea(Array(31).fill('word').join(' ')), false); // more than 30 words
  assert.equal(shortIdea('猫'.repeat(221)), false); // no spaces, but long
});
