import test from 'node:test';
import assert from 'node:assert/strict';
import { needsTranslation } from '../lib/promptLanguage.js';

const OTHER = {
  spanish: ['un gato negro en la playa al atardecer', 'retrato de una mujer con sombrero rojo', 'gato negro', 'una ciudad futurista de noche, luces de colores'],
  portuguese: ['um cachorro correndo na praia', 'retrato de uma mulher com flores no cabelo', 'uma cidade antiga com ruas de pedra', 'floresta com neblina'],
  french: ['un chien dans la neige', 'une ville la nuit sous la pluie', 'portrait d\'une femme avec un chapeau rouge', 'paysage de montagne au lever du soleil'],
  german: ['eine Katze im Schnee', 'ein altes Haus auf einem Berg bei Nacht', 'Portrait von einer Frau mit rotem Hut', 'Landschaft mit Wald und Nebel'],
  russian: ['рыжий кот на крыше под дождём', 'портрет девушки в красном платье'],
  arabic: ['قطة سوداء على الشاطئ عند الغروب', 'مدينة مستقبلية في الليل'],
  hindi: ['बर्फ में खेलता हुआ एक कुत्ता', 'लाल साड़ी में एक महिला का चित्र'],
  japanese: ['雪の中の赤い鳥居', '夕暮れの海辺を歩く猫'],
  korean: ['비 오는 밤의 네온 거리', '눈 덮인 산 위의 작은 집'],
  chinese: ['雨夜的霓虹街道', '一只在雪地里奔跑的狐狸'],
};
for (const [lang, prompts] of Object.entries(OTHER)) {
  test(`a ${lang} prompt is sent to the translator`, () => { for (const p of prompts) assert.equal(needsTranslation(p), true, p); });
}

test('English prompts are left alone, also when they contain words other languages use', () => {
  for (const p of [
    'a white van on a road at sunset', 'no people, empty street, fog', 'pour milk into a glass, studio light', 'a robot about to die in the rain',
    'la la land poster in the style of art deco', 'LA skyline at night, 4k', 'man in a den with a cat', 'portrait of a woman, 85mm, soft light',
    'cat', 'cyberpunk city, neon, rain, cinematic, 8k', 'a sin city style poster', 'the sun over a calm sea', 'AO render of a chair, MIT lab',
    'product photo of a sneaker on wet concrete', 'an astronaut riding a horse on mars', '',
  ]) assert.equal(needsTranslation(p), false, p);
});

test('text in another alphabet inside an English prompt still goes to the translator, which keeps quoted text', () => {
  assert.equal(needsTranslation('a neon sign that says "שלום"'), true);
});
