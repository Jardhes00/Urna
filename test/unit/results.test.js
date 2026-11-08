import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSnapshot, computeCategoryResults, verifySnapshot } from '../../server/services/results.js';
import { sha256 } from '../../server/lib/crypto.js';

const category = (votes, blankVotes = 0, allowBlank = true) => ({
  id: 1, title: 'Cat', description: '', allowBlank, blankVotes,
  options: votes.map((v, i) => ({ id: i + 1, position: i, name: `Opção ${String.fromCharCode(65 + i)}`, votes: v })),
});

test('ranking simples: ordena por votos e calcula percentuais sobre válidos', () => {
  const r = computeCategoryResults(category([2, 5, 3], 2));
  assert.deepEqual(r.ranking.map((x) => [x.name, x.rank]), [['Opção B', 1], ['Opção C', 2], ['Opção A', 3]]);
  assert.equal(r.validVotes, 10);
  assert.equal(r.totalVotes, 12);
  assert.equal(r.ranking[0].share, 0.5);
  assert.equal(r.outcome, 'winner');
  assert.deepEqual(r.winners, ['Opção B']);
  assert.equal(r.blankShare, 2 / 12);
});

test('empate no 1º lugar: mesma posição, sem desempate, próxima posição salta (1,1,3)', () => {
  const r = computeCategoryResults(category([4, 4, 1, 0]));
  assert.deepEqual(r.ranking.map((x) => x.rank), [1, 1, 3, 4]);
  assert.equal(r.outcome, 'tie');
  assert.deepEqual(r.winners, ['Opção A', 'Opção B']);
  assert.ok(r.ranking[0].tied && r.ranking[1].tied);
  assert.ok(!r.ranking[2].tied);
});

test('empate no meio da tabela (1,2,2,4)', () => {
  const r = computeCategoryResults(category([1, 3, 3, 9]));
  assert.deepEqual(r.ranking.map((x) => [x.votes, x.rank, x.tied]), [[9, 1, false], [3, 2, true], [3, 2, true], [1, 4, false]]);
});

test('sem votos válidos: nenhum vencedor, mesmo com brancos', () => {
  const r = computeCategoryResults(category([0, 0], 3));
  assert.equal(r.outcome, 'no-votes');
  assert.deepEqual(r.winners, []);
  assert.equal(r.ranking[0].share, 0);
});

test('branco nunca entra no ranking, mesmo sendo a "opção" mais votada', () => {
  const r = computeCategoryResults(category([1, 0], 10));
  assert.equal(r.ranking.length, 2);
  assert.deepEqual(r.winners, ['Opção A']);
  assert.equal(r.ranking[0].share, 1);
});

test('snapshot: recusa contadores inconsistentes e detecta adulteração', () => {
  const poll = { publicId: 'x', title: 'T', description: '', accessMode: 'link', openedAt: null, ballotCount: 3 };
  assert.throws(() => buildSnapshot(poll, [category([1, 1])], new Date().toISOString()), /Inconsistência/);

  const { json, hash } = buildSnapshot(poll, [category([2, 1])], new Date().toISOString());
  assert.equal(verifySnapshot(json, hash).ok, true);
  assert.equal(verifySnapshot(json.replace('"votes":2', '"votes":3'), hash).ok, false);

  // Mesmo recalculando o hash, somas incoerentes são recusadas.
  const tampered = JSON.parse(json);
  tampered.categories[0].ranking[0].votes = 99;
  const tJson = JSON.stringify(tampered);
  assert.equal(verifySnapshot(tJson, sha256(tJson)).ok, false);
});
