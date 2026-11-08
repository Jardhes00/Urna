import { api } from '../../shared/api.js';
import { focusHeading, h, mount, setLoading } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';
import { alertBox, toast } from '../../shared/feedback.js';
import { fmtDateTime, fmtInt } from '../../shared/format.js';
import { loadingBlock, statusBadge } from '../components/ui.js';

function pollRow(poll) {
  let when = `Criada em ${fmtDateTime(poll.createdAt)}`;
  if (poll.status === 'open') when = `Aberta desde ${fmtDateTime(poll.openedAt)}`;
  if (poll.status === 'closed') when = `Encerrada em ${fmtDateTime(poll.closedAt)}`;

  return h('a', { class: `card poll-row poll-row--${poll.status}`, href: `#/polls/${poll.id}` },
    h('div', {},
      h('div', { class: 'poll-row__title' }, poll.title),
      h('div', { class: 'poll-row__meta' }, when, ' · ', poll.accessMode === 'token' ? 'Códigos individuais' : 'Link aberto')),
    statusBadge(poll.status),
    h('div', { class: 'poll-row__count' }, h('strong', {}, fmtInt(poll.ballotCount)), h('span', {}, poll.ballotCount === 1 ? 'voto' : 'votos')),
    h('span', { class: 'poll-row__arrow', 'aria-hidden': 'true' }, icon('arrowRight')));
}

export async function renderPollList(view, params, ctx) {
  /** Cria um rascunho com a urna pronta (lista de server/db/seed.js). */
  function modelButton(variant) {
    const btn = h('button', { class: `btn ${variant}`, type: 'button' }, icon('ballot'), h('span', {}, 'Criar urna pronta'));
    btn.addEventListener('click', async () => {
      setLoading(btn);
      try {
        const poll = await api.post('/api/admin/polls/from-model');
        toast('Aqui está a urna pronta, em rascunho.');
        ctx.navigate(`/polls/${poll.id}`);
      } catch (err) {
        setLoading(btn, false);
        if (!ctx.handleError(err)) toast(err.message, { type: 'error', duration: 6000 });
      }
    });
    return btn;
  }

  const content = h('div', {}, loadingBlock('Carregando votações…'));
  mount(view, h('div', { class: 'container' },
    h('div', { class: 'page-head' },
      h('div', {}, h('h1', {}, 'Votações'), h('p', { class: 'page-head__meta' }, 'Crie, acompanhe e finalize suas votações.')),
      h('div', { class: 'btn-row' },
        modelButton('btn--secondary'),
        h('a', { class: 'btn btn--primary', href: '#/new' }, icon('plus'), h('span', {}, 'Nova votação')))),
    content));
  focusHeading(view);

  try {
    const polls = await api.get('/api/admin/polls');
    if (!polls.length) {
      mount(content, h('div', { class: 'card' }, h('div', { class: 'empty-state' },
        h('div', { class: 'empty-state__icon' }, icon('ballot')),
        h('h2', {}, 'Nenhuma votação ainda'),
        h('p', {}, 'Use a urna pronta, com as categorias e alternativas já definidas, ou crie uma votação do zero.'),
        h('div', { class: 'btn-row' },
          modelButton('btn--primary'),
          h('a', { class: 'btn btn--secondary', href: '#/new' }, icon('plus'), h('span', {}, 'Criar do zero'))))));
      return;
    }
    mount(content, h('div', { class: 'poll-list' }, polls.map(pollRow)));
  } catch (err) {
    if (ctx.handleError(err)) return;
    mount(content, alertBox('danger', err.message));
  }
}
