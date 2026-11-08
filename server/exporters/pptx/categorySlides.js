import { COLORS, FONTS, formatInt, formatPercent, plural, rankLabel } from '../theme.js';
import { CHAMPION_PHOTO, MASTER, PLACING_PHOTO } from './masters.js';
import { CONTENT_W, MARGIN_X, addHeading, fitFont, kpiRow, paginate, tableCell, tableHeaderCell } from './helpers.js';

const TABLE_ROWS_PER_SLIDE = 10;
const CHART_MAX_BARS = 15;
const MAX_PLACING_SLIDES = 6;

const rankColor = (rank) => ({ 1: COLORS.gold, 2: COLORS.silver, 3: COLORS.bronze }[rank] || COLORS.navy);

function categoryKicker(category, index, total) {
  return `Categoria ${index + 1} de ${total} · ${category.title}`;
}

function addIntroSlide(pptx, category, index, total, ballotCount) {
  const slide = pptx.addSlide({ masterName: MASTER.content });
  addHeading(slide, `Categoria ${index + 1} de ${total}`, category.title);
  if (category.description) {
    slide.addText(category.description, {
      x: MARGIN_X, y: 1.65, w: CONTENT_W, h: 0.6, fontFace: FONTS.body, fontSize: 16, color: COLORS.muted, margin: 0, valign: 'top',
    });
  }

  kpiRow(slide, 2.6, [
    { label: 'Cédulas', value: formatInt(ballotCount) },
    { label: 'Votos válidos', value: formatInt(category.validVotes), accent: COLORS.gold },
    {
      label: 'Votos em branco',
      value: category.allowBlank ? formatInt(category.blankVotes) : '—',
      note: category.allowBlank ? `${formatPercent(category.blankShare)} do total` : 'Voto em branco desativado',
      accent: COLORS.blank,
    },
    { label: 'Opções concorrentes', value: formatInt(category.optionCount) },
  ]);

  let headline = 'Nenhum voto válido foi registrado nesta categoria.';
  if (category.outcome === 'winner') headline = `Vencedor: ${category.winners[0]}`;
  if (category.outcome === 'tie') headline = `Empate no 1º lugar entre ${category.winners.join(', ')}`;
  slide.addShape('rect', { x: MARGIN_X, y: 4.5, w: CONTENT_W, h: 1.0, fill: { color: COLORS.goldSoft }, line: { color: COLORS.goldSoft, width: 0 } });
  slide.addText(headline, {
    x: MARGIN_X + 0.3, y: 4.5, w: CONTENT_W - 0.6, h: 1.0, fontFace: FONTS.heading,
    fontSize: fitFont(headline, 22, { comfortable: 60, min: 14 }), color: COLORS.ink, margin: 0, valign: 'middle',
  });
  slide.addNotes('Percentuais calculados sobre os votos válidos (votos em branco não entram no ranking).');
}

function addChartSlide(pptx, category, kicker) {
  const slide = pptx.addSlide({ masterName: MASTER.content });
  const shown = category.ranking.slice(0, CHART_MAX_BARS);
  const partial = category.ranking.length > shown.length;
  addHeading(slide, kicker, partial ? `As ${shown.length} opções mais votadas` : 'Distribuição dos votos');

  slide.addChart(pptx.ChartType.bar, [{
    name: 'Votos',
    labels: shown.map((r) => r.name),
    values: shown.map((r) => r.votes),
  }], {
    x: MARGIN_X, y: 1.75, w: CONTENT_W, h: 5.0,
    barDir: 'bar',
    catAxisOrientation: 'maxMin',
    chartColors: shown.map((r) => (r.rank === 1 && category.validVotes > 0 ? COLORS.gold : COLORS.navy)),
    showLegend: false,
    showValue: true,
    dataLabelPosition: 'outEnd',
    dataLabelFontSize: 12,
    dataLabelColor: COLORS.ink,
    dataLabelFormatCode: '0',
    catAxisLabelFontSize: shown.length > 10 ? 11 : 13,
    catAxisLabelColor: COLORS.ink,
    catAxisLabelFontFace: FONTS.body,
    valAxisHidden: true,
    valGridLine: { style: 'none' },
    catAxisLineShow: false,
    barGapWidthPct: 45,
  });
  if (partial) slide.addNotes('O ranking completo está nos slides de tabela a seguir.');
}

function addRankingSlides(pptx, category, kicker) {
  const pages = paginate(category.ranking, TABLE_ROWS_PER_SLIDE);
  pages.forEach((page, pageIndex) => {
    const slide = pptx.addSlide({ masterName: MASTER.content });
    const suffix = pages.length > 1 ? ` (${pageIndex + 1}/${pages.length})` : '';
    addHeading(slide, kicker, `Ranking completo${suffix}`);

    const header = [
      tableHeaderCell('Posição', 'center'), tableHeaderCell('Opção'), tableHeaderCell('Votos', 'right'),
      tableHeaderCell('% dos válidos', 'right'), tableHeaderCell('Situação', 'center'),
    ];
    const body = page.map((r) => {
      const highlight = r.rank === 1 && category.validVotes > 0;
      return [
        tableCell(rankLabel(r.rank), { align: 'center', bold: true, highlight }),
        tableCell(r.name, { bold: highlight, highlight }),
        tableCell(formatInt(r.votes), { align: 'right', highlight }),
        tableCell(formatPercent(r.share), { align: 'right', highlight }),
        tableCell(r.tied ? 'Empate' : '', { align: 'center', highlight, muted: true }),
      ];
    });

    const isLast = pageIndex === pages.length - 1;
    if (isLast && category.allowBlank) {
      body.push([
        tableCell('—', { align: 'center', muted: true }),
        tableCell('Votos em branco (fora do ranking)', { muted: true }),
        tableCell(formatInt(category.blankVotes), { align: 'right', muted: true }),
        tableCell('—', { align: 'right', muted: true }),
        tableCell('', { muted: true }),
      ]);
    }

    slide.addTable([header, ...body], {
      x: MARGIN_X, y: 1.75, w: CONTENT_W, colW: [1.3, 6.03, 1.4, 1.8, 1.4], rowH: 0.42,
      border: { type: 'solid', color: COLORS.line, pt: 0.75 }, autoPage: false,
    });
    if (isLast) {
      slide.addText(`Total de votos válidos: ${formatInt(category.validVotes)}. Percentuais sobre os votos válidos; empates dividem a mesma posição.`, {
        x: MARGIN_X, y: 6.45, w: CONTENT_W, h: 0.35, fontFace: FONTS.body, fontSize: 11, color: COLORS.muted, italic: true, margin: 0,
      });
    }
  });
}

/**
 * Coloca a imagem da alternativa no espaço da foto, recortada para preencher a
 * moldura ("cover"). É uma imagem comum do PowerPoint: dá para trocar ou mover.
 */
function addPhoto(slide, image, box, name) {
  if (!image) return;
  slide.addImage({
    data: `${image.mime};base64,${image.data.toString('base64')}`,
    x: box.x, y: box.y, w: image.width / 100, h: image.height / 100,
    sizing: { type: 'cover', w: box.w, h: box.h },
    altText: name,
  });
}

function rankBadge(slide,{ x, y, size, rank, fontSize }) {
  slide.addShape('ellipse', { x, y, w: size, h: size, fill: { color: rankColor(rank) }, line: { color: COLORS.white, width: 2 } });
  slide.addText(rankLabel(rank), {
    x, y, w: size, h: size, fontFace: FONTS.heading, fontSize, color: COLORS.white, align: 'center', valign: 'middle', margin: 0,
  });
}

function addPlacingSlide(pptx, category, entry, kicker, image) {
  const slide = pptx.addSlide({ masterName: MASTER.placing });
  addPhoto(slide, image, PLACING_PHOTO, entry.name);
  slide.addText(kicker.toUpperCase(), {
    x: MARGIN_X, y: 0.6, w: 12, h: 0.35, fontFace: FONTS.heading, fontSize: 12, color: COLORS.gold, charSpacing: 2, margin: 0,
  });

  const left = PLACING_PHOTO.x + PLACING_PHOTO.w + 0.5;
  const width = 12.65 - left;
  rankBadge(slide, { x: left, y: 1.55, size: 1.25, rank: entry.rank, fontSize: 30 });
  slide.addText(`${entry.rank}º lugar${entry.tied ? ' (empate)' : ''}`, {
    x: left + 1.5, y: 1.55, w: width - 1.5, h: 1.25, fontFace: FONTS.heading, fontSize: 24, color: COLORS.muted, valign: 'middle', margin: 0,
  });
  slide.addText(entry.name, {
    x: left, y: 3.0, w: width, h: 1.1, fontFace: FONTS.heading, fontSize: fitFont(entry.name, 40, { comfortable: 22, min: 22 }),
    color: COLORS.ink, valign: 'middle', margin: 0,
  });
  slide.addText([
    { text: plural(entry.votes, 'voto', 'votos'), options: { bold: true, color: COLORS.navy } },
    { text: `  ·  ${formatPercent(entry.share)} dos votos válidos`, options: { color: COLORS.muted } },
  ], { x: left, y: 4.15, w: width, h: 0.55, fontFace: FONTS.body, fontSize: 20, margin: 0 });
}

function addChampionSlide(pptx, category, entry, kicker, isTie, image) {
  const slide = pptx.addSlide({ masterName: MASTER.champion });
  addPhoto(slide, image, CHAMPION_PHOTO, entry.name);
  const w = CHAMPION_PHOTO.x - MARGIN_X - 0.5;

  slide.addText(isTie ? 'CAMPEÃO · EMPATE NO 1º LUGAR' : 'CAMPEÃO', {
    x: MARGIN_X, y: 0.75, w, h: 0.45, fontFace: FONTS.heading, fontSize: 16, color: COLORS.goldBright, charSpacing: 5, margin: 0,
  });
  slide.addText(kicker, {
    x: MARGIN_X, y: 1.2, w, h: 0.45, fontFace: FONTS.body, fontSize: 15, color: '9FB0C6', margin: 0,
  });
  rankBadge(slide, { x: MARGIN_X, y: 1.95, size: 1.55, rank: 1, fontSize: 38 });
  slide.addText(entry.name, {
    x: MARGIN_X, y: 3.7, w, h: 1.4, fontFace: FONTS.heading, fontSize: fitFont(entry.name, 48, { comfortable: 18, min: 24 }),
    color: COLORS.white, valign: 'middle', margin: 0,
  });
  slide.addText([
    { text: plural(entry.votes, 'voto', 'votos'), options: { bold: true, color: COLORS.goldBright } },
    { text: `  ·  ${formatPercent(entry.share)} dos votos válidos`, options: { color: 'D6DEE9' } },
  ], { x: MARGIN_X, y: 5.2, w, h: 0.55, fontFace: FONTS.body, fontSize: 20, margin: 0 });

  // Barra de proporção dos votos válidos.
  slide.addShape('rect', { x: MARGIN_X, y: 5.95, w, h: 0.16, fill: { color: COLORS.navySoft }, line: { color: COLORS.navySoft, width: 0 } });
  if (entry.share > 0) {
    slide.addShape('rect', {
      x: MARGIN_X, y: 5.95, w: Math.max(0.05, w * entry.share), h: 0.16,
      fill: { color: COLORS.goldBright }, line: { color: COLORS.goldBright, width: 0 },
    });
  }
  if (isTie) slide.addNotes('Empate no primeiro lugar: nenhum critério de desempate foi aplicado. A ordem dos slides segue a ordem de cadastro das opções.');
}

function addAboutSlide(pptx, entry, kicker) {
  const slide = pptx.addSlide({ masterName: MASTER.about });
  addHeading(slide, kicker, `Sobre ${entry.name}`);
}

function addNoVotesSlide(pptx, kicker) {
  const slide = pptx.addSlide({ masterName: MASTER.content });
  addHeading(slide, kicker, 'Sem votos válidos');
  slide.addText('Nenhuma opção recebeu votos nesta categoria, portanto não há classificação nem campeão.', {
    x: MARGIN_X, y: 2.2, w: CONTENT_W, h: 1, fontFace: FONTS.body, fontSize: 18, color: COLORS.muted, margin: 0,
  });
}

/**
 * Sequência de slides de uma categoria:
 * abertura → gráfico → ranking completo → colocados (3º, 2º...) → campeão → sobre o campeão.
 */
export function addCategorySlides(pptx, category, index, total, ballotCount, images = new Map()) {
  const kicker = categoryKicker(category, index, total);
  addIntroSlide(pptx, category, index, total, ballotCount);

  if (category.outcome === 'no-votes') {
    addRankingSlides(pptx, category, kicker);
    addNoVotesSlide(pptx, kicker);
    return;
  }

  addChartSlide(pptx, category, kicker);
  addRankingSlides(pptx, category, kicker);

  // Colocados do pódio (2º e 3º), com votos, em ordem de revelação: do 3º para o 2º.
  const podium = category.ranking
    .filter((r) => r.rank > 1 && r.rank <= 3 && r.votes > 0)
    .slice(0, MAX_PLACING_SLIDES)
    .sort((a, b) => b.rank - a.rank);
  podium.forEach((entry) => addPlacingSlide(pptx, category, entry, kicker, images.get(entry.optionId)));

  const champions = category.ranking.filter((r) => r.rank === 1);
  const isTie = champions.length > 1;
  champions.forEach((entry) => addChampionSlide(pptx, category, entry, category.title, isTie, images.get(entry.optionId)));
  champions.forEach((entry) => addAboutSlide(pptx, entry, kicker));
}
