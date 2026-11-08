import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { adminClient, ballot, client, samplePoll, startServer, voterKey } from '../helpers.js';

test('votos persistem no arquivo do banco após reiniciar o servidor', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'urna-'));
  const file = path.join(dir, 'urna.db');

  let srv = await startServer({ file });
  let admin = await adminClient(srv.baseUrl);
  const { data: poll } = await admin.post('/api/admin/polls', samplePoll());
  await admin.post(`/api/admin/polls/${poll.id}/open`);
  const anon = client(srv.baseUrl);
  const { data: view } = await anon.get(`/api/public/polls/${poll.publicId}`);
  for (let i = 0; i < 3; i++) {
    await anon.post(`/api/public/polls/${poll.publicId}/ballots`, { voterKey: voterKey(i), choices: ballot(view, [i, 0]) });
  }
  await srv.stop();

  srv = await startServer({ file });
  admin = await adminClient(srv.baseUrl);
  const { data } = await admin.get(`/api/admin/polls/${poll.id}`);
  assert.equal(data.ballotCount, 3);
  assert.equal(data.status, 'open');
  // A participação também persiste: a mesma chave continua bloqueada.
  const again = await client(srv.baseUrl).post(`/api/public/polls/${poll.publicId}/ballots`, { voterKey: voterKey(0), choices: ballot(view, [0, 0]) });
  assert.equal(again.status, 409);
  await srv.stop();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('banco não guarda vínculo entre participação e voto', async () => {
  const srv = await startServer();
  const admin = await adminClient(srv.baseUrl);
  const { data: poll } = await admin.post('/api/admin/polls', samplePoll());
  await admin.post(`/api/admin/polls/${poll.id}/open`);
  const anon = client(srv.baseUrl);
  const { data: view } = await anon.get(`/api/public/polls/${poll.publicId}`);
  await anon.post(`/api/public/polls/${poll.publicId}/ballots`, { voterKey: voterKey(1), choices: ballot(view, [0, 0]) });

  const cols = srv.db.prepare('PRAGMA table_info(participations)').all().map((c) => c.name);
  assert.deepEqual(cols.sort(), ['poll_id', 'voter_hash'], 'participação: só votação + hash, sem horário nem escolha');
  const row = srv.db.prepare('SELECT voter_hash FROM participations').get();
  assert.match(row.voter_hash, /^[0-9a-f]{64}$/);
  assert.notEqual(row.voter_hash, voterKey(1), 'a chave do navegador não é armazenada em claro');
  const tables = srv.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((t) => t.name);
  assert.ok(!tables.some((t) => /ballot|vote_record/i.test(t)), 'não existe tabela de cédulas individuais');
  await srv.stop();
});

test('limite de requisições responde 429 (e não bloqueia por IP de forma permanente)', async () => {
  const srv = await startServer({ env: { LOGIN_RATE_LIMIT: '3' } });
  const c = client(srv.baseUrl);
  const statuses = [];
  for (let i = 0; i < 5; i++) statuses.push((await c.post('/api/auth/login', { password: 'x' })).status);
  assert.deepEqual(statuses, [401, 401, 401, 429, 429]);
  await srv.stop();
});
