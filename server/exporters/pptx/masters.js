import { COLORS, FONTS } from '../theme.js';
import { SLIDE_H, SLIDE_W, MARGIN_X } from './helpers.js';

export const MASTER = {
  cover: 'URNA_CAPA',
  content: 'URNA_CONTEUDO',
  placing: 'URNA_COLOCADO',
  champion: 'URNA_CAMPEAO',
  about: 'URNA_SOBRE_CAMPEAO',
};

// Geometria compartilhada entre o master e o conteúdo dos slides.
export const PLACING_PHOTO = { x: MARGIN_X, y: 1.55, w: 4.4, h: 5.1 };
export const CHAMPION_PHOTO = { x: 7.95, y: 0.75, w: 4.7, h: 5.85 };

const promptStyle = (color) => ({
  fontFace: FONTS.body, fontSize: 13, color, italic: true, valign: 'top', margin: 6, bullet: false,
});

function footer(pollTitle) {
  return [
    { rect: { x: 0, y: 0, w: 0.12, h: SLIDE_H, fill: { color: COLORS.navy }, line: { color: COLORS.navy, width: 0 } } },
    { line: { x: MARGIN_X, y: 6.92, w: SLIDE_W - MARGIN_X * 2, h: 0, line: { color: COLORS.line, width: 0.75 } } },
    {
      text: {
        text: pollTitle,
        options: { x: MARGIN_X, y: 6.98, w: 9, h: 0.32, fontFace: FONTS.body, fontSize: 10, color: COLORS.muted, margin: 0 },
      },
    },
  ];
}

const slideNumber = (color) => ({ x: SLIDE_W - 1.3, y: 6.98, w: 0.6, h: 0.32, fontFace: FONTS.body, fontSize: 10, color, align: 'right' });

/**
 * Layouts personalizados. Fotos e campos de texto do vencedor são PLACEHOLDERS
 * reais do PowerPoint: no modo de edição exibem a instrução e o botão
 * "Inserir imagem"; na apresentação, se ficarem vazios, não aparecem.
 */
export function defineMasters(pptx, pollTitle) {
  pptx.defineSlideMaster({
    title: MASTER.cover,
    background: { color: COLORS.navyDeep },
    objects: [
      { rect: { x: 0, y: 0, w: 0.35, h: SLIDE_H, fill: { color: COLORS.gold }, line: { color: COLORS.gold, width: 0 } } },
    ],
  });

  pptx.defineSlideMaster({
    title: MASTER.content,
    background: { color: COLORS.white },
    objects: footer(pollTitle),
    slideNumber: slideNumber(COLORS.muted),
  });

  pptx.defineSlideMaster({
    title: MASTER.placing,
    background: { color: COLORS.white },
    objects: [
      ...footer(pollTitle),
      { rect: { ...PLACING_PHOTO, fill: { color: COLORS.canvas }, line: { color: COLORS.silver, width: 1, dashType: 'dash' } } },
      {
        placeholder: {
          options: { name: 'foto', type: 'pic', ...PLACING_PHOTO, ...promptStyle(COLORS.muted), align: 'center', valign: 'middle' },
          text: 'INSIRA A FOTO DO COLOCADO AQUI',
        },
      },
      {
        placeholder: {
          options: { name: 'legenda', type: 'body', x: 5.6, y: 5.15, w: 7.05, h: 0.6, ...promptStyle(COLORS.muted) },
          text: 'Legenda — clique para escrever',
        },
      },
      {
        placeholder: {
          options: { name: 'descricao', type: 'body', x: 5.6, y: 5.8, w: 7.05, h: 0.95, ...promptStyle(COLORS.muted) },
          text: 'Descrição ou observações sobre o colocado — clique para escrever',
        },
      },
    ],
    slideNumber: slideNumber(COLORS.muted),
  });

  pptx.defineSlideMaster({
    title: MASTER.champion,
    background: { color: COLORS.navyDeep },
    objects: [
      { rect: { x: 0, y: 0, w: SLIDE_W, h: 0.12, fill: { color: COLORS.gold }, line: { color: COLORS.gold, width: 0 } } },
      { rect: { ...CHAMPION_PHOTO, fill: { color: COLORS.navySoft }, line: { color: COLORS.goldBright, width: 2 } } },
      {
        placeholder: {
          options: { name: 'foto', type: 'pic', ...CHAMPION_PHOTO, ...promptStyle('D6DEE9'), fontSize: 16, align: 'center', valign: 'middle' },
          text: 'INSIRA A FOTO DO CAMPEÃO AQUI',
        },
      },
      {
        placeholder: {
          options: { name: 'legenda', type: 'body', x: CHAMPION_PHOTO.x, y: 6.68, w: CHAMPION_PHOTO.w, h: 0.5, ...promptStyle('B9C4D3'), fontSize: 12, align: 'center' },
          text: 'Legenda da foto — clique para escrever',
        },
      },
    ],
    slideNumber: { ...slideNumber('8FA0B6'), x: 0.7, align: 'left' },
  });

  const card = (x, label, name, prompt) => [
    { rect: { x, y: 1.85, w: 3.75, h: 4.75, fill: { color: COLORS.canvas }, line: { color: COLORS.line, width: 0.75 } } },
    { rect: { x, y: 1.85, w: 3.75, h: 0.08, fill: { color: COLORS.gold }, line: { color: COLORS.gold, width: 0 } } },
    {
      text: {
        text: label,
        options: { x: x + 0.25, y: 2.05, w: 3.3, h: 0.4, fontFace: FONTS.heading, fontSize: 15, color: COLORS.navy, margin: 0 },
      },
    },
    {
      placeholder: {
        options: { name, type: 'body', x: x + 0.2, y: 2.55, w: 3.35, h: 3.9, ...promptStyle(COLORS.muted) },
        text: prompt,
      },
    },
  ];

  pptx.defineSlideMaster({
    title: MASTER.about,
    background: { color: COLORS.white },
    objects: [
      ...footer(pollTitle),
      ...card(MARGIN_X, 'Descrição', 'sobre_descricao', 'Quem é, o que fez, por que se destacou — clique para escrever'),
      ...card(MARGIN_X + 4.0, 'Curiosidades', 'sobre_curiosidades', 'Fatos interessantes sobre o campeão — clique para escrever'),
      ...card(MARGIN_X + 8.0, 'Observações', 'sobre_observacoes', 'Agradecimentos, avisos ou próximos passos — clique para escrever'),
    ],
    slideNumber: slideNumber(COLORS.muted),
  });
}
