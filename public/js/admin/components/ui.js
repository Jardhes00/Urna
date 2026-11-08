import { h } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';
import { STATUS_LABEL } from '../../shared/format.js';

export const statusBadge = (status) => h('span', { class: `badge badge--${status}` }, STATUS_LABEL[status] || status);

export const backLink = (href, label) => h('a', { class: 'back-link', href }, icon('arrowLeft'), label);

export function card({ title, actions, body, className = '' }) {
  return h('section', { class: `card ${className}` },
    title ? h('div', { class: 'card__header' }, h('h2', { class: 'card__title' }, title), actions || null) : null,
    h('div', { class: 'card__body' }, body));
}

/** `text: true` para valores textuais (datas, "Manual"), em tamanho menor que números. */
export function kpi(label, value, { text = false } = {}) {
  return h('div', { class: 'kpi' }, h('div', { class: `kpi__value ${text ? 'kpi__value--text' : ''}` }, value),h('div', { class: 'kpi__label' }, label));
}

export function loadingBlock(text = 'Carregando…') {
  return h('div', { class: 'loading-block' }, h('div', { class: 'spinner', role: 'progressbar', 'aria-label': text }), h('p', {}, text));
}

export function iconButton(name, label, onClick, { danger = false, disabled = false } = {}) {
  return h('button', { class: `icon-btn ${danger ? 'icon-btn--danger' : ''}`, type: 'button', 'aria-label': label, title: label, onClick, disabled }, icon(name));
}
