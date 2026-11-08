import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import { adminClient, ballot, client, samplePoll, startServer, voterKey } from '../helpers.js';
import { SEED_IMAGES_DIR } from '../../server/db/seed.js';

const PNG = fs.readFileSync(path.join(SEED_IMAGES_DIR, 'bebida-cerveja.png'));
let srv;
let admin;
before(async () => {
  srv = await startServer();
  admin = await adminClient(srv.baseUrl);
});
after(() => srv.stop());

const upload = (pollId, body, type = 'image/png') => admin.post(`/api/admin/polls/${pollId}/images`, body, { 'content-type': type });

test('envio de imagem: aceita PNG real, recusa SVG, texto disfarçado e envio sem login', async () => {
  const { data: poll } = await admin.post('/api/admin/polls', samplePoll());
  const ok = await upload(poll.id, PNG);
  assert.equal(ok.status, 201);
  assert.match(ok.data.url, /^\/img\/[A-Za-z0-9_-]{22}$/);

  const served = await fetch(srv.baseUrl + ok.data.url);
  assert.equal(served.headers.get('content-type'), 'image/png');
  assert.equal(Buffer.compare(Buffer.from(await served.arrayBuffer()), PNG), 0);

  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  assert.equal((await upload(poll.id, svg, 'image/svg+xml')).status, 415);
  assert.equal((await upload(poll.id, Buffer.from('não sou imagem'), 'image/png')).status, 400);
  assert.equal((await client(srv.baseUrl).post(`/api/admin/polls/${poll.id}/images`, PNG, { 'content-type': 'image/png' })).status, 401);
  assert.equal((await fetch(`${srv.baseUrl}/img/nao-existe-xxxxxxxxxxxx`)).status, 404);
});

test('imagem fica vinculada à alternativa, sobrevive a edições e não pode vir de outra votação', async () => {
  const { data: poll } = await admin.post('/api/admin/polls', samplePoll());
  const { data: other } = await admin.post('/api/admin/polls', samplePoll());
  const { data: { imageId } } = await upload(poll.id, PNG);
  const { data: { imageId: foreignId } } = await upload(other.id, PNG);

  const withImage = samplePoll();
  withImage.categories[0].options = [{ name: 'Ana Souza', imageId }, 'Bruno Lima', 'Carla Dias'];
  let res = await admin.put(`/api/admin/polls/${poll.id}`, withImage);
  assert.equal(res.status, 200);
  assert.equal(res.data.categories[0].options[0].imageUrl, `/img/${imageId}`);

  // Editar outro campo mantendo o imageId preserva a imagem.
  res = await admin.put(`/api/admin/polls/${poll.id}`, { ...withImage, title: 'Novo título' });
  assert.equal(res.data.categories[0].options[0].imageId, imageId);

  const stolen = samplePoll();
  stolen.categories[0].options = [{ name: 'Ana Souza', imageId: foreignId }, 'Bruno Lima'];
  assert.equal((await admin.put(`/api/admin/polls/${poll.id}`, stolen)).status, 400);

  // Removida da alternativa → imagem órfã apagada.
  await admin.put(`/api/admin/polls/${poll.id}`, samplePoll());
  assert.equal((await fetch(`${srv.baseUrl}/img/${imageId}`)).status, 404);
});

test('imagens desativadas: somem da API e do PowerPoint, recusam envio e voltam intactas ao religar', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'urna-img-'));
  const file = path.join(dir, 'urna.db');

  let on = await startServer({ file });
  let api = await adminClient(on.baseUrl);
  const { data: poll } = await api.post('/api/admin/polls', samplePoll());
  const { data: { imageId, url } } = await api.post(`/api/admin/polls/${poll.id}/images`, PNG, { 'content-type': 'image/png' });
  const def = samplePoll();
  def.categories[0].options = [{ name: 'Ana Souza', imageId }, 'Bruno Lima'];
  await api.put(`/api/admin/polls/${poll.id}`, def);
  await on.stop();

  const off = await startServer({ file, env: { OPTION_IMAGES: '0' } });
  api = await adminClient(off.baseUrl);
  assert.equal((await api.get('/api/admin/config')).data.optionImages, false);
  assert.equal((await api.post(`/api/admin/polls/${poll.id}/images`, PNG, { 'content-type': 'image/png' })).status, 409);
  assert.equal((await fetch(off.baseUrl + url)).status, 404);

  // Salvar pelo editor com as imagens desligadas não pode apagar a imagem guardada.
  const { data: saved } = await api.put(`/api/admin/polls/${poll.id}`, {
    title: poll.title,
    categories: (await api.get(`/api/admin/polls/${poll.id}`)).data.categories.map((c) => ({
      title: c.title, allowBlank: c.allowBlank, options: c.options.map(({ name, imageId: id }) => ({ name, imageId: id })),
    })),
  });
  assert.equal(saved.categories[0].options[0].imageUrl, null);

  await api.post(`/api/admin/polls/${poll.id}/open`);
  const anon = client(off.baseUrl);
  const { data: view } = await anon.get(`/api/public/polls/${poll.publicId}`);
  assert.ok(view.categories.flatMap((c) => c.options).every((o) => o.imageUrl === null), 'cédula sem imagens');
  await anon.post(`/api/public/polls/${poll.publicId}/ballots`, { voterKey: voterKey(20), choices: ballot(view, [0, 0]) });
  await api.post(`/api/admin/polls/${poll.id}/close`, { confirm: true });
  const zip = await JSZip.loadAsync((await api.get(`/api/admin/polls/${poll.id}/export/pptx`)).data);
  assert.ok(!Object.values(zip.files).some((f) => !f.dir && f.name.startsWith('ppt/media/')), 'PowerPoint sem imagens');
  await off.stop();

  on = await startServer({ file });
  assert.equal((await fetch(on.baseUrl + url)).status, 200, 'imagem preservada');
  await on.stop();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('duplicar: novo rascunho com alternativas e imagens próprias, sem votos', async () => {
  const { data: poll } = await admin.post('/api/admin/polls', samplePoll());
  const { data: { imageId } } = await upload(poll.id, PNG);
  const def = samplePoll();
  def.categories[0].options = [{ name: 'Ana Souza', imageId }, 'Bruno Lima'];
  await admin.put(`/api/admin/polls/${poll.id}`, def);
  await admin.post(`/api/admin/polls/${poll.id}/open`);
  const anon = client(srv.baseUrl);
  const { data: view } = await anon.get(`/api/public/polls/${poll.publicId}`);
  await anon.post(`/api/public/polls/${poll.publicId}/ballots`, { voterKey: voterKey(9), choices: ballot(view, [0, 0]) });
  await admin.post(`/api/admin/polls/${poll.id}/close`, { confirm: true });

  const { status, data: copy } = await admin.post(`/api/admin/polls/${poll.id}/duplicate`);
  assert.equal(status, 201);
  assert.notEqual(copy.id, poll.id);
  assert.notEqual(copy.publicId, poll.publicId);
  assert.equal(copy.status, 'draft');
  assert.equal(copy.ballotCount, 0);
  assert.ok(copy.results.categories.every((c) => c.validVotes === 0));
  const copiedImage = copy.categories[0].options[0];
  assert.ok(copiedImage.imageId && copiedImage.imageId !== imageId, 'imagem copiada com novo id');
  assert.equal((await fetch(srv.baseUrl + copiedImage.imageUrl)).status, 200);

  // Excluir a original não afeta a cópia.
  await admin.del(`/api/admin/polls/${poll.id}`);
  assert.equal((await fetch(srv.baseUrl + copiedImage.imageUrl)).status, 200);
});

test('cédula pública mostra a imagem; PowerPoint usa a imagem do campeão; votação aberta trava o envio', async () => {
  const { data: poll } = await admin.post('/api/admin/polls', samplePoll());
  const { data: { imageId } } = await upload(poll.id, PNG);
  const def = samplePoll();
  def.categories[0].options = [{ name: 'Ana Souza', imageId }, 'Bruno Lima', 'Carla Dias'];
  await admin.put(`/api/admin/polls/${poll.id}`, def);
  await admin.post(`/api/admin/polls/${poll.id}/open`);
  assert.equal((await upload(poll.id, PNG)).status, 409, 'aberta: imagens travadas');

  const anon = client(srv.baseUrl);
  const { data: view } = await anon.get(`/api/public/polls/${poll.publicId}`);
  assert.equal(view.categories[0].options[0].imageUrl, `/img/${imageId}`);
  assert.equal(view.categories[0].options[1].imageUrl, null);

  await anon.post(`/api/public/polls/${poll.publicId}/ballots`, { voterKey: voterKey(1), choices: ballot(view, [0, 0]) });
  await admin.post(`/api/admin/polls/${poll.id}/close`, { confirm: true });
  const pptx = await admin.get(`/api/admin/polls/${poll.id}/export/pptx`);
  const zip = await JSZip.loadAsync(pptx.data);
  const media = Object.values(zip.files).filter((f) => !f.dir && f.name.startsWith('ppt/media/'));
  assert.ok(media.length >= 1, 'imagem embutida no pptx');
  const slides = await Promise.all(Object.keys(zip.files).filter((n) => /slides\/slide\d+\.xml$/.test(n)).map((n) => zip.file(n).async('string')));
  const champion = slides.find((x) => x.includes('CAMPEÃO') && x.includes('Ana Souza'));
  assert.match(champion, /<p:pic>/, 'foto do campeão no slide');
  assert.match(champion, /<a:srcRect/, 'recortada para preencher a moldura');
});
