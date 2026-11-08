import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUIPS, deck, pickEmojis } from '../../public/js/shared/quips.js';

test('baralho não repete uma referência antes de usar todas', () => {
  const next = deck(QUIPS.general);
  const drawn = QUIPS.general.map(() => next());
  assert.equal(new Set(drawn).size, QUIPS.general.length);
  assert.ok(QUIPS.general.includes(next()), 'recomeça depois de acabar');
});

test('a ordem é sorteada', () => {
  const order = () => { const next = deck(QUIPS.general); return QUIPS.general.map(() => next().text).join('|'); };
  assert.ok(new Set(Array.from({ length: 8 }, order)).size > 1);
});

test('todas as referências têm emoji, texto e origem', () => {
  const all = Object.values(QUIPS).flat();
  assert.ok(all.length > 30);
  for (const quip of all) assert.ok(quip.emoji && quip.text && quip.source, JSON.stringify(quip));
});

test('figurinhas sem emoji repetido', () => {
  const emojis = pickEmojis(8);
  assert.equal(emojis.length, 8);
  assert.equal(new Set(emojis).size, 8);
});
