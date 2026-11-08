import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePollInput } from '../../server/lib/validation.js';
import { normalizeCode, randomCode } from '../../server/lib/crypto.js';

const valid = () => ({
  title: '  Prêmio   2026 ',
  categories: [{ title: 'Melhor', options: ['Ana', ' Bruno ', '', 'Carla'] }],
});

test('normaliza espaços e remove opções vazias', () => {
  const out = validatePollInput(valid());
  assert.equal(out.title, 'Prêmio 2026');
  assert.deepEqual(out.categories[0].options.map((o) => o.name), ['Ana', 'Bruno', 'Carla']);
  assert.ok(out.categories[0].options.every((o) => o.imageId === null));
});

test('alternativas com imagem: aceita id válido e descarta id malformado', () => {
  const out = validatePollInput({
    title: 'Teste',
    categories: [{ title: 'A', options: [{ name: 'X', imageId: 'abcDEF123_-abcdef12' }, { name: 'Y', imageId: '../../etc' }] }],
  });
  assert.deepEqual(out.categories[0].options, [{ name: 'X', imageId: 'abcDEF123_-abcdef12' }, { name: 'Y', imageId: null }]);
  assert.equal(out.accessMode, 'link');
  assert.equal(out.categories[0].allowBlank, true);
});

test('acumula erros por campo', () => {
  try {
    validatePollInput({ title: 'x', categories: [{ title: '', options: ['A'] }, { title: 'B', options: ['Ana', 'ana'] }] });
    assert.fail('deveria lançar');
  } catch (err) {
    assert.equal(err.status, 400);
    assert.ok(err.details.title);
    assert.ok(err.details['categories.0.title']);
    assert.ok(err.details['categories.0.options']);
    assert.match(err.details['categories.1.options'], /repetida/);
  }
});

test('recusa "Branco" como opção e categorias com nome duplicado', () => {
  assert.throws(() => validatePollInput({ title: 'Teste', categories: [{ title: 'A', options: ['X', 'Branco'] }] }), (e) => Boolean(e.details['categories.0.options']));
  assert.throws(() => validatePollInput({
    title: 'Teste', categories: [{ title: 'A', options: ['X', 'Y'] }, { title: 'a', options: ['X', 'Y'] }],
  }), (e) => Boolean(e.details['categories.1.title']));
});

test('códigos: formato XXXX-XXXX sem caracteres ambíguos; normalização tolerante', () => {
  for (let i = 0; i < 200; i++) assert.match(randomCode(), /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  assert.equal(normalizeCode(' abcd 2345 '), 'ABCD-2345');
  assert.equal(normalizeCode('abc'), null);
});
