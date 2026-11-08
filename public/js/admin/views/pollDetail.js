import { api } from '../../shared/api.js';
import { focusHeading, h, mount, setLoading } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';
import { alertBox, confirmDialog, toast } from '../../shared/feedback.js';
import { fmtDateTime, fmtInt, fmtTime, plural } from '../../shared/format.js';
import { backLink, card, kpi, loadingBlock, statusBadge } from '../components/ui.js';
import { categoryResult, resultsNote } from '../components/results.js';
import { sharePanel } from '../components/sharePanel.js';
import { tokensPanel } from '../components/tokensPanel.js';
import { exportPanel } from '../components/exportPanel.js';

const REFRESH_MS = 5000;
let baseUrlCache = null;

async function publicBaseUrl() {
  if (!baseUrlCache) baseUrlCache = (await api.get('/api/admin/config')).publicBaseUrl;
  return baseUrlCache;
}

export async function renderPollDetail(view, params, ctx) {
  const pollId = Number(params[0]);
  const container = h('div', { class: 'container' }, loadingBlock('Carregando votação…'));
  mount(view, container);

  let poll;
  let timer = null;
  let disposed = false;
  let lastUpdate = null;
  const kpiArea = h('div', {});
  const resultsArea = h('div', {});
  const liveIndicator = h('span', { class: 'live-indicator', 'aria-live': 'off' });

  [poll] = await Promise.all([api.get(`/api/admin/polls/${pollId}`), publicBaseUrl()]);
  const voteUrl = `${baseUrlCache}/v/${poll.publicId}`;

  /** optionId → URL da imagem (as alternativas não mudam depois de abertas). */
  const imageByOption = () => new Map(poll.categories.flatMap((c) => c.options.filter((o) => o.imageUrl).map((o) => [o.id, o.imageUrl])));

  /* ---------- Blocos atualizáveis ---------- */

  function drawKpis() {
    const closesLabel = poll.status === 'closed' ? 'Encerrada em' : 'Encerramento';
    const closesValue = poll.status === 'closed' ? fmtDateTime(poll.closedAt) : (poll.closesAt ? fmtDateTime(poll.closesAt) : 'Manual');
    mount(kpiArea, h('div', { class: 'kpis' },
      kpi('Cédulas registradas', fmtInt(poll.ballotCount)),
      kpi('Categorias', fmtInt(poll.categories.length)),
      kpi('Aberta em', poll.openedAt ? fmtDateTime(poll.openedAt) : 'Ainda não aberta', { text: true }),
      kpi(closesLabel, closesValue, { text: true })));
  }

  function drawResults() {
    const { results } = poll;
    const official = poll.resultsOfficial;
    let headText = 'Resultados parciais';
    if (official) headText = 'Resultado oficial';
    if (poll.status === 'draft') headText = 'Prévia das categorias';

    const title = h('div', { class: 'results-head' },
      h('div', {}, h('h2', { class: 'card__title' }, headText),
        h('p', { class: 'panel-text' }, official
          ? 'Totais consolidados no encerramento. Estes são os dados usados nos arquivos.'
          : 'Visível apenas para você. Os participantes não veem resultados.')),
      poll.status === 'open' ? liveIndicator : null);

    mount(resultsArea, h('section', { class: 'card' },
      h('div', { class: 'card__header' }, title),
      poll.integrityError ? h('div', { class: 'card__body' }, alertBox('danger', poll.integrityError)) : null,
      h('div', { class: 'results-list' }, results.categories.map((c) => categoryResult(c, imageByOption()))),
      h('div', { class: 'card__body' }, resultsNote(results.categories.some((c) => c.allowBlank)))));
  }

  function updateLive(ok) {
    liveIndicator.classList.toggle('is-stale', !ok);
    liveIndicator.textContent = ok
      ? `Atualizado às ${fmtTime(lastUpdate)}`
      : `Sem conexão — último dado às ${lastUpdate ? fmtTime(lastUpdate) : '—'}`;
  }

  async function refresh() {
    try {
      const fresh = await api.get(`/api/admin/polls/${pollId}`, { retries: 0 });
      if (disposed) return;
      const statusChanged = fresh.status !== poll.status;
      poll = fresh;
      lastUpdate = new Date();
      if (statusChanged) return draw(); // ex.: encerramento automático pelo prazo
      drawKpis();
      drawResults();
      updateLive(true);
    } catch (err) {
      if (ctx.handleError(err)) return;
      updateLive(false);
    }
  }

  /* ---------- Ações ---------- */

  async function openPoll(button) {
    const ok = await confirmDialog({
      title: 'Abrir a votação?',
      message: h('div', { class: 'stack' },
        h('p', {}, 'A partir de agora o link passa a aceitar votos.'),
        h('p', {}, h('strong', {}, 'As categorias e opções não poderão mais ser editadas.'))),
      confirmLabel: 'Abrir votação', iconName: 'play',
    });
    if (!ok) return;
    setLoading(button);
    try {
      poll = await api.post(`/api/admin/polls/${pollId}/open`);
      toast('Votação aberta! Compartilhe o link com os participantes.');
      draw();
    } catch (err) {
      setLoading(button, false);
      if (!ctx.handleError(err)) toast(err.message, { type: 'error', duration: 6000 });
    }
  }

  async function finalize(button) {
    const ok = await confirmDialog({
      title: 'Finalizar a votação?',
      message: h('div', { class: 'stack' },
        h('p', {}, `Foram registradas ${plural(poll.ballotCount, 'cédula', 'cédulas')}. Ao finalizar:`),
        h('ul', {},
          h('li', {}, 'novos votos deixam de ser aceitos imediatamente;'),
          h('li', {}, 'os totais são consolidados como resultado oficial;'),
          h('li', {}, 'a apresentação em PowerPoint é gerada para download.'))),
      confirmLabel: 'Finalizar e gerar', danger: true, iconName: 'flag',
      requireCheck: 'Entendo que esta ação é definitiva e a votação não poderá ser reaberta.',
    });
    if (!ok) return;
    setLoading(button);
    try {
      poll = await api.post(`/api/admin/polls/${pollId}/close`, { confirm: true });
      toast('Votação encerrada. Gerando a apresentação…');
      draw();
      container.querySelector('[data-export="pptx"]')?.click();
    } catch (err) {
      setLoading(button, false);
      if (!ctx.handleError(err)) toast(err.message, { type: 'error', duration: 6000 });
      if (err.code === 'INVALID_STATE') refresh();
    }
  }

  async function removePoll(button) {
    const ok = await confirmDialog({
      title: 'Excluir votação?',
      message: poll.status === 'closed'
        ? 'Os totais, o link e os códigos serão apagados definitivamente. Baixe os arquivos antes, se precisar deles.'
        : 'O rascunho será apagado definitivamente. A urna pronta pode ser recriada depois, mas sem as edições feitas pelo painel.',
      confirmLabel: 'Excluir', danger: true, iconName: 'trash',
      requireCheck: poll.status === 'closed'
        ? 'Já baixei o que precisava. Excluir todos os dados desta votação.'
        : 'Quero mesmo apagar este rascunho.',
    });
    if (!ok) return;
    setLoading(button);
    try {
      await api.del(`/api/admin/polls/${pollId}`);
      toast('Votação excluída.');
      ctx.navigate('/');
    } catch (err) {
      setLoading(button, false);
      if (!ctx.handleError(err)) toast(err.message, { type: 'error' });
    }
  }

  /** Cria um rascunho com as mesmas categorias, alternativas e imagens (sem votos). */
  function duplicateButton() {
    const btn = h('button', { class: 'btn btn--secondary', type: 'button' }, icon('copy'), h('span', {}, 'Duplicar como rascunho'));
    btn.addEventListener('click', async () => {
      setLoading(btn);
      try {
        const copy = await api.post(`/api/admin/polls/${pollId}/duplicate`);
        toast('Cópia criada como rascunho. Votos e códigos não são copiados.');
        ctx.navigate(`/polls/${copy.id}`);
      } catch (err) {
        setLoading(btn, false);
        if (!ctx.handleError(err)) toast(err.message, { type: 'error' });
      }
    });
    return btn;
  }

  /* ---------- Painéis laterais por estado ---------- */

  function nextStepPanel() {
    if (poll.status === 'draft') {
      const openBtn = h('button', { class: 'btn btn--accent btn--lg btn--block', type: 'button' }, icon('play'), h('span', {}, 'Abrir votação'));
      openBtn.addEventListener('click', () => openPoll(openBtn));
      const needsTokens = poll.accessMode === 'token' && !poll.tokens?.total;
      return card({
        title: 'Pronta para começar?',
        body: [
          h('ul', { class: 'checklist' },
            h('li', {}, icon('check'), `${plural(poll.categories.length, 'categoria', 'categorias')} configurada${poll.categories.length === 1 ? '' : 's'}`),
            h('li', {}, icon('check'), poll.accessMode === 'token' ? 'Participação por códigos individuais' : 'Participação por link aberto'),
            h('li', {}, icon('check'), poll.closesAt ? `Encerra automaticamente em ${fmtDateTime(poll.closesAt)}` : 'Encerramento manual')),
          needsTokens ? alertBox('warning', 'Gere os códigos de participação (abaixo) antes ou depois de abrir.') : null,
          openBtn,
          h('a', { class: 'btn btn--secondary btn--block', href: `#/polls/${pollId}/edit` }, icon('edit'), h('span', {}, 'Editar')),
        ],
      });
    }
    if (poll.status === 'open') {
      const finishBtn = h('button', { class: 'btn btn--danger btn--lg btn--block', type: 'button' }, icon('flag'), h('span', {}, 'Finalizar votação e gerar apresentação'));
      finishBtn.addEventListener('click', () => finalize(finishBtn));
      return card({
        title: 'Finalizar',
        body: [
          h('p', { class: 'panel-text' }, 'Quando todos tiverem votado, finalize para consolidar o resultado oficial e baixar a apresentação e a planilha.'),
          finishBtn,
        ],
      });
    }
    return exportPanel(poll, { handleError: ctx.handleError, verifyCode: poll.verificationCode });
  }

  function dangerZone() {
    if (poll.status === 'open') return null;
    const btn = h('button', { class: 'btn btn--danger-outline btn--block', type: 'button' }, icon('trash'), h('span', {}, 'Excluir votação'));
    btn.addEventListener('click', () => removePoll(btn));
    return card({
      className: 'danger-zone',
      title: 'Dados e retenção',
      body: [
        h('p', { class: 'panel-text' }, poll.status === 'closed'
          ? 'Os totais ficam guardados até você excluir a votação. Recomendamos excluir depois de baixar os arquivos.'
          : 'Exclua o rascunho se ele não for mais necessário.'),
        btn,
      ],
    });
  }

  /* ---------- Montagem ---------- */

  function draw() {
    clearInterval(timer);
    timer = null;
    drawKpis();
    drawResults();

    const side = h('div', { class: 'detail-side' },
      nextStepPanel(),
      poll.status !== 'closed' ? sharePanel(poll, voteUrl) : null,
      poll.accessMode === 'token' && poll.status !== 'closed'
        ? tokensPanel(poll, voteUrl, { onChange: refreshAll, handleError: ctx.handleError })
        : null,
      dangerZone());

    mount(container,
      backLink('#/', 'Votações'),
      h('div', { class: 'detail-hero theme-night' },
        h('div', { class: 'page-head' }, h('div', {},
          h('h1', {}, poll.title),
          h('div', { class: 'page-head__meta' }, statusBadge(poll.status),
            h('span', {}, poll.accessMode === 'token' ? 'Códigos individuais' : 'Link aberto'),
            h('span', {}, `Criada em ${fmtDateTime(poll.createdAt)}`)),
          poll.description ? h('p', { class: 'detail-hero__text' }, poll.description) : null),
          duplicateButton()),
        kpiArea),
      h('div', { class: 'detail-grid' },
        h('div', { class: 'detail-main' }, resultsArea),
        side));

    if (poll.status === 'open') {
      lastUpdate = new Date();
      updateLive(true);
      timer = setInterval(refresh, REFRESH_MS);
    }
  }

  async function refreshAll() {
    try {
      poll = await api.get(`/api/admin/polls/${pollId}`);
      draw();
    } catch (err) {
      if (!ctx.handleError(err)) toast(err.message, { type: 'error' });
    }
  }

  draw();
  focusHeading(container);

  return () => {
    disposed = true;
    clearInterval(timer);
  };
}
