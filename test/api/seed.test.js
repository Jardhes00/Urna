import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { adminClient, client, startServer } from '../helpers.js';
import { DEFAULT_IMAGE_FILES, DEFAULT_POLL, V1_POLL } from '../../server/db/seed.js';

const tempDb = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'urna-seed-'));
  return { dir, file: path.join(dir, 'urna.db') };
};
const env = { SEED_LEGACY_POLL: '1' };
const OLD_GENERIC = {
  title: DEFAULT_POLL.title,
  categories: Array.from({ length: 9 }, (_, i) => ({ title: `Categoria ${i + 1}`, options: ['Opção 1', 'Opção 2', 'Opção 3', 'Opção 4', 'Opção 5'] })),
};

test('urna pronta criada com a lista de seed.js; volta ao reiniciar e pelo botão depois de excluída', async () => {
  const { dir, file } = tempDb();
  let srv = await startServer({ file, env });
  let admin = await adminClient(srv.baseUrl);
  const { data: list } = await admin.get('/api/admin/polls');
  assert.equal(list.length, 1);
  assert.equal(list[0].status, 'draft');
  const { data: poll } = await admin.get(`/api/admin/polls/${list[0].id}`);
  assert.equal(poll.title, DEFAULT_POLL.title);
  assert.deepEqual(poll.categories.map((c) => c.title), DEFAULT_POLL.categories.map((c) => c.title));
  assert.deepEqual(poll.categories.map((c) => c.options.map((o) => o.name)), DEFAULT_POLL.categories.map((c) => c.options));

  // Imagens declaradas no seed.js são anexadas e servidas como PNG.
  const withImage = poll.categories.flatMap((c) => c.options).filter((o) => o.imageUrl);
  const declared = DEFAULT_IMAGE_FILES.reduce((n, files) => n + Object.keys(files).length, 0);
  assert.equal(withImage.length, declared);
  const img = await fetch(srv.baseUrl + withImage[0].imageUrl);
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('content-type'), 'image/png');
  await admin.del(`/api/admin/polls/${poll.id}`);
  await srv.stop();

  srv = await startServer({ file, env });
  admin = await adminClient(srv.baseUrl);
  const { data: again } = await admin.get('/api/admin/polls');
  assert.equal(again.length, 1, 'recriada ao reiniciar');
  assert.notEqual(again[0].publicId, poll.publicId);
  assert.equal(again[0].status, 'draft');

  // Sem reiniciar: o botão do painel recria na hora, com o conteúdo completo.
  await admin.del(`/api/admin/polls/${again[0].id}`);
  assert.equal((await admin.get('/api/admin/polls')).data.length, 0);
  const made = await admin.post('/api/admin/polls/from-model');
  assert.equal(made.status, 201);
  assert.deepEqual(made.data.categories.map((c) => c.options.map((o) => o.name)), DEFAULT_POLL.categories.map((c) => c.options));
  assert.equal((await client(srv.baseUrl).post('/api/admin/polls/from-model')).status, 401, 'exige login');
  await srv.stop();

  // O rascunho criado pelo botão passa a ser o acompanhado: reiniciar não cria outro.
  srv = await startServer({ file, env });
  admin = await adminClient(srv.baseUrl);
  assert.equal((await admin.get('/api/admin/polls')).data.length, 1, 'não duplica');
  await srv.stop();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('botão da urna pronta não cria duplicata; excluir uma de duas iguais não gera outra', async () => {
  const { dir, file } = tempDb();
  let srv = await startServer({ file, env });
  let admin = await adminClient(srv.baseUrl);
  const [urna] = (await admin.get('/api/admin/polls')).data;
  const again = await admin.post('/api/admin/polls/from-model');
  assert.equal(again.status, 201);
  assert.equal(again.data.id, urna.id, 'abre o rascunho existente');
  assert.equal((await admin.get('/api/admin/polls')).data.length, 1);

  // Editado pelo painel deixa de ser idêntico: aí o botão cria uma urna nova.
  await admin.put(`/api/admin/polls/${urna.id}`, { title: 'Minha versão', categories: [{ title: 'A', options: ['X', 'Y'] }] });
  const fresh = await admin.post('/api/admin/polls/from-model');
  assert.notEqual(fresh.data.id, urna.id);
  assert.equal((await admin.get('/api/admin/polls')).data.length, 2);

  // Caso real: duas iguais (dupla antiga). Excluir a acompanhada não pode recriar uma terceira.
  const { data: copy } = await admin.post(`/api/admin/polls/${fresh.data.id}/duplicate`);
  await admin.del(`/api/admin/polls/${fresh.data.id}`);
  await srv.stop();
  srv = await startServer({ file, env });
  admin = await adminClient(srv.baseUrl);
  const list = (await admin.get('/api/admin/polls')).data;
  assert.equal(list.length, 2, 'a cópia idêntica assume o lugar');
  assert.ok(list.some((p) => p.publicId === copy.publicId));
  await srv.stop();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('urna excluída volta mesmo que outra votação tenha reaproveitado o mesmo id', async () => {
  const { dir, file } = tempDb();
  let srv = await startServer({ file, env });
  let admin = await adminClient(srv.baseUrl);
  const [urna] = (await admin.get('/api/admin/polls')).data;
  await admin.del(`/api/admin/polls/${urna.id}`);
  const { data: other } = await admin.post('/api/admin/polls', { title: 'Outra votação', categories: [{ title: 'A', options: ['X', 'Y'] }] });
  assert.equal(other.id, urna.id, 'premissa: o banco reaproveitou o id');
  await srv.stop();

  srv = await startServer({ file, env });
  admin = await adminClient(srv.baseUrl);
  const { data: list } = await admin.get('/api/admin/polls');
  assert.equal(list.length, 2, 'urna pronta recriada ao lado da outra votação');
  assert.ok(list.some((p) => p.title === DEFAULT_POLL.title));
  assert.equal((await admin.get(`/api/admin/polls/${other.id}`)).data.title, 'Outra votação', 'a outra votação fica intacta');
  await srv.stop();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('versões antigas intactas da votação inicial são atualizadas; editadas pelo painel são preservadas', async () => {
  const { dir, file } = tempDb();
  let srv = await startServer({ file });
  let admin = await adminClient(srv.baseUrl);
  const v1 = (await admin.post('/api/admin/polls', V1_POLL)).data;
  const edited = V1_POLL.categories.map((c, i) => (i === 0 ? { ...c, options: ['Ana', ...c.options.slice(1)] } : c));
  const changed = (await admin.post('/api/admin/polls', { ...V1_POLL, categories: edited })).data;
  await srv.stop();

  srv = await startServer({ file, env });
  admin = await adminClient(srv.baseUrl);
  const a = (await admin.get(`/api/admin/polls/${v1.id}`)).data;
  const b = (await admin.get(`/api/admin/polls/${changed.id}`)).data;
  assert.deepEqual(a.categories.map((c) => c.title), DEFAULT_POLL.categories.map((c) => c.title), 'intacta → atualizada');
  assert.equal(b.categories.length, 8, 'editada pelo usuário → preservada');
  assert.equal((await admin.get('/api/admin/polls')).data.length, 2, 'nenhuma votação extra criada');
  await srv.stop();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('se a votação inicial já foi encerrada, mudanças em seed.js vão para uma cópia duplicada em rascunho', async () => {
  const { dir, file } = tempDb();
  let srv = await startServer({ file, env });
  let admin = await adminClient(srv.baseUrl);
  const [{ id }] = (await admin.get('/api/admin/polls')).data;
  await admin.put(`/api/admin/polls/${id}`, OLD_GENERIC);
  const shape = JSON.stringify({ title: OLD_GENERIC.title, categories: OLD_GENERIC.categories.map((c) => [c.title, c.options]) });
  srv.db.prepare("UPDATE app_state SET value = ? WHERE key = 'default_poll'").run(JSON.stringify({ pollId: id, shape }));
  await admin.post(`/api/admin/polls/${id}/open`);
  await admin.post(`/api/admin/polls/${id}/close`, { confirm: true });
  const { data: copy } = await admin.post(`/api/admin/polls/${id}/duplicate`);
  await srv.stop();

  srv = await startServer({ file, env });
  admin = await adminClient(srv.baseUrl);
  const updated = (await admin.get(`/api/admin/polls/${copy.id}`)).data;
  assert.deepEqual(updated.categories.map((c) => c.title), DEFAULT_POLL.categories.map((c) => c.title), 'cópia recebeu o seed.js');
  assert.ok(updated.categories.flatMap((c) => c.options).some((o) => o.imageUrl), 'com imagens');
  assert.equal((await admin.get(`/api/admin/polls/${id}`)).data.status, 'closed', 'encerrada intocada');
  await srv.stop();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('mudanças em seed.js chegam à votação em rascunho, mas não sobrescrevem edições do painel', async () => {
  const { dir, file } = tempDb();
  let srv = await startServer({ file, env });
  let admin = await adminClient(srv.baseUrl);
  const [{ id, publicId }] = (await admin.get('/api/admin/polls')).data;

  // Simula "seed.js anterior": votação e estado registrados com a lista genérica.
  await admin.put(`/api/admin/polls/${id}`, OLD_GENERIC);
  const shape = JSON.stringify({ title: OLD_GENERIC.title, categories: OLD_GENERIC.categories.map((c) => [c.title, c.options]) });
  srv.db.prepare("UPDATE app_state SET value = ? WHERE key = 'default_poll'").run(JSON.stringify({ pollId: id, publicId, shape }));
  await srv.stop();

  srv = await startServer({ file, env });
  admin = await adminClient(srv.baseUrl);
  let poll = (await admin.get(`/api/admin/polls/${id}`)).data;
  assert.deepEqual(poll.categories.map((c) => c.title), DEFAULT_POLL.categories.map((c) => c.title), 'seed.js novo aplicado');
  assert.equal(poll.publicId, publicId, 'atualizar pelo seed.js mantém o link');

  // Agora o admin edita pelo painel e o seed.js "muda" de novo: a edição do painel vence.
  await admin.put(`/api/admin/polls/${id}`, { ...OLD_GENERIC, title: 'Editada no painel' });
  srv.db.prepare("UPDATE app_state SET value = ? WHERE key = 'default_poll'").run(JSON.stringify({ pollId: id, shape }));
  await srv.stop();

  srv = await startServer({ file, env });
  admin = await adminClient(srv.baseUrl);
  poll = (await admin.get(`/api/admin/polls/${id}`)).data;
  assert.equal(poll.title, 'Editada no painel');
  await srv.stop();
  fs.rmSync(dir, { recursive: true, force: true });
});
