import { COLORS, FONTS, formatDateLong, formatDateTime, formatInt, formatPercent, plural } from '../theme.js';
import { MASTER } from './masters.js';
import { CONTENT_W, MARGIN_X, addHeading, fitFont, kpiRow, paginate, tableCell, tableHeaderCell } from './helpers.js';

const ACCESS_LABEL = {
  link: 'Link público (uma participação por navegador)',
  token: 'Códigos individuais de uso único',
};

export function addCoverSlide(pptx, snapshot) {
  const { poll } = snapshot;
  const slide = pptx.addSlide({ masterName: MASTER.cover });

  slide.addText('RESULTADO OFICIAL', {
    x: 1.0, y: 1.55, w: 11, h: 0.4, fontFace: FONTS.heading, fontSize: 14, color: COLORS.goldBright, charSpacing: 4, margin: 0,
  });
  slide.addText(poll.title, {
    x: 1.0, y: 2.0, w: 11.3, h: 1.9, fontFace: FONTS.heading, fontSize: fitFont(poll.title, 50, { comfortable: 32, min: 30 }),
    color: COLORS.white, margin: 0, valign: 'top', fit: 'shrink',
  });
  if (poll.description) {
    slide.addText(poll.description, {
      x: 1.0, y: 4.0, w: 10.5, h: 1.1, fontFace: FONTS.body, fontSize: 20, color: 'C9D3E0', margin: 0, valign: 'top', fit: 'shrink',
    });
  }
  slide.addShape('line', { x: 1.0, y: 5.55, w: 2.2, h: 0, line: { color: COLORS.goldBright, width: 2 } });
  slide.addText(`Votação encerrada em ${formatDateLong(poll.closedAt)}`, {
    x: 1.0, y: 5.75, w: 11, h: 0.4, fontFace: FONTS.body, fontSize: 16, color: COLORS.white, margin: 0,
  });
  slide.addText(`${plural(snapshot.ballotCount, 'cédula registrada', 'cédulas registradas')} · ${plural(snapshot.categories.length, 'categoria', 'categorias')}`, {
    x: 1.0, y: 6.15, w: 11, h: 0.4, fontFace: FONTS.body, fontSize: 14, color: '9FB0C6', margin: 0,
  });
}

export function addSummarySlide(pptx, snapshot) {
  const slide = pptx.addSlide({ masterName: MASTER.content });
  addHeading(slide, 'Visão geral', 'Resumo da votação');

  const totalOptions = snapshot.categories.reduce((s, c) => s + c.optionCount, 0);
  const totalBlank = snapshot.categories.reduce((s, c) => s + c.blankVotes, 0);
  const totalValid = snapshot.categories.reduce((s, c) => s + c.validVotes, 0);

  kpiRow(slide, 1.95, [
    { label: 'Cédulas registradas', value: formatInt(snapshot.ballotCount), accent: COLORS.gold },
    { label: 'Categorias', value: formatInt(snapshot.categories.length) },
    { label: 'Opções concorrentes', value: formatInt(totalOptions) },
    {
      label: 'Votos válidos (todas as categorias)',
      value: formatInt(totalValid),
      note: totalBlank ? `+ ${plural(totalBlank, 'voto em branco', 'votos em branco')}` : 'Nenhum voto em branco',
    },
  ]);

  const rows = [
    ['Abertura da votação', formatDateTime(snapshot.poll.openedAt)],
    ['Encerramento', formatDateTime(snapshot.poll.closedAt)],
    ['Forma de participação', ACCESS_LABEL[snapshot.poll.accessMode] || snapshot.poll.accessMode],
    ['Sigilo', 'Votos anônimos — nenhum voto individual é armazenado, apenas os totais'],
  ];
  slide.addTable(
    rows.map(([k, v]) => [tableCell(k, { bold: true }), tableCell(v)]),
    { x: MARGIN_X, y: 3.85, w: CONTENT_W, colW: [3.4, CONTENT_W - 3.4], rowH: 0.5, border: { type: 'solid', color: COLORS.line, pt: 0.75 } },
  );
}

/** Panorama: uma linha por categoria com o vencedor. Paginado para muitas categorias. */
export function addOverviewSlides(pptx, snapshot) {
  const pages = paginate(snapshot.categories, 9);
  pages.forEach((page, pageIndex) => {
    const slide = pptx.addSlide({ masterName: MASTER.content });
    const suffix = pages.length > 1 ? ` (${pageIndex + 1}/${pages.length})` : '';
    addHeading(slide, 'Visão geral', `Panorama por categoria${suffix}`);

    const header = [
      tableHeaderCell('Categoria'), tableHeaderCell('1º lugar'), tableHeaderCell('Votos', 'right'),
      tableHeaderCell('% válidos', 'right'), tableHeaderCell('Válidos', 'right'), tableHeaderCell('Brancos', 'right'),
    ];
    const body = page.map((c) => {
      const top = c.ranking[0];
      let winner = 'Sem votos válidos';
      if (c.outcome === 'winner') winner = c.winners[0];
      if (c.outcome === 'tie') winner = `Empate: ${c.winners.join(', ')}`;
      const hasWinner = c.outcome !== 'no-votes';
      return [
        tableCell(c.title, { bold: true }),
        tableCell(winner, { highlight: hasWinner, muted: !hasWinner }),
        tableCell(hasWinner ? formatInt(top.votes) : '—', { align: 'right' }),
        tableCell(hasWinner ? formatPercent(top.share) : '—', { align: 'right' }),
        tableCell(formatInt(c.validVotes), { align: 'right' }),
        tableCell(c.allowBlank ? formatInt(c.blankVotes) : '—', { align: 'right', muted: !c.allowBlank }),
      ];
    });

    slide.addTable([header, ...body], {
      x: MARGIN_X, y: 1.85, w: CONTENT_W, colW: [3.3, 4.03, 1.1, 1.3, 1.1, 1.1], rowH: 0.46,
      border: { type: 'solid', color: COLORS.line, pt: 0.75 }, autoPage: false,
    });
  });
}

export function addClosingSlide(pptx, snapshot, resultsHash) {
  const slide = pptx.addSlide({ masterName: MASTER.cover });
  slide.addText('Obrigado pela participação!', {
    x: 1.0, y: 2.2, w: 11.3, h: 1.2, fontFace: FONTS.heading, fontSize: 44, color: COLORS.white, margin: 0,
  });
  slide.addText(snapshot.poll.title, {
    x: 1.0, y: 3.4, w: 11.3, h: 0.7, fontFace: FONTS.body, fontSize: 22, color: COLORS.goldBright, margin: 0, fit: 'shrink',
  });
  slide.addShape('line', { x: 1.0, y: 4.45, w: 2.2, h: 0, line: { color: COLORS.goldBright, width: 2 } });
  slide.addText([
    { text: `Resultado oficial consolidado em ${formatDateTime(snapshot.poll.closedAt)}.`, options: { breakLine: true } },
    { text: `Código de verificação: ${resultsHash.slice(0, 16).toUpperCase()}` },
  ], {
    x: 1.0, y: 4.65, w: 11, h: 0.9, fontFace: FONTS.body, fontSize: 14, color: '9FB0C6', margin: 0, valign: 'top', paraSpaceAfter: 4,
  });
}
