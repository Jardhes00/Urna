import { api } from '../../shared/api.js';
import { h, mount } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';
import { categoryName, fmtPercent, plural } from '../../shared/format.js';
import { confetti, quipBubble, stickers } from '../../shared/celebrate.js';
import { QUIPS, deck, pickEmojis } from '../../shared/quips.js';

/**
 * Modo apresentação: para cada categoria, uma tela de suspense
 * ("O resultado de … é…") seguida da revelação do 1º lugar e do ranking.
 * Teclado: → / Espaço / Enter avançam, ← volta, Esc sai.
 */
export async function renderPresentation(view, params, ctx) {
  const pollId = Number(params[0]);
  const poll = await api.get(`/api/admin/polls/${pollId}`);

  if (poll.status !== 'closed') {
    mount(view, h('div', { class: 'container' }, h('div', { class: 'card' }, h('div', { class: 'empty-state' },
      h('div', { class: 'empty-state__icon' }, icon('lock')),
      h('h1', {}, 'Apresentação indisponível'),
      h('p', {}, 'O modo apresentação usa o resultado oficial e fica disponível depois que a votação é finalizada.'),
      h('a', { class: 'btn btn--primary', href: `#/polls/${pollId}` }, 'Voltar à votação')))));
    return null;
  }

  const categories = poll.results.categories;
  const imageByOption = new Map(poll.categories.flatMap((c) => c.options.filter((o) => o.imageUrl).map((o) => [o.id, o.imageUrl])));
  // Sequência de telas: [suspense, revelação] por categoria.
  const steps = categories.flatMap((c, i) => [{ type: 'suspense', i }, { type: 'reveal', i }]);
  let current = 0;

  // Referências sorteadas uma vez: voltar e avançar mostra a mesma tela.
  const nextSuspense = deck(QUIPS.suspense);
  const nextReveal = deck(QUIPS.reveal);
  const quips = categories.map(() => ({ suspense: nextSuspense(), reveal: nextReveal() }));

  const stage = h('div', { class: 'present__stage', tabindex: '-1', 'aria-live': 'polite' });
  const counter = h('span', {});
  const prevBtn = h('button', { class: 'btn btn--on-dark', type: 'button', onClick: () => go(current - 1) }, icon('arrowLeft'), h('span', {}, 'Anterior'));
  const nextBtn = h('button', { class: 'btn btn--accent', type: 'button', onClick: () => go(current + 1) });

  const exit = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    ctx.navigate(`/polls/${pollId}`);
  };
  const fullscreenBtn = h('button', {
    class: 'btn btn--on-dark btn--sm', type: 'button',
    onClick: () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {}),
  }, icon('external'), h('span', {}, 'Tela cheia'));

  function suspense(category, quip) {
    return h('div', { class: 'suspense' },
      h('div', { class: 'suspense__trophy', 'aria-hidden': 'true' }, icon('trophy')),
      h('p', { class: 'suspense__kicker' }, poll.title),
      h('h1', { class: 'suspense__title' }, h('span', {}, 'O resultado de'), `${categoryName(category.title)} é…`),
      quipBubble(quip),
      h('button', { class: 'btn btn--accent btn--lg', type: 'button', onClick: () => go(current + 1) }, icon('trophy'), h('span', {}, 'Revelar resultado')));
  }

  function reveal(category, quip) {
    let winnerBlock;
    if (category.outcome === 'no-votes') {
      winnerBlock = h('div', { class: 'reveal__winner' }, h('p', { class: 'reveal__label' }, categoryName(category.title)), h('h1', { class: 'reveal__name' }, 'Sem votos válidos'));
    } else {
      const first = category.ranking.filter((r) => r.rank === 1);
      const photos = first.map((r) => imageByOption.get(r.optionId)).filter(Boolean);
      winnerBlock = h('div', { class: 'reveal__winner' },
        photos.length
          ? h('div', { class: 'reveal__photos' }, photos.map((src) => h('img', { class: 'reveal__photo', src, alt: '' })))
          : icon('trophy'),
        h('p', { class: 'reveal__label' }, category.outcome === 'tie' ? '1º lugar · empate' : '1º lugar'),
        h('h1', { class: 'reveal__name' }, first.map((r) => r.name).join(' e ')),
        h('p', { class: 'reveal__votes' }, `${plural(first[0].votes, 'voto', 'votos')} · ${fmtPercent(first[0].share)}`),
        h('p', { class: 'reveal__category' }, categoryName(category.title)),
        quipBubble(quip));
    }

    const items = category.ranking.map((r) => {
      const item = h('li', { class: `reveal__item ${r.rank === 1 && category.validVotes ? 'is-first' : ''}` },
        h('span', { class: 'reveal__pos' }, `${r.rank}º`),
        h('span', { class: 'reveal__item-name' }, r.name),
        h('span', { class: 'reveal__item-votes' }, `${plural(r.votes, 'voto', 'votos')} · ${fmtPercent(r.share)}`));
      item.style.setProperty('--share', `${r.share * 100}%`);
      return item;
    });
    if (category.allowBlank) {
      items.push(h('li', { class: 'reveal__item is-blank' }, h('span', { class: 'reveal__pos' }, '—'),
        h('span', { class: 'reveal__item-name' }, 'Em branco'), h('span', { class: 'reveal__item-votes' }, plural(category.blankVotes, 'voto', 'votos'))));
    }
    items.forEach((item, i) => item.style.setProperty('--i', i));
    return h('div', { class: 'reveal' }, winnerBlock, h('ol', { class: 'reveal__list', 'aria-label': 'Ranking completo' }, items),
      category.outcome === 'no-votes' ? null : confetti(70));
  }

  function go(index) {
    if (index < 0) return;
    if (index >= steps.length) return exit();
    current = index;
    const step = steps[current];
    const category = categories[step.i];
    mount(stage, step.type === 'suspense' ? suspense(category, quips[step.i].suspense) : reveal(category, quips[step.i].reveal));
    counter.textContent = `Categoria ${step.i + 1} de ${categories.length}`;
    prevBtn.disabled = current === 0;
    const last = current === steps.length - 1;
    mount(nextBtn, h('span', {}, last ? 'Encerrar apresentação' : (step.type === 'suspense' ? 'Revelar' : 'Próxima categoria')), icon(last ? 'x' : 'arrowRight'));
    stage.focus({ preventScroll: true });
  }

  const onKey = (e) => {
    if (e.target.closest?.('button') && (e.key === 'Enter' || e.key === ' ')) return; // deixa o botão focado agir
    if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); go(current + 1); }
    if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); go(current - 1); }
    if (e.key === 'Escape' && !document.fullscreenElement) exit();
  };
  document.addEventListener('keydown', onKey);
  document.querySelector('.toast-region')?.replaceChildren(); // avisos anteriores não cobrem o palco

  mount(view, h('div', { class: 'present theme-night stage-glow', role: 'region', 'aria-label': 'Apresentação dos resultados' },
    stickers(pickEmojis(8)),
    h('div', { class: 'present__bar' }, counter,
      h('div', { class: 'btn-row' }, fullscreenBtn,
        h('button', { class: 'btn btn--on-dark btn--sm', type: 'button', onClick: exit }, icon('x'), h('span', {}, 'Sair')))),
    stage,
    h('div', { class: 'present__nav' }, prevBtn, nextBtn)));
  go(0);

  return () => document.removeEventListener('keydown', onKey);
}
