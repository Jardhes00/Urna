/**
 * Teste de ponta a ponta em navegador real (Microsoft Edge ou Chrome instalado),
 * via playwright-core. Execute com: npm run test:e2e
 *   BROWSER_CHANNEL=chrome  → usa o Chrome em vez do Edge
 *   SCREENSHOT_DIR=pasta    → salva capturas de tela das principais telas
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import { chromium } from 'playwright-core';
import { ADMIN_PASSWORD, adminClient, startServer } from '../helpers.js';
import { SEED_IMAGES_DIR } from '../../server/db/seed.js';

const SHOTS = process.env.SCREENSHOT_DIR;
const VIEWPORTS = {
  phone: { width: 375, height: 740, isMobile: true, hasTouch: true },
  smallPhone: { width: 320, height: 640, isMobile: true, hasTouch: true },
  tablet: { width: 820, height: 1100, isMobile: true, hasTouch: true },
  desktop: { width: 1366, height: 860 },
};

let srv;
let browser;
let tmp;
const consoleErrors = [];
let voteUrl;

async function newPage(viewport = VIEWPORTS.desktop, label = 'page') {
  const { width, height, ...rest } = viewport;
  const context = await browser.newContext({ viewport: { width, height }, ...rest, acceptDownloads: true, locale: 'pt-BR' });
  const page = await context.newPage();
  page.on('console', (msg) => {
    // Respostas 4xx esperadas (ex.: 409 "já votou") aparecem como "Failed to load resource".
    // ERR_INTERNET_DISCONNECTED é provocado de propósito no teste de falha de rede.
    const expected = /Failed to load resource: (the server responded with a status of 4\d\d|net::ERR_INTERNET_DISCONNECTED)/;
    if (msg.type() === 'error' && !expected.test(msg.text())) {
      consoleErrors.push(`[${label}] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => consoleErrors.push(`[${label}] ${err.message}`));
  return { page, context };
}

async function shot(page, name) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  // Espera as animações de entrada (no máximo 1,2 s: o confete segue caindo na captura).
  await page.evaluate(() => Promise.race([
    Promise.allSettled(document.getAnimations().filter((a) => a.effect.getTiming().iterations !== Infinity).map((a) => a.finished)),
    new Promise((resolve) => { setTimeout(resolve, 1200); }),
  ]));
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
}

async function assertNoHorizontalScroll(page, where) {
  const { overflow, culprits } = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const culprits = [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > width + 0.5)
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`.slice(0, 60));
    return { overflow: document.documentElement.scrollWidth - width, culprits: culprits.slice(0, 5) };
  });
  assert.ok(overflow <= 0, `${where}: rolagem horizontal de ${overflow}px em ${culprits.join(', ')}`);
}

/** Verificações básicas de acessibilidade: nomes acessíveis, rótulos, idioma, alvos de toque. */
async function assertA11y(page, where, { touch = false } = {}) {
  const problems = await page.evaluate((checkTouch) => {
    const out = [];
    if (!document.documentElement.lang) out.push('html sem lang');
    const visible = (el) => el.offsetParent !== null || el.getClientRects().length > 0;
    for (const el of document.querySelectorAll('button, a[href]')) {
      if (!visible(el)) continue;
      const name = (el.getAttribute('aria-label') || el.textContent || '').trim();
      if (!name) out.push(`sem nome acessível: ${el.outerHTML.slice(0, 80)}`);
      if (checkTouch && !el.closest('.privacy-note')) {
        const r = el.getBoundingClientRect();
        if (r.height < 32 || r.width < 32) out.push(`alvo pequeno (${Math.round(r.width)}x${Math.round(r.height)}): ${name}`);
      }
    }
    for (const el of document.querySelectorAll('input:not([type=hidden]), textarea, select')) {
      if (!visible(el) && el.type !== 'radio') continue;
      const labelled = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.closest('label') || (el.id && document.querySelector(`label[for="${el.id}"]`));
      if (!labelled) out.push(`campo sem rótulo: ${el.outerHTML.slice(0, 80)}`);
    }
    return out;
  }, touch);
  assert.deepEqual(problems, [], `${where}: ${problems.join('; ')}`);
}

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'urna-e2e-'));
  srv = await startServer({ file: path.join(tmp, 'urna.db') });
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
});

after(async () => {
  await browser?.close();
  await srv?.stop();
  fs.rmSync(tmp, { recursive: true, force: true });
});

let admin;

test('administrador: login, validação do formulário, criação e abertura da votação', async () => {
  admin = await newPage(VIEWPORTS.desktop, 'admin');
  const { page } = admin;
  await page.goto(`${srv.baseUrl}/admin`);

  // Senha errada → mensagem de erro clara.
  await page.getByLabel('Senha do administrador').fill('errada');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByText('Senha incorreta.').waitFor();
  await shot(page, '01-admin-login-erro');

  await page.getByLabel('Senha do administrador').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByRole('heading', { name: 'Votações' }).waitFor();
  await page.getByText('Nenhuma votação ainda').waitFor();
  await shot(page, '02-admin-lista-vazia');

  await page.getByRole('link', { name: 'Nova votação' }).click();
  await page.getByRole('heading', { name: 'Nova votação' }).waitFor();

  // Envio vazio: erros por campo, foco no primeiro inválido.
  await page.getByRole('button', { name: 'Salvar rascunho' }).click();
  await page.getByText('Revise os campos destacados.').waitFor();
  assert.equal(await page.evaluate(() => document.activeElement.id), 'poll-title');
  await shot(page, '03-admin-editor-erros');

  await page.getByLabel('Título da votação').fill('Prêmio Destaques 2026');
  await page.getByLabel(/^Descrição/).first().fill('Votação anual dos destaques da equipe.');
  await page.getByLabel('Nome da categoria').first().fill('Melhor Colaborador');
  await page.getByLabel('Opções (uma por linha)').first().fill('Ana Souza\nBruno Lima\nCarla Dias\nDiego Alves');
  await page.getByRole('button', { name: 'Adicionar categoria' }).click();
  await page.getByLabel('Nome da categoria').nth(1).fill('Ideia do Ano');
  await page.getByLabel('Opções (uma por linha)').nth(1).fill('Automação de relatórios\nNovo onboarding\nCafé às sextas');
  await page.getByRole('switch').nth(1).uncheck(); // sem voto em branco na 2ª categoria
  await shot(page, '04-admin-editor-preenchido');
  await page.getByRole('button', { name: 'Salvar rascunho' }).click();

  await page.getByRole('heading', { name: 'Prêmio Destaques 2026' }).waitFor();
  await page.getByText('Rascunho', { exact: true }).waitFor();
  await assertA11y(page, 'detalhe rascunho');

  // Abrir com confirmação.
  await page.getByRole('button', { name: 'Abrir votação' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Abrir votação' }).click();
  await page.getByText('Aberta', { exact: true }).waitFor();
  voteUrl = await page.getByLabel('Link da votação').inputValue();
  assert.match(voteUrl, /\/v\/[A-Za-z0-9_-]{12}$/);
  await shot(page, '05-admin-aberta');
});

async function vote(viewport, label, picks, { keyboard = false } = {}) {
  const { page, context } = await newPage(viewport, label);
  await page.goto(voteUrl);
  await page.getByRole('heading', { name: 'Prêmio Destaques 2026' }).waitFor();
  await assertA11y(page, `${label} intro`, { touch: Boolean(viewport.isMobile) });
  await assertNoHorizontalScroll(page, `${label} intro`);
  if (label === 'eleitor-1') await shot(page, '06-voto-intro-celular');
  await page.getByRole('button', { name: 'Começar a votar' }).click();

  for (const [i, pick] of picks.entries()) {
    await page.getByText(`Categoria ${i + 1} de 2`).waitFor();
    if (label === 'eleitor-1' && i === 0) {
      await assertNoHorizontalScroll(page, 'categoria');
      await shot(page, '07-voto-categoria-celular');
    }
    if (keyboard) {
      // Teclado: setas só marcam (sem avanço automático); o botão avança.
      await page.keyboard.press('Tab'); // primeira opção
      for (let k = 0; k < pick.index; k++) await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Space');
      await page.getByRole('button', { name: i === picks.length - 1 ? 'Revisar voto' : 'Próxima' }).click();
    } else {
      // Toque/clique: avança sozinho para a próxima categoria (ou para a revisão).
      await page.getByRole('radio', { name: pick.name }).check();
    }
  }

  await page.getByRole('heading', { name: 'Confira seu voto' }).waitFor();
  for (const pick of picks) {
    const shown = pick.name === 'Votar em branco' ? 'Em branco' : pick.name;
    await page.locator('.review').getByText(shown, { exact: true }).waitFor();
  }
  if (label === 'eleitor-1') await shot(page, '08-voto-revisao-celular');

  // Duplo clique rápido no confirmar não pode gerar dois envios.
  await page.getByRole('button', { name: 'Confirmar voto' }).dblclick();
  await page.getByRole('heading', { name: 'Voto registrado!' }).waitFor();
  if (label === 'eleitor-1') await shot(page, '09-voto-sucesso-celular');
  return { page, context };
}

test('participantes votam em navegadores isolados (celular, tablet, desktop e teclado)', async () => {
  const v1 = await vote(VIEWPORTS.phone, 'eleitor-1', [{ name: 'Ana Souza' }, { name: 'Novo onboarding' }]);
  await vote(VIEWPORTS.tablet, 'eleitor-2', [{ name: 'Ana Souza' }, { name: 'Automação de relatórios' }]);
  await vote(VIEWPORTS.desktop, 'eleitor-3', [{ name: 'Votar em branco' }, { name: 'Automação de relatórios' }]);
  await vote(VIEWPORTS.smallPhone, 'eleitor-4-teclado', [{ index: 1, name: 'Bruno Lima' }, { index: 2, name: 'Café às sextas' }], { keyboard: true });

  // Mesmo navegador tentando de novo: recarregar mostra "Você já votou".
  await v1.page.reload();
  await v1.page.getByRole('heading', { name: 'Você já votou' }).waitFor();
  await shot(v1.page, '10-voto-ja-votou');
});

test('rascunho da cédula sobrevive a recarregar a página; voto em branco exige escolha explícita', async () => {
  const { page } = await newPage(VIEWPORTS.phone, 'eleitor-5');
  await page.goto(voteUrl);
  await page.getByRole('button', { name: 'Começar a votar' }).click();
  await page.getByRole('button', { name: 'Próxima' }).click();
  await page.getByText('Escolha uma opção ou marque “Votar em branco” para continuar.').waitFor();
  await page.getByRole('radio', { name: 'Carla Dias' }).check();
  await page.getByText('Categoria 2 de 2').waitFor();
  assert.equal(await page.getByRole('radio', { name: 'Votar em branco' }).count(), 0, 'categoria 2 não permite branco');

  await page.reload();
  await page.getByText('Categoria 2 de 2').waitFor();
  await page.getByRole('button', { name: 'Voltar' }).click();
  assert.ok(await page.getByRole('radio', { name: 'Carla Dias' }).isChecked(), 'escolha preservada após recarregar');
  await page.getByRole('button', { name: 'Próxima' }).click();
  await page.getByText('Categoria 2 de 2').waitFor();
  await page.getByRole('radio', { name: 'Novo onboarding' }).check();
  await page.getByRole('button', { name: 'Confirmar voto' }).click();
  await page.getByRole('heading', { name: 'Voto registrado!' }).waitFor();
});

test('falha de rede ao confirmar: mensagem clara, escolhas mantidas e reenvio funciona', async () => {
  const { page, context } = await newPage(VIEWPORTS.phone, 'eleitor-6');
  await page.goto(voteUrl);
  await page.getByRole('button', { name: 'Começar a votar' }).click();
  await page.getByRole('radio', { name: 'Diego Alves' }).check();
  await page.getByText('Categoria 2 de 2').waitFor();
  await page.getByRole('radio', { name: 'Café às sextas' }).check();

  await context.setOffline(true);
  await page.getByRole('button', { name: 'Confirmar voto' }).click();
  await page.getByText(/Sem conexão com o servidor/).waitFor();
  await shot(page, '11-voto-erro-rede');
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Confirmar voto' }).click();
  await page.getByRole('heading', { name: 'Voto registrado!' }).waitFor();
});

test('painel acompanha os totais e o ranking; finalizar gera o PowerPoint', async () => {
  const { page } = admin;
  // Atualização automática (a cada 5 s) deve refletir os 6 votos.
  await page.locator('.kpi', { hasText: 'Cédulas registradas' }).getByText('6', { exact: true }).waitFor({ timeout: 12000 });
  const firstRow = page.locator('.category-result').first().locator('tbody tr').first();
  assert.match(await firstRow.innerText(), /Ana Souza[\s\S]*2[\s\S]*40,0%/);
  await shot(page, '12-admin-resultados-parciais');

  // Cancelar o diálogo não encerra.
  await page.getByRole('button', { name: 'Finalizar votação e gerar apresentação' }).click();
  const dialog = page.getByRole('dialog');
  assert.ok(await dialog.getByRole('button', { name: 'Finalizar e gerar' }).isDisabled(), 'exige marcar a confirmação');
  await shot(page, '13-admin-confirmar-encerramento');
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await page.getByText('Aberta', { exact: true }).waitFor();

  await page.getByRole('button', { name: 'Finalizar votação e gerar apresentação' }).click();
  await dialog.getByRole('checkbox').check();
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Finalizar e gerar' }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), 'resultado-premio-destaques-2026.pptx');
  const pptxPath = path.join(tmp, download.suggestedFilename());
  await download.saveAs(pptxPath);
  const zip = await JSZip.loadAsync(fs.readFileSync(pptxPath));
  assert.ok(zip.file('ppt/presentation.xml'));

  await page.getByText('Encerrada', { exact: true }).first().waitFor();
  await page.getByText('Resultado oficial consolidado.').waitFor();
  await shot(page, '14-admin-encerrada-downloads');

  for (const [type, ext] of [['Baixar planilha', 'xlsx'], ['Baixar os dois', 'zip']]) {
    const p = page.waitForEvent('download');
    await page.getByRole('button', { name: new RegExp(type) }).click();
    assert.equal((await p).suggestedFilename(), `resultado-premio-destaques-2026.${ext}`);
  }
});

test('após encerrar: a cédula informa "Votação encerrada"', async () => {
  const { page } = await newPage(VIEWPORTS.phone, 'eleitor-tardio');
  await page.goto(voteUrl);
  await page.getByRole('heading', { name: 'Votação encerrada' }).waitFor();
  await shot(page, '15-voto-encerrada');
});

test('modo apresentação: suspense, revelação e navegação por teclado', async () => {
  const { page } = admin;
  await page.getByRole('link', { name: 'Modo apresentação' }).click();
  await page.getByText('Melhor Colaborador é…').waitFor();
  await shot(page, '16-apresentacao-suspense');
  await page.keyboard.press('ArrowRight');
  await page.locator('.reveal__name').getByText('Ana Souza').waitFor();
  await shot(page, '17-apresentacao-revelacao');
  await page.keyboard.press('ArrowRight');
  await page.getByText('Ideia do Ano é…').waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('heading', { name: 'Prêmio Destaques 2026' }).waitFor();
});

test('responsividade do painel no celular', async () => {
  const { page } = await newPage(VIEWPORTS.phone, 'admin-celular');
  await page.goto(`${srv.baseUrl}/admin`);
  await page.getByLabel('Senha do administrador').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByRole('link', { name: /Prêmio Destaques 2026/ }).click();
  await page.getByText('Resultado oficial', { exact: true }).waitFor();
  await assertNoHorizontalScroll(page, 'painel celular');
  await assertA11y(page, 'painel celular');
  // Coluna do nome larga o bastante: "Automação de relatórios" não pode quebrar no meio de uma palavra.
  const nameWidth = await page.locator('.ranking__name', { hasText: 'Automação' }).evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el.firstChild);
    return el.getBoundingClientRect().width;
  });
  assert.ok(nameWidth >= 110, `coluna do nome estreita demais: ${nameWidth}px`);
  await shot(page, '18-admin-celular');
  await page.goto(`${srv.baseUrl}/admin#/new`);
  await page.getByRole('heading', { name: 'Nova votação' }).waitFor();
  await assertNoHorizontalScroll(page, 'editor celular');
  await shot(page, '19-admin-editor-celular');
});

test('votação inicial (9 categorias x 5 opções) no celular: toque avança, botões sempre visíveis', async () => {
  const api = await adminClient(srv.baseUrl);
  // Lista própria: o teste não depende dos nomes editados em server/db/seed.js.
  const nineByFive = {
    title: 'Urna 9x5',
    categories: Array.from({ length: 9 }, (_, i) => ({
      title: `Categoria ${i + 1}`, allowBlank: false, options: ['Opção 1', 'Opção 2', 'Opção 3', 'Opção 4', 'Opção 5'],
    })),
  };
  const { data: poll } = await api.post('/api/admin/polls', nineByFive);
  // Três alternativas com imagem na categoria 5, como a de bebidas.
  for (const [oi, file] of ['bebida-cerveja.png', 'bebida-caipirinha.png', 'bebida-dose.png'].entries()) {
    const { data } = await api.post(`/api/admin/polls/${poll.id}/images`, fs.readFileSync(path.join(SEED_IMAGES_DIR, file)), { 'content-type': 'image/png' });
    nineByFive.categories[4].options[oi] = { name: `Opção ${oi + 1}`, imageId: data.imageId };
  }
  assert.equal((await api.put(`/api/admin/polls/${poll.id}`, nineByFive)).status, 200);
  await api.post(`/api/admin/polls/${poll.id}/open`);

  for (const [name, viewport] of [['375', VIEWPORTS.phone], ['320', VIEWPORTS.smallPhone]]) {
    const { page } = await newPage(viewport, `celular-${name}`);
    await page.goto(`${srv.baseUrl}/v/${poll.publicId}`);
    await page.getByText('9 categorias').waitFor();
    await page.getByRole('button', { name: 'Começar a votar' }).click();

    for (let i = 0; i < 9; i++) {
      await page.getByText(`Categoria ${i + 1} de 9`).waitFor();
      await assertNoHorizontalScroll(page, `${name}px categoria ${i + 1}`);
      // Opções grandes para o polegar e barra de ações dentro da tela, sem rolar.
      const heights = await page.locator('.options .choice__body').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
      assert.equal(heights.length, 5);
      assert.ok(heights.every((hgt) => hgt >= 60), `opções com ${heights}`);
      const bar = await page.locator('.vote-actions').boundingBox();
      assert.ok(bar.y + bar.height <= viewport.height + 1, 'botões de ação visíveis sem rolar');
      if (name === '375' && i === 4) {
        // Categoria das bebidas: alternativas com imagem carregada.
        const loaded = await page.locator('img.choice__media').evaluateAll((imgs) => imgs.map((im) => im.complete && im.naturalWidth > 0));
        assert.deepEqual(loaded, [true, true, true]);
        await shot(page, '20-voto-9x5-com-imagens');
      }
      if (name === '375' && i === 3) await shot(page, '20b-voto-9x5-sem-imagens');
      await page.getByRole('radio').nth(i % 5).check();
    }

    await page.getByRole('heading', { name: 'Confira seu voto' }).waitFor();
    assert.equal(await page.locator('.review__item').count(), 9);
    await assertNoHorizontalScroll(page, `${name}px revisão`);
    if (name === '375') await shot(page, '21-voto-9x5-revisao');
    await page.getByRole('button', { name: 'Confirmar voto' }).click();
    await page.getByRole('heading', { name: 'Voto registrado!' }).waitFor();
  }

  const { data } = await api.get(`/api/admin/polls/${poll.id}`);
  assert.equal(data.ballotCount, 2);
  assert.ok(data.results.categories.every((c) => c.validVotes === 2));
});

test('painel: anexar, trocar e remover imagem de uma alternativa pelo editor', async () => {
  const api = await adminClient(srv.baseUrl);
  const { data: poll } = await api.post('/api/admin/polls', {
    title: 'Teste de imagens', categories: [{ title: 'Melhor Bebida', options: ['Caipirinha', 'Brahma'] }],
  });
  const { page } = await newPage(VIEWPORTS.desktop, 'admin-imagens');
  await page.goto(`${srv.baseUrl}/admin`);
  await page.getByLabel('Senha do administrador').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.goto(`${srv.baseUrl}/admin#/polls/${poll.id}/edit`);
  await page.getByText('Imagens das alternativas').waitFor();

  // O navegador recorta/redimensiona e envia como JPEG.
  await page.locator('input[type=file]').first().setInputFiles(path.join(SEED_IMAGES_DIR, 'bebida-caipirinha.png'));
  await page.getByRole('button', { name: 'Trocar imagem de Caipirinha' }).waitFor();
  await page.locator('input[type=file]').nth(1).setInputFiles(path.join(SEED_IMAGES_DIR, 'bebida-cerveja.png'));
  await page.getByRole('button', { name: 'Trocar imagem de Brahma' }).waitFor();
  await page.getByRole('button', { name: 'Remover imagem de Brahma' }).click();
  await shot(page, '22-admin-editor-imagens');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await page.getByText('Prévia das categorias').waitFor();
  assert.equal(await page.locator('img.ranking__thumb').count(), 1);

  const { data } = await api.get(`/api/admin/polls/${poll.id}`);
  const [caipi, brahma] = data.categories[0].options;
  assert.ok(caipi.imageUrl);
  assert.equal(brahma.imageUrl, null);
  const img = await fetch(srv.baseUrl + caipi.imageUrl);
  assert.equal(img.headers.get('content-type'), 'image/jpeg', 'convertida no navegador');
});

test('imagens desativadas: editor sem a seção e cédula sem imagens nem iniciais', async () => {
  const off = await startServer({ env: { OPTION_IMAGES: '0' } });
  try {
    const api = await adminClient(off.baseUrl);
    const { data: poll } = await api.post('/api/admin/polls', {
      title: 'Sem imagens', categories: [{ title: 'Melhor Bebida', options: ['Caipirinha', 'Brahma'] }],
    });

    const { page } = await newPage(VIEWPORTS.desktop, 'admin-sem-imagens');
    await page.goto(`${off.baseUrl}/admin`);
    await page.getByLabel('Senha do administrador').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.goto(`${off.baseUrl}/admin#/polls/${poll.id}/edit`);
    await page.getByLabel('Opções (uma por linha)').waitFor();
    assert.equal(await page.getByText('Imagens das alternativas').count(), 0);
    assert.equal(await page.locator('input[type=file]').count(), 0);

    await api.post(`/api/admin/polls/${poll.id}/open`);
    const voter = await newPage(VIEWPORTS.phone, 'eleitor-sem-imagens');
    await voter.page.goto(`${off.baseUrl}/v/${poll.publicId}`);
    await voter.page.getByRole('radio', { name: 'Caipirinha' }).waitFor({ state: 'attached' });
    assert.equal(await voter.page.locator('.choice__media, .choice--media').count(), 0);
    await shot(voter.page, '23-voto-sem-imagens');
  } finally {
    await off.stop();
  }
});

test('urna excluída por engano: exclusão exige confirmação e o botão recria a urna pronta', async () => {
  const { page } = admin;
  await page.goto(`${srv.baseUrl}/admin#/`);
  await page.getByRole('heading', { name: 'Votações' }).waitFor();
  await page.getByRole('button', { name: 'Criar urna pronta' }).click();
  await page.getByText('Rascunho', { exact: true }).waitFor();

  await page.getByRole('button', { name: 'Excluir votação' }).click();
  const dialog = page.getByRole('dialog');
  assert.ok(await dialog.getByRole('button', { name: 'Excluir' }).isDisabled(), 'exige marcar a confirmação');
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Excluir' }).click();
  await page.getByRole('heading', { name: 'Votações' }).waitFor();

  await page.getByRole('button', { name: 'Criar urna pronta' }).click();
  await page.getByText('Rascunho', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Abrir votação' }).waitFor();
});

test('referências: Luiza vai para o Canadá; cada categoria mantém a sua ao voltar', async () => {
  const api = await adminClient(srv.baseUrl);
  const { data: poll } = await api.post('/api/admin/polls', {
    title: 'Referências',
    categories: [
      { title: 'Categoria 1 - Melhor rolê', allowBlank: false, options: ['Rolê A', 'Rolê B'] },
      { title: 'Categoria 2 - Maior CAGADA', allowBlank: false, options: ['Luiza!', 'Leo Castro e Luiza', 'Outra pessoa'] },
    ],
  });
  await api.post(`/api/admin/polls/${poll.id}/open`);

  const { page } = await newPage(VIEWPORTS.phone, 'referencias');
  await page.goto(`${srv.baseUrl}/v/${poll.publicId}`);
  await page.getByRole('button', { name: 'Começar a votar' }).click();
  await page.getByRole('heading', { name: 'Melhor rolê' }).waitFor();
  const first = await page.locator('.quip__text').innerText();
  assert.ok(first.length > 3);

  await page.getByRole('radio', { name: 'Rolê A' }).check();
  await page.getByRole('heading', { name: 'Maior CAGADA' }).waitFor();
  await page.getByText('Menos a Luiza, que está no Canadá.').waitFor();
  await shot(page, '27-categoria-luiza');

  await page.getByRole('button', { name: 'Voltar' }).click();
  await page.getByRole('heading', { name: 'Melhor rolê' }).waitFor();
  assert.equal(await page.locator('.quip__text').innerText(), first, 'voltar não troca a referência');
});

test('identidade visual: fontes do próprio servidor, nada de terceiros, contraste legível', async () => {
  const api = await adminClient(srv.baseUrl);
  const { data: poll } = await api.post('/api/admin/polls', {
    title: 'Contraste', categories: [{ title: 'Categoria 3 - Melhor Novato', options: ['Antônio', 'Melão 5 anos/Halloween disfarçado'] }],
  });
  await api.post(`/api/admin/polls/${poll.id}/open`);

  /** Razão de contraste WCAG do texto com o primeiro fundo opaco de seus ancestrais. */
  const contrast = (page, selector) => page.locator(selector).first().evaluate((el) => {
    const rgb = (value) => (value.match(/[\d.]+/g) || []).map(Number);
    const blend = (fg, bg) => { const a = fg[3] ?? 1; return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)); };
    const layers = [];
    for (let node = el; node; node = node.parentElement) {
      const c = rgb(getComputedStyle(node).backgroundColor);
      if ((c[3] ?? 1) > 0) { layers.push(c); if ((c[3] ?? 1) === 1) break; }
    }
    const bg = layers.reverse().reduce((under, layer) => blend(layer, under), [255, 255, 255]);
    const fg = blend(rgb(getComputedStyle(el).color), bg);
    const lum = (c) => { const [r, g, b] = c.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
    return (hi + 0.05) / (lo + 0.05);
  });
  const assertContrast = async (page, selector, min = 4.5) => {
    const ratio = await contrast(page, selector);
    assert.ok(ratio >= min, `${selector}: contraste ${ratio.toFixed(2)} (mínimo ${min})`);
  };

  const { page, context } = await newPage(VIEWPORTS.phone, 'identidade');
  const outside = [];
  page.on('request', (r) => { if (!r.url().startsWith(srv.baseUrl) && !r.url().startsWith('data:')) outside.push(r.url()); });

  await page.goto(`${srv.baseUrl}/v/${poll.publicId}`);
  const title = page.getByRole('heading', { level: 1 });
  await title.waitFor();
  assert.equal(await title.innerText(), 'Melhor Novato', 'título sem repetir o número da categoria');
  await page.evaluate(() => document.fonts.ready);
  assert.deepEqual(await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family).sort()), ['Figtree', 'Fraunces']);
  for (const selector of ['.choice__title', '.step-hint', '.secure-tag', '.vote-footer', '.quip__text', '.quip__source']) await assertContrast(page, selector);
  assert.equal(await page.locator('.stickers span').count(), 6, 'figurinhas no fundo');
  await assertNoHorizontalScroll(page, 'figurinhas');
  // Botões dourados usam degradê, que esta medição não enxerga (azul-noite sobre #D6A02E dá cerca de 7:1).
  await page.getByRole('radio', { name: 'Melão' }).check();
  await page.getByRole('heading', { name: 'Confira seu voto' }).waitFor();
  for (const selector of ['.review__category', '.review__choice', '.vote-lead', '.eyebrow']) await assertContrast(page, selector);
  assert.deepEqual(outside, [], 'nenhuma requisição a terceiros');
  await context.close();

  // Painel (tema claro).
  const desk = await newPage(VIEWPORTS.desktop, 'identidade-painel');
  await desk.page.goto(`${srv.baseUrl}/admin`);
  await desk.page.getByLabel('Senha do administrador').fill(ADMIN_PASSWORD);
  await assertContrast(desk.page, '.login__card .muted');
  await shot(desk.page, '25-login');
  await desk.page.getByRole('button', { name: 'Entrar' }).click();
  await desk.page.getByRole('heading', { name: 'Votações' }).waitFor();
  await desk.page.locator('.poll-row').first().waitFor();
  for (const selector of ['.poll-row__title', '.poll-row__meta', '.page-head__meta', '.badge']) await assertContrast(desk.page, selector);
  await shot(desk.page, '26-lista');
  await desk.context.close();
});

test('nenhum erro de JavaScript no console durante todo o fluxo', () => {
  assert.deepEqual(consoleErrors, []);
});
