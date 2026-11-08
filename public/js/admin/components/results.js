import { h } from '../../shared/dom.js';
import { alertBox } from '../../shared/feedback.js';
import { categoryName, fmtInt, fmtPercent, plural } from '../../shared/format.js';

function posChip(rank, hasVotes) {
  const cls = hasVotes && rank <= 3 ? `pos-chip pos-chip--${rank}` : 'pos-chip';
  return h('span', { class: cls }, `${rank}º`);
}

/**
 * Tabela de ranking de uma categoria. Empates dividem a posição e são sinalizados;
 * nenhum critério de desempate é aplicado. Brancos ficam fora do ranking.
 */
export function categoryResult(category, imageByOption = new Map()) {
  const hasVotes = category.validVotes > 0;
  const maxVotes = Math.max(1, ...category.ranking.map((r) => r.votes));

  let notice = null;
  if (category.outcome === 'tie') {
    notice = alertBox('warning', h('strong', {}, 'Empate no 1º lugar: '), `${category.winners.join(', ')}. Nenhum critério de desempate é aplicado automaticamente.`);
  } else if (!hasVotes) {
    notice = alertBox('info', 'Ainda não há votos válidos nesta categoria.');
  }

  const rows = category.ranking.map((r) => {
    const bar = h('span', {});
    bar.style.width = `${(r.votes / maxVotes) * 100}%`;
    const first = hasVotes && r.rank === 1;
    return h('tr', { class: first ? 'is-first' : '' },
      h('td', { class: 'ranking__pos' }, posChip(r.rank, hasVotes)),
      h('td', {}, h('div', { class: 'ranking__option' },
        imageByOption.get(r.optionId) ? h('img', { class: 'ranking__thumb', src: imageByOption.get(r.optionId), alt: '' }) : null,
        h('div', {},
          h('div', { class: 'ranking__name' }, r.name, ' ', r.tied && hasVotes ? h('span', { class: 'badge badge--tie badge--plain' }, 'Empate') : null),
          h('div', { class: 'ranking__bar', 'aria-hidden': 'true' }, bar)))),
      h('td', { class: 'num' }, fmtInt(r.votes)),
      h('td', { class: 'num' }, fmtPercent(r.share)));
  });

  if (category.allowBlank) {
    rows.push(h('tr', { class: 'is-blank' },
      h('td', { class: 'ranking__pos' }, '—'),
      h('td', {}, 'Votos em branco (fora do ranking)'),
      h('td', { class: 'num' }, fmtInt(category.blankVotes)),
      h('td', { class: 'num' }, category.totalVotes ? `${fmtPercent(category.blankShare)}*` : '—')));
  }

  return h('section', { class: 'category-result', 'aria-label': category.title },
    h('div', { class: 'category-result__head' },
      h('h3', { class: 'category-result__title' }, categoryName(category.title)),
      h('p', { class: 'category-result__stats' },
        plural(category.validVotes, 'voto válido', 'votos válidos'),
        category.allowBlank ? ` · ${plural(category.blankVotes, 'branco', 'brancos')}` : '')),
    notice,
    h('div', { class: 'category-result__body' },
      h('table', { class: 'ranking' },
        h('caption', { class: 'visually-hidden' }, `Ranking da categoria ${category.title}`),
        h('thead', {}, h('tr', {},
          h('th', { scope: 'col' }, 'Pos.'), h('th', { scope: 'col' }, 'Opção'),
          h('th', { scope: 'col', class: 'num' }, 'Votos'), h('th', { scope: 'col', class: 'num' }, '% válidos'))),
        h('tbody', {}, rows))));
}

export function resultsNote(hasBlank) {
  return h('p', { class: 'hint' }, 'Percentuais sobre os votos válidos. Empates dividem a mesma posição.',
    hasBlank ? ' *Brancos: percentual sobre o total de votos da categoria.' : '');
}
