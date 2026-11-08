import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, ballot, client, samplePoll, startServer, voterKey } from '../helpers.js';

let srv;
let admin;
before(async () => {
  srv = await startServer();
  admin = await adminClient(srv.baseUrl);
});
after(() => srv.stop());

async function createOpenPoll(overrides) {
  const { data: poll } = await admin.post('/api/admin/polls', samplePoll(overrides));
  const opened = await admin.post(`/api/admin/polls/${poll.id}/open`);
  assert.equal(opened.status, 200);
  const anon = client(srv.baseUrl);
  const { data: view } = await anon.get(`/api/public/polls/${poll.publicId}`);
  return { poll, view, anon, url: `/api/public/polls/${poll.publicId}` };
}

test('endereço principal: vai ao painel sem votação aberta e à cédula com votação aberta', async () => {
  const fresh = await startServer();
  const go = () => fetch(`${fresh.baseUrl}/`, { redirect: 'manual' });
  assert.equal((await go()).headers.get('location'), '/admin');
  const api = await adminClient(fresh.baseUrl);
  const { data: poll } = await api.post('/api/admin/polls', samplePoll());
  assert.equal((await go()).headers.get('location'), '/admin', 'rascunho não é divulgado');
  await api.post(`/api/admin/polls/${poll.id}/open`);
  assert.equal((await go()).headers.get('location'), `/v/${poll.publicId}`);
  await api.post(`/api/admin/polls/${poll.id}/close`, { confirm: true });
  assert.equal((await go()).headers.get('location'), '/admin');
  await fresh.stop();
});

/* ---------- Autorização do administrador ---------- */

test('rotas administrativas exigem login; senha errada é recusada', async () => {
  const anon = client(srv.baseUrl);
  assert.equal((await anon.get('/api/admin/polls')).status, 401);
  assert.equal((await anon.post('/api/admin/polls', samplePoll())).status, 401);
  assert.equal((await anon.post('/api/auth/login', { password: 'errada' })).status, 401);
  assert.equal((await anon.get('/api/admin/polls')).status, 401);
});

test('cookie de sessão é HttpOnly + SameSite=Strict e logout invalida a sessão', async () => {
  const c = client(srv.baseUrl);
  const res = await c.post('/api/auth/login', { password: 'senha-de-teste-123' });
  const cookie = res.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Strict/i);
  assert.equal((await c.get('/api/admin/polls')).status, 200);
  await c.post('/api/auth/logout');
  assert.equal((await c.get('/api/admin/polls')).status, 401);
});

test('proteção CSRF: origem externa e corpo não-JSON são recusados', async () => {
  const evil = await admin.post('/api/admin/polls', samplePoll(), { origin: 'https://site-malicioso.example' });
  assert.equal(evil.status, 403);
  const form = await admin.post('/api/admin/polls', 'title=x', { 'content-type': 'application/x-www-form-urlencoded' });
  assert.equal(form.status, 415);
});

test('validação no servidor devolve erros por campo', async () => {
  const res = await admin.post('/api/admin/polls', { title: 'a', categories: [{ title: '', options: ['só uma'] }] });
  assert.equal(res.status, 400);
  assert.equal(res.data.error.code, 'VALIDATION_ERROR');
  assert.ok(res.data.error.details.title);
  assert.ok(res.data.error.details['categories.0.options']);
});

/* ---------- Estados da votação ---------- */

test('rascunho aparece como indisponível e não aceita votos', async () => {
  const { data: poll } = await admin.post('/api/admin/polls', samplePoll());
  const anon = client(srv.baseUrl);
  const view = await anon.get(`/api/public/polls/${poll.publicId}`);
  assert.equal(view.data.status, 'unavailable');
  assert.deepEqual(view.data.categories, []);
  const vote = await anon.post(`/api/public/polls/${poll.publicId}/ballots`, { voterKey: voterKey(1), choices: [{ categoryId: 1, optionId: 1 }] });
  assert.equal(vote.status, 409);
  assert.equal(vote.data.error.code, 'POLL_CLOSED');
  assert.equal((await anon.get('/api/public/polls/nao-existe')).status, 404);
});

test('votação aberta não pode ser editada; encerramento exige confirmação explícita', async () => {
  const { poll } = await createOpenPoll();
  assert.equal((await admin.put(`/api/admin/polls/${poll.id}`, samplePoll())).status, 409);
  assert.equal((await admin.post(`/api/admin/polls/${poll.id}/close`, {})).status, 400);
  assert.equal((await admin.del(`/api/admin/polls/${poll.id}`)).status, 409);
});

/* ---------- Voto único ---------- */

test('registra o voto, informa "já votou" e bloqueia o segundo voto da mesma chave', async () => {
  const { view, anon, url } = await createOpenPoll();
  const key = voterKey(100);
  const first = await anon.post(`${url}/ballots`, { voterKey: key, choices: ballot(view, [0, 1]) });
  assert.equal(first.status, 201);

  const again = await anon.post(`${url}/ballots`, { voterKey: key, choices: ballot(view, [1, 2]) });
  assert.equal(again.status, 409);
  assert.equal(again.data.error.code, 'ALREADY_VOTED');

  const status = await anon.get(url, { 'x-voter-key': key });
  assert.equal(status.data.hasVoted, true);
  const other = await anon.get(url, { 'x-voter-key': voterKey(101) });
  assert.equal(other.data.hasVoted, false);
});

test('API pública nunca expõe contagens', async () => {
  const { view } = await createOpenPoll();
  const text = JSON.stringify(view);
  assert.ok(!/votes|ballotCount|blankVotes/i.test(text), text);
});

test('envios simultâneos com a MESMA chave: exatamente um é aceito', async () => {
  const { poll, view, url } = await createOpenPoll();
  const key = voterKey(200);
  const results = await Promise.all(Array.from({ length: 30 }, () =>
    client(srv.baseUrl).post(`${url}/ballots`, { voterKey: key, choices: ballot(view, [0, 0]) })));
  const statuses = results.map((r) => r.status);
  assert.equal(statuses.filter((s) => s === 201).length, 1, String(statuses));
  assert.equal(statuses.filter((s) => s === 409).length, 29);
  const { data } = await admin.get(`/api/admin/polls/${poll.id}`);
  assert.equal(data.ballotCount, 1);
});

test('20 participantes simultâneos: todos contabilizados, totais e ranking corretos', async () => {
  const { poll, view, url } = await createOpenPoll();
  // Categoria 1: Ana 6, Bruno 6, Carla 5, Diego 0, branco 3 | Categoria 2: 10/7/3
  const picks1 = [...Array(6).fill(0), ...Array(6).fill(1), ...Array(5).fill(2), ...Array(3).fill(null)];
  const picks2 = [...Array(10).fill(0), ...Array(7).fill(1), ...Array(3).fill(2)];
  const res = await Promise.all(picks1.map((p, i) =>
    client(srv.baseUrl).post(`${url}/ballots`, { voterKey: voterKey(300 + i), choices: ballot(view, [p, picks2[i]]) })));
  assert.ok(res.every((r) => r.status === 201));

  const { data } = await admin.get(`/api/admin/polls/${poll.id}`);
  assert.equal(data.ballotCount, 20);
  const [c1, c2] = data.results.categories;
  assert.deepEqual(c1.ranking.map((r) => [r.name, r.votes, r.rank, r.tied]), [
    ['Ana Souza', 6, 1, true], ['Bruno Lima', 6, 1, true], ['Carla Dias', 5, 3, false], ['Diego Alves', 0, 4, false],
  ]);
  assert.equal(c1.outcome, 'tie');
  assert.equal(c1.validVotes, 17);
  assert.equal(c1.blankVotes, 3);
  assert.equal(c1.ranking[0].share, 6 / 17);
  assert.equal(c2.outcome, 'winner');
  assert.deepEqual(c2.winners, ['Automação de relatórios']);
  assert.equal(c2.ranking[0].share, 0.5);
});

test('cédulas inválidas são recusadas sem alterar nenhum total', async () => {
  const { poll, view, url } = await createOpenPoll();
  const anon = client(srv.baseUrl);
  const c1 = view.categories[0];
  const c2 = view.categories[1];
  const cases = [
    [{ categoryId: c1.id, optionId: c1.options[0].id }], // falta categoria
    [{ categoryId: c1.id, optionId: c1.options[0].id }, { categoryId: c2.id, optionId: null }], // branco não permitido
    [{ categoryId: c1.id, optionId: c2.options[0].id }, { categoryId: c2.id, optionId: c2.options[0].id }], // opção de outra categoria
    [{ categoryId: c1.id, optionId: 999999 }, { categoryId: c2.id, optionId: c2.options[0].id }],
    [{ categoryId: c1.id, optionId: c1.options[0].id }, { categoryId: c1.id, optionId: c1.options[1].id }], // categoria repetida
  ];
  for (const [i, choices] of cases.entries()) {
    const res = await anon.post(`${url}/ballots`, { voterKey: voterKey(500 + i), choices });
    assert.equal(res.status, 400, `caso ${i}`);
  }
  assert.equal((await anon.post(`${url}/ballots`, { voterKey: 'curta', choices: ballot(view, [0, 0]) })).status, 400);

  const { data } = await admin.get(`/api/admin/polls/${poll.id}`);
  assert.equal(data.ballotCount, 0);
  // A chave usada numa cédula recusada continua livre para votar.
  assert.equal((await anon.post(`${url}/ballots`, { voterKey: voterKey(500), choices: ballot(view, [0, 0]) })).status, 201);
});

/* ---------- Encerramento ---------- */

test('após encerrar: votos recusados, snapshot oficial congelado e arquivos liberados', async () => {
  const { poll, view, url, anon } = await createOpenPoll();
  await anon.post(`${url}/ballots`, { voterKey: voterKey(600), choices: ballot(view, [2, 1]) });

  assert.equal((await admin.get(`/api/admin/polls/${poll.id}/export/xlsx`)).status, 409, 'exportar com votação aberta deve falhar');

  const closed = await admin.post(`/api/admin/polls/${poll.id}/close`, { confirm: true });
  assert.equal(closed.status, 200);
  assert.equal(closed.data.status, 'closed');
  assert.equal(closed.data.resultsOfficial, true);
  assert.match(closed.data.verificationCode, /^[0-9A-F]{16}$/);

  const late = await anon.post(`${url}/ballots`, { voterKey: voterKey(601), choices: ballot(view, [0, 0]) });
  assert.equal(late.status, 409);
  assert.equal(late.data.error.code, 'POLL_CLOSED');
  assert.equal((await anon.get(url)).data.status, 'closed');
  assert.equal((await admin.post(`/api/admin/polls/${poll.id}/close`, { confirm: true })).status, 409);

  const file = await admin.get(`/api/admin/polls/${poll.id}/export/pptx`);
  assert.equal(file.status, 200);
  assert.match(file.headers.get('content-disposition'), /resultado-premio-destaques-2026\.pptx/);
});

test('encerramento automático pelo prazo', async () => {
  const closesAt = new Date(Date.now() + 1500).toISOString();
  const { poll, view, url, anon } = await createOpenPoll({ closesAt });
  assert.equal((await anon.post(`${url}/ballots`, { voterKey: voterKey(700), choices: ballot(view, [0, 0]) })).status, 201);
  await new Promise((r) => setTimeout(r, 1700));
  const late = await anon.post(`${url}/ballots`, { voterKey: voterKey(701), choices: ballot(view, [0, 0]) });
  assert.equal(late.status, 409);
  const { data } = await admin.get(`/api/admin/polls/${poll.id}`);
  assert.equal(data.status, 'closed');
  assert.equal(data.resultsOfficial, true);
  assert.equal(data.results.ballotCount, 1);
});

test('adulteração do resultado gravado bloqueia a geração dos arquivos', async () => {
  const { poll, view, url, anon } = await createOpenPoll();
  await anon.post(`${url}/ballots`, { voterKey: voterKey(800), choices: ballot(view, [0, 0]) });
  await admin.post(`/api/admin/polls/${poll.id}/close`, { confirm: true });
  srv.db.prepare("UPDATE polls SET results_json = replace(results_json, '\"ballotCount\":1', '\"ballotCount\":5') WHERE id = ?").run(poll.id);
  const res = await admin.get(`/api/admin/polls/${poll.id}/export/pptx`);
  assert.equal(res.status, 500);
  assert.equal(res.data.error.code, 'INTEGRITY_ERROR');
});

/* ---------- Códigos de uso único ---------- */

test('modo código: exige código válido, aceita uma vez e bloqueia reutilização (inclusive simultânea)', async () => {
  const { poll, view, url } = await createOpenPoll({ accessMode: 'token' });
  const gen = await admin.post(`/api/admin/polls/${poll.id}/tokens`, { count: 5 });
  assert.equal(gen.status, 201);
  assert.deepEqual(gen.data, { total: 5, used: 0 });
  const { data: { codes } } = await admin.get(`/api/admin/polls/${poll.id}/tokens`);
  assert.equal(codes.length, 5);

  const anon = client(srv.baseUrl);
  assert.equal((await anon.post(`${url}/ballots`, { voterKey: voterKey(900), choices: ballot(view, [0, 0]) })).status, 403);
  assert.equal((await anon.post(`${url}/ballots`, { code: 'ZZZZ-ZZZZ', choices: ballot(view, [0, 0]) })).status, 403);
  assert.equal((await anon.post(`${url}/check-code`, { code: 'ZZZZ-ZZZZ' })).status, 403);
  assert.equal((await anon.post(`${url}/check-code`, { code: codes[0].toLowerCase() })).status, 200);

  // Código digitado em minúsculas/sem hífen é aceito.
  const ok = await anon.post(`${url}/ballots`, { code: codes[0].replace('-', '').toLowerCase(), choices: ballot(view, [0, 0]) });
  assert.equal(ok.status, 201);
  const reuse = await anon.post(`${url}/ballots`, { code: codes[0], choices: ballot(view, [1, 1]) });
  assert.equal(reuse.status, 409);
  assert.equal((await anon.post(`${url}/check-code`, { code: codes[0] })).status, 409);

  const burst = await Promise.all(Array.from({ length: 15 }, () =>
    client(srv.baseUrl).post(`${url}/ballots`, { code: codes[1], choices: ballot(view, [2, 2]) })));
  assert.equal(burst.filter((r) => r.status === 201).length, 1);

  const { data } = await admin.get(`/api/admin/polls/${poll.id}`);
  assert.equal(data.ballotCount, 2);
  assert.deepEqual(data.tokens, { total: 5, used: 2 });
});
