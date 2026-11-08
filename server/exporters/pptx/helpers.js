import { COLORS, FONTS } from '../theme.js';

export const SLIDE_W = 13.333;
export const SLIDE_H = 7.5;
export const MARGIN_X = 0.7;
export const CONTENT_W = SLIDE_W - MARGIN_X * 2;

/** Reduz o tamanho da fonte para nomes longos, sem depender do auto-ajuste do PowerPoint. */
export function fitFont(text, base, { comfortable = 18, min = 16 } = {}) {
  const len = String(text).length;
  if (len <= comfortable) return base;
  return Math.max(min, Math.round(base * Math.sqrt(comfortable / len)));
}

/** Título padrão dos slides de conteúdo: rótulo pequeno + título. */
export function addHeading(slide, kicker, title) {
  if (kicker) {
    slide.addText(kicker.toUpperCase(), {
      x: MARGIN_X, y: 0.45, w: CONTENT_W, h: 0.35,
      fontFace: FONTS.heading, fontSize: 12, color: COLORS.gold, charSpacing: 2, margin: 0,
    });
  }
  slide.addText(title, {
    x: MARGIN_X, y: 0.8, w: CONTENT_W, h: 0.8,
    fontFace: FONTS.heading, fontSize: fitFont(title, 30, { comfortable: 48, min: 20 }),
    color: COLORS.ink, margin: 0, valign: 'middle',
  });
}

/** Cartão de indicador (número grande + legenda). */
export function addKpi(slide, { x, y, w, h = 1.45, label, value, note, accent = COLORS.navy }) {
  slide.addShape('rect', { x, y, w, h, fill: { color: COLORS.canvas }, line: { color: COLORS.line, width: 0.75 } });
  slide.addShape('rect', { x, y, w: 0.08, h, fill: { color: accent }, line: { color: accent, width: 0 } });
  slide.addText(String(value), {
    x: x + 0.3, y: y + 0.18, w: w - 0.45, h: 0.7,
    fontFace: FONTS.heading, fontSize: 30, color: COLORS.ink, margin: 0, valign: 'middle',
  });
  slide.addText(label, {
    x: x + 0.3, y: y + 0.88, w: w - 0.45, h: 0.32,
    fontFace: FONTS.body, fontSize: 12, color: COLORS.muted, margin: 0,
  });
  if (note) {
    slide.addText(note, {
      x: x + 0.3, y: y + 1.12, w: w - 0.45, h: 0.28,
      fontFace: FONTS.body, fontSize: 10, color: COLORS.muted, italic: true, margin: 0,
    });
  }
}

/** Distribui `count` cartões lado a lado dentro da largura útil. */
export function kpiRow(slide, y, items) {
  const gap = 0.3;
  const w = (CONTENT_W - gap * (items.length - 1)) / items.length;
  items.forEach((item, i) => addKpi(slide, { ...item, x: MARGIN_X + i * (w + gap), y, w }));
}

/** Divide uma lista em páginas. */
export function paginate(items, size) {
  const pages = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages.length ? pages : [[]];
}

/** Estilo de célula de cabeçalho/corpo das tabelas. */
export const tableHeaderCell = (text, align = 'left') => ({
  text,
  options: {
    bold: true, color: COLORS.white, fill: { color: COLORS.navy }, align,
    fontFace: FONTS.heading, fontSize: 12,
  },
});

export const tableCell = (text, { align = 'left', highlight = false, bold = false, muted = false } = {}) => ({
  text: String(text),
  options: {
    align,
    bold,
    color: muted ? COLORS.muted : COLORS.ink,
    fill: { color: highlight ? COLORS.goldSoft : COLORS.white },
    fontFace: FONTS.body,
    fontSize: 12,
  },
});
