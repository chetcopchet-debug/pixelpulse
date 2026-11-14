import test from 'node:test';
import assert from 'node:assert/strict';
import { shortTitle } from '../lib/title.js';

test('a short name comes from the subject of the prompt', () => {
  const structured = (subjects) => `Scene: A small fishing harbor at dawn, wooden boats.\nSubjects: ${subjects}\nAction: He looks past the camera.`;
  assert.equal(shortTitle(structured('An elderly fisherman in his seventies with a weathered face.')), 'Elderly fisherman');
  assert.equal(shortTitle(structured('A red fox with a thick orange winter coat, white chest and amber eyes.')), 'Red fox');
  assert.equal(shortTitle(structured('A tall white stone lighthouse with a glowing lantern room.')), 'Tall white stone lighthouse');
  assert.equal(shortTitle(structured('A herd of wild horses, bay, black and white, with flowing manes.')), 'Herd of wild horses');
  assert.equal(shortTitle(structured('Vivid green and violet northern lights in tall curtains, a sky full of stars.')), 'Vivid green and violet northern lights');
  assert.equal(shortTitle(structured('A female martial artist in her twenties with a tight black ponytail.')), 'Female martial artist');
  assert.equal(shortTitle(structured('An elegant rectangular glass perfume bottle with amber liquid.')), 'Elegant rectangular glass perfume bottle');
});
test('a plain prompt gives its first words, and never "Scene:"', () => {
  assert.equal(shortTitle('a cozy cabin in the snow'), 'Cozy cabin');
  assert.equal(shortTitle('Scene: A quiet room beside a tall window.'), 'Quiet room');
  assert.equal(shortTitle(''), '');
  assert.equal(shortTitle('חתול כתום על גדר'), 'חתול כתום על גדר');
  assert.ok(!/^scene/i.test(shortTitle('Scene: An alien desert of deep red dunes under a dusky violet sky.\nSubjects: A lone astronaut in a white suit.')));
  assert.ok(shortTitle('a very long prompt that goes on and on about many different things without any comma or stop word at all here').length <= 40);
});
