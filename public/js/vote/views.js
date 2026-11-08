import { h, uid } from '../shared/dom.js';
import { icon } from '../shared/icons.js';
import { alertBox } from '../shared/feedback.js';
import { categoryName, fmtDateTime, plural } from '../shared/format.js';
import { initials } from '../shared/imageResize.js';
import { confetti, quipBubble } from '../shared/celebrate.js';
import { QUIPS, pickQuip } from '../shared/quips.js';

/* Telas da página de votação. Cada função recebe dados + callbacks e devolve um nó. */

export function loadingView() {
  return h('div', { class: 'vote-card' },
    h('div', { class: 'loading-block' }, h('div', { class: 'spinner', role: 'progressbar', 'aria-label': 'Carregando' }), h('p', {}, 'Carregando a votação…')));
}

export function messageView({ iconName, tone = '', title, text, action, quip }) {
  return h('div', { class: 'vote-card' },
    h('div', { class: 'empty-state' },
      h('div', { class: `empty-state__icon ${tone ? `empty-state__icon--${tone}` : ''}` }, icon(iconName)),
      h('h1', {}, title),
      text ? h('p', {}, text) : null,
      action || null,
      quip ? quipBubble(quip) : null));
}

export function privacyNote() {
  return h('div', { class: 'privacy-note' },
    icon('shield'),
    h('p', {}, h('strong', {}, 'Seu voto é anônimo. '),
      'Não pedimos nome, e-mail nem login. O sistema guarda apenas os totais de cada opção, sem registrar quem escolheu o quê.'));
}

export function introView(poll, { onStart }) {
  const count = poll.categories.length;
  return h('div', { class: 'vote-card vote-card--intro' },
    h('div', { class: 'emblem', 'aria-hidden': 'true' }, icon('trophy')),
    h('p', { class: 'eyebrow' }, 'Votação aberta'),
    h('h1', { class: 'vote-title' }, poll.title),
    poll.description ? h('p', { class: 'vote-lead' }, poll.description) : null,
    h('ul', { class: 'facts' },
      h('li', {}, icon('ballot'), plural(count, 'categoria', 'categorias')),
      h('li', {}, icon('clock'), count > 3 ? 'Cerca de 1 a 2 minutos' : 'Menos de 1 minuto'),
      poll.closesAt ? h('li', {}, icon('calendar'), `Aberta até ${fmtDateTime(poll.closesAt)}`) : null),
    quipBubble(pickQuip('start')),
    privacyNote(),
    h('button', { class: 'btn btn--primary btn--lg btn--block', type: 'button', onClick: onStart }, h('span', {}, 'Começar a votar'), icon('arrowRight')));
}

export function codeView(poll, { initialCode = '', error, onSubmit }) {
  const inputId = uid('code');
  const errorId = uid('code-error');
  const input = h('input', {
    id: inputId, class: 'input input--code', name: 'code', inputmode: 'text', autocomplete: 'one-time-code',
    autocapitalize: 'characters', spellcheck: 'false', maxlength: '9', placeholder: 'ABCD-2345', value: initialCode,
    required: true, 'aria-describedby': `${inputId}-hint${error ? ` ${errorId}` : ''}`, 'aria-invalid': error ? 'true' : null,
  });
  // Formata enquanto digita: maiúsculas e hífen após 4 caracteres.
  input.addEventListener('input', () => {
    const raw = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    input.value = raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw;
  });
  const button = h('button', { class: 'btn btn--primary btn--lg btn--block', type: 'submit' }, h('span', {}, 'Continuar'), icon('arrowRight'));
  const form = h('form', { class: 'stack', novalidate: true, onSubmit: (e) => { e.preventDefault(); onSubmit(input.value, button); } },
    h('div', { class: 'field' },
      h('label', { class: 'label', for: inputId }, 'Código de participação'),
      input,
      h('p', { class: 'hint', id: `${inputId}-hint` }, 'São 8 letras e números, como ABCD-2345. Ele é aceito uma única vez.'),
      error ? h('p', { class: 'field-error', id: errorId }, icon('alert'), error) : null),
    button);

  return h('div', { class: 'vote-card' },
    h('p', { class: 'eyebrow' }, 'Votação aberta'),
    h('h1', { class: 'vote-title' }, poll.title),
    h('p', { class: 'vote-lead' }, 'Digite o código que você recebeu do organizador para acessar a cédula.'),
    form,
    privacyNote());
}

/** Imagem da alternativa, ou as iniciais quando ela não tem imagem. */
export function optionMedia(name, imageUrl, className = 'choice__media') {
  return imageUrl
    ? h('img', { class: className, src: imageUrl, alt: '', loading: 'lazy', decoding: 'async' })
    : h('span', { class: `${className} ${className}--empty`, 'aria-hidden': 'true' }, initials(name));
}

function optionCard({ inputName, value, checked, label, blank, onChange, withMedia, imageUrl }) {
  return h('label', { class: `choice ${blank ? 'choice--blank' : ''} ${withMedia && !blank ? 'choice--media' : ''}` },
    h('input', { type: 'radio', name: inputName, value, checked, onChange }),
    h('span', { class: 'choice__body' },
      h('span', { class: 'choice__radio' }),
      withMedia && !blank ? optionMedia(label, imageUrl) : null,
      h('span', { class: 'choice__text' }, h('span', { class: 'choice__title' }, label),
        blank ? h('span', { class: 'choice__desc' }, 'Não escolher nenhuma opção nesta categoria') : null)));
}

/** Progresso em segmentos: um por categoria; preenchido = já respondida. */
function stepSegments(poll, index, choices) {
  const total = poll.categories.length;
  const answered = poll.categories.filter((c) => c.id in choices).length;
  return h('div', { class: 'step-progress' },
    h('div', { class: 'step-progress__label' },
      h('span', {}, `Categoria ${index + 1} de ${total}`),
      h('span', { class: 'muted' }, `${answered} de ${total} respondidas`)),
    h('div', {
      class: 'step-segments', role: 'progressbar', 'aria-label': 'Progresso da votação',
      'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(answered),
    }, poll.categories.map((c, i) => h('span', {
      class: `step-segments__item ${c.id in choices ? 'is-done' : ''} ${i === index ? 'is-current' : ''}`,
    }))));
}

/**
 * Tela de uma categoria. Ao TOCAR/CLICAR numa opção, `onSelect(id, true)` sinaliza
 * avanço automático; seleção por teclado (setas) não avança, só marca.
 */
export function categoryView(poll, index, choices, { onSelect, onBack, onNext, error, quip }) {
  const category = poll.categories[index];
  const total = poll.categories.length;
  const selected = choices[category.id];
  const inputName = `cat-${category.id}`;
  const legendId = uid('legend');
  const isLast = index === total - 1;

  let lastPointer = 0;
  const viaPointer = () => Date.now() - lastPointer < 1000;

  const withMedia = category.options.some((o) => o.imageUrl);
  const options = category.options.map((o) => optionCard({
    inputName, value: String(o.id), checked: selected === o.id, label: o.name, withMedia, imageUrl: o.imageUrl,
    onChange: () => onSelect(o.id, viaPointer()),
  }));
  const blank = category.allowBlank ? optionCard({
    inputName, value: 'blank', checked: selected === null, label: 'Votar em branco', blank: true, onChange: () => onSelect(null, viaPointer()),
  }) : null;

  const fieldset = h('fieldset', { class: 'options', 'aria-labelledby': legendId },
    h('legend', { class: 'visually-hidden' }, `Escolha uma opção em ${categoryName(category.title)}`),
    h('div', { class: `choice-grid ${category.options.length > 6 && !withMedia ? 'choice-grid--2' : ''}` }, options),
    blank ? h('div', { class: 'options__blank' }, blank) : null);
  fieldset.addEventListener('pointerdown', () => { lastPointer = Date.now(); });

  return h('div', { class: 'vote-card vote-card--step' },
    total > 1 ? stepSegments(poll, index, choices) : h('p', { class: 'eyebrow' }, poll.title),
    h('div', { class: 'step-body' },
      h('h1', { class: 'vote-title', id: legendId }, categoryName(category.title)),
      category.description ? h('p', { class: 'vote-lead' }, category.description) : null,
      // A instrução só precisa aparecer uma vez: no início e na última etapa, que leva à revisão.
      index === 0 || isLast
        ? h('p', { class: 'step-hint' }, isLast ? 'Toque na sua escolha para revisar o voto.' : 'Toque na sua escolha para ir à próxima categoria.')
        : null,
      fieldset,
      error ? alertBox('warning', error) : null,
      quip ? quipBubble(quip) : null),
    h('div', { class: 'vote-actions' },
      h('button', { class: 'btn btn--secondary vote-back', type: 'button', onClick: onBack, 'aria-label': 'Voltar' }, icon('arrowLeft'), h('span', {}, 'Voltar')),
      h('button', { class: 'btn btn--primary', type: 'button', onClick: onNext },
        h('span', {}, isLast ? 'Revisar voto' : 'Próxima'), icon('arrowRight'))));
}

export function reviewView(poll, choices, { onEdit, onBack, onConfirm, error }) {
  const rows = poll.categories.map((c, i) => {
    const chosen = choices[c.id];
    const option = chosen === null ? null : c.options.find((o) => o.id === chosen);
    const label = option ? option.name : 'Em branco';
    return h('li', { class: 'review__item' },
      option?.imageUrl ? optionMedia(option.name, option.imageUrl, 'review__media') : null,
      h('div', { class: 'review__text' },
        h('p', { class: 'review__category' }, categoryName(c.title)),
        h('p', { class: `review__choice ${chosen === null ? 'is-blank' : ''}` }, label)),
      h('button', { class: 'btn btn--ghost btn--sm review__edit', type: 'button', onClick: () => onEdit(i), 'aria-label': `Alterar escolha em ${categoryName(c.title)}` }, icon('edit'), h('span', {}, 'Alterar')));
  });

  const confirmBtn = h('button', { class: 'btn btn--accent btn--lg', type: 'button' }, icon('check'), h('span', {}, 'Confirmar voto'));
  confirmBtn.addEventListener('click', () => onConfirm(confirmBtn));

  return h('div', { class: 'vote-card vote-card--step' },
    h('p', { class: 'eyebrow' }, 'Última etapa'),
    h('h1', { class: 'vote-title' }, 'Confira seu voto'),
    h('p', { class: 'vote-lead' }, 'Depois de confirmar, não será possível alterar as escolhas.'),
    h('ul', { class: 'review' }, rows),
    quipBubble(QUIPS.confirm),
    error ? alertBox('danger', error) : null,
    h('div', { class: 'vote-actions' },
      h('button', { class: 'btn btn--secondary vote-back', type: 'button', onClick: onBack, 'aria-label': 'Voltar' }, icon('arrowLeft'), h('span', {}, 'Voltar')),
      confirmBtn));
}

export function successView(poll) {
  const view = messageView({
    iconName: 'check', tone: 'done', title: 'Voto registrado!', quip: pickQuip('done'),
    text: `Obrigado por participar de “${poll.title}”. Seu voto foi contabilizado de forma anônima. Você já pode fechar esta página.`,
  });
  view.append(confetti());
  return view;
}
