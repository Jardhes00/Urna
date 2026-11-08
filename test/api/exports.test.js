import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { adminClient, ballot, client, startServer, voterKey } from '../helpers.js';

let srv;
let admin;
let pollId;
const MANY = Array.from({ length: 25 }, (_, i) => `Equipe ${String(i + 1).padStart(2, '0')}`);

before(async () => {
  srv = await startServer();
  admin = await adminClient(srv.baseUrl);
  const { data: poll } = await admin.post('/api/admin/polls', {
    title: 'Festival de Ideias & Inovação',
    description: 'Votação final do festival',
    categories: [
      { title: 'Melhor Projeto', description: 'Impacto e execução', options: ['Projeto Aurora', 'Projeto Boreal', 'Projeto Cometa', 'Projeto Duna'] },
      { title: 'Voto Popular', options: MANY },
      { title: 'Categoria Vazia', options: ['Sem Voto 1', 'Sem Voto 2'] },
    ],
  });
  pollId = poll.id;
  await admin.post(`/api/admin/polls/${pollId}/open`);
  const anon = client(srv.baseUrl);
  const { data: view } = await anon.get(`/api/public/polls/${poll.publicId}`);

  // Melhor Projeto: Aurora 5, Boreal 5 (empate no 1º), Cometa 2, branco 1 | Voto Popular: equipe 07 vence com 4.
  const p1 = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, null];
  const p2 = [6, 6, 6, 6, 0, 1, 2, 3, 4, 5, 7, 8, 9];
  for (const [i, a] of p1.entries()) {
    const res = await anon.post(`/api/public/polls/${poll.publicId}/ballots`, { voterKey: voterKey(i), choices: ballot(view, [a, p2[i], null]) });
    assert.equal(res.status, 201);
  }
  await admin.post(`/api/admin/polls/${pollId}/close`, { confirm: true });
});
after(() => srv.stop());

async function slidesText(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  const slides = await Promise.all(names.map((n) => zip.file(n).async('string')));
  const layouts = await Promise.all(Object.keys(zip.files).filter((n) => /slideLayouts\/slideLayout\d+\.xml$/.test(n)).map((n) => zip.file(n).async('string')));
  const text = (xml) => [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join(' | ');
  return { zip, slides, layouts, texts: slides.map(text) };
}

test('PowerPoint: estrutura, conteúdo real, ranking completo, empate e placeholders de foto', async () => {
  const res = await admin.get(`/api/admin/polls/${pollId}/export/pptx`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  const { zip, slides, layouts, texts } = await slidesText(res.data);

  assert.ok(zip.file('[Content_Types].xml') && zip.file('ppt/presentation.xml'), 'pacote OOXML válido');
  assert.match(texts[0], /RESULTADO OFICIAL/);
  assert.match(texts[0], /Festival de Ideias &amp; Inovação/);
  assert.match(texts[0], /13 cédulas registradas/);
  assert.match(texts[1], /Resumo da votação/);
  assert.match(texts.at(-1), /Obrigado pela participação/);

  const all = texts.join('\n');
  // Ranking completo: todas as 25 equipes aparecem (tabela paginada).
  for (const name of MANY) assert.ok(all.includes(name), `falta ${name}`);
  assert.ok(texts.some((t) => /Ranking completo \(3\/3\)/.test(t)), 'ranking de 25 opções paginado em 3 slides');

  // Empate no 1º: dois slides de campeão, marcados como empate, sem desempate.
  const champion = texts.filter((t) => t.startsWith('CAMPEÃO'));
  assert.ok(champion.some((t) => /EMPATE NO 1º LUGAR/.test(t) && /Projeto Aurora/.test(t)));
  assert.ok(champion.some((t) => /EMPATE NO 1º LUGAR/.test(t) && /Projeto Boreal/.test(t)));
  assert.ok(champion.some((t) => /Equipe 07/.test(t) && /4 votos/.test(t)));
  assert.match(all, /Empate no 1º lugar entre Projeto Aurora, Projeto Boreal/);
  assert.match(all, /Sem votos válidos/);
  assert.match(all, /41,7% dos votos válidos/); // Aurora: 5 de 12 válidos (1 branco)
  assert.match(all, /30,8% dos votos válidos/); // Equipe 07: 4 de 13

  // Placeholders de foto reais (type="pic") com a instrução pedida.
  const layoutXml = layouts.join('\n');
  assert.match(layoutXml, /INSIRA A FOTO DO CAMPEÃO AQUI/);
  assert.match(layoutXml, /INSIRA A FOTO DO COLOCADO AQUI/);
  assert.ok((layoutXml.match(/<p:ph type="pic"/g) || []).length >= 2);
  assert.match(layoutXml, /Curiosidades/);
  assert.match(layoutXml, /Observações/);
  const championSlides = slides.filter((xml) => xml.includes('CAMPEÃO'));
  assert.ok(championSlides.every((xml) => /<p:ph type="pic"/.test(xml)), 'cada slide de campeão tem o placeholder de foto');

  // Elementos editáveis: tabelas e gráficos nativos, nenhuma imagem achatada.
  assert.ok(slides.some((xml) => xml.includes('<a:tbl>')));
  assert.ok(Object.keys(zip.files).some((n) => /ppt\/charts\/chart\d+\.xml$/.test(n)));
  assert.ok(!Object.values(zip.files).some((f) => !f.dir && f.name.startsWith('ppt/media/')), 'sem imagens rasterizadas');
  // Gráficos editáveis: cada um carrega sua planilha de dados ("Editar dados" no PowerPoint).
  assert.ok(Object.keys(zip.files).some((n) => /ppt\/embeddings\/.+\.xlsx$/.test(n)));

  // XML conforme: nenhum <a:pPr> depois de um trecho de texto; idioma pt-BR.
  for (const xml of [...slides, ...layouts]) {
    assert.ok(!/<\/a:r><a:pPr/.test(xml));
    assert.ok(!/lang="en-US"/.test(xml));
  }
});

test('Excel: abas, valores oficiais, fórmulas, empates e conferência', async () => {
  const res = await admin.get(`/api/admin/polls/${pollId}/export/xlsx`);
  assert.equal(res.status, 200);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(res.data);
  assert.deepEqual(wb.worksheets.map((w) => w.name), ['Resumo', 'Ranking completo']);

  const ranking = wb.getWorksheet('Ranking completo');
  assert.deepEqual(ranking.getRow(1).values.slice(1), ['Categoria', 'Posição', 'Opção', 'Votos', '% dos votos válidos', 'Empate']);
  const rows = [];
  ranking.eachRow((row, n) => { if (n > 1) rows.push(row); });
  assert.equal(rows.length, 4 + 25 + 2, 'todas as opções de todas as categorias');

  const value = (cell) => (cell.value && typeof cell.value === 'object' && 'formula' in cell.value ? cell.value.result : cell.value);
  const aurora = rows.find((r) => r.getCell(3).value === 'Projeto Aurora');
  assert.match(aurora.getCell(2).value.formula, /^COUNTIFS\(/);
  assert.equal(value(aurora.getCell(2)), 1);
  assert.equal(aurora.getCell(4).value, 5);
  assert.ok(Math.abs(value(aurora.getCell(5)) - 5 / 12) < 1e-9);
  assert.equal(aurora.getCell(5).numFmt, '0.0%');
  assert.equal(value(aurora.getCell(6)), 'Sim');
  const cometa = rows.find((r) => r.getCell(3).value === 'Projeto Cometa');
  assert.equal(value(cometa.getCell(2)), 3);
  assert.equal(value(cometa.getCell(6)), 'Não');

  const summary = wb.getWorksheet('Resumo');
  let total = null;
  let check = null;
  summary.eachRow((row) => {
    if (row.getCell(1).value === 'Total geral') total = row;
    if (String(row.getCell(1).value).startsWith('Conferência')) check = row;
    if (row.getCell(1).value === 'Melhor Projeto') {
      assert.equal(value(row.getCell(3)), 12);
      assert.equal(row.getCell(4).value, 1);
      assert.equal(row.getCell(7).value, 'Empate: Projeto Aurora, Projeto Boreal');
    }
  });
  assert.ok(total, 'linha de total geral');
  assert.match(total.getCell(3).value.formula, /^SUM\(/);
  assert.equal(value(total.getCell(3)), 12 + 13 + 0, 'total geral de votos válidos');
  assert.equal(value(check.getCell(2)), 'OK');

  // Nenhum dado pessoal: a planilha não contém chaves de participação.
  const dump = JSON.stringify(wb.worksheets.map((ws) => ws.getSheetValues()));
  assert.ok(!dump.includes('teste-chave'));
});

test('ZIP com os dois arquivos', async () => {
  const res = await admin.get(`/api/admin/polls/${pollId}/export/zip`);
  assert.equal(res.status, 200);
  const zip = await JSZip.loadAsync(res.data);
  assert.deepEqual(Object.keys(zip.files).sort(), [
    'resultado-festival-de-ideias-inovacao.pptx', 'resultado-festival-de-ideias-inovacao.xlsx',
  ]);
});
