import { h } from './dom.js';

/** Balão com uma referência da cultura pop (ver quips.js). */
export function quipBubble(quip, className = '') {
  return h('p', { class: `quip ${className}` },
    h('span', { class: 'quip__emoji', 'aria-hidden': 'true' }, quip.emoji),
    h('span', { class: 'quip__body' },
      h('span', { class: 'quip__text' }, `“${quip.text}”`),
      h('span', { class: 'quip__source' }, `— ${quip.source}`)));
}

/** Figurinhas decorativas espalhadas pelo fundo. */
export function stickers(emojis) {
  return h('div', { class: 'stickers', 'aria-hidden': 'true' }, emojis.map((emoji, i) => {
    const sticker = h('span', {}, emoji);
    // Metade de cada lado da tela, para não ficar tudo atrás do conteúdo.
    sticker.style.setProperty('--x', `${i % 2 ? random(80, 96) : random(2, 18)}%`);
    sticker.style.setProperty('--y', `${random(8, 92)}%`);
    sticker.style.setProperty('--size', `${random(30, 56)}px`);
    sticker.style.setProperty('--rot', `${random(-24, 24)}deg`);
    return sticker;
  }));
}

const COLORS = ['#E9B949', '#F4D484', '#FBF7EE', '#C8961E', '#F28F79', '#8FC1F2'];
const random = (min, max) => min + Math.random() * (max - min);

/**
 * Confete decorativo, caindo uma única vez. Os valores vêm por variáveis CSS
 * (a CSP não permite estilos embutidos no HTML) e quem prefere menos movimento
 * não o vê (ver base.css).
 */
export function confetti(count = 44) {
  const pieces = Array.from({ length: count }, () => {
    const piece = h('span', {});
    const vars = {
      '--x': `${random(0, 100)}%`,
      '--w': `${random(6, 11)}px`,
      '--c': COLORS[Math.floor(random(0, COLORS.length))],
      '--d': `${random(1.8, 3.2)}s`,
      '--delay': `${random(0, .7)}s`,
      '--drift': `${random(-90, 90)}px`,
      '--rot': `${random(-540, 540)}deg`,
    };
    for (const [key, value] of Object.entries(vars)) piece.style.setProperty(key, value);
    return piece;
  });
  const layer = h('div', { class: 'confetti', 'aria-hidden': 'true' }, pieces);
  setTimeout(() => layer.remove(), 4500);
  return layer;
}
