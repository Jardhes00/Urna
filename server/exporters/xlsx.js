import ExcelJS from 'exceljs';
import { COLORS, formatDateTime } from './theme.js';

const RANKING_SHEET = 'Ranking completo';
const REF = `'${RANKING_SHEET}'`;

const argb = (hex) => `FF${hex}`;
const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(COLORS.navy) } };
const headerFont = { bold: true, color: { argb: argb(COLORS.white) } };
const thinBorder = { style: 'thin', color: { argb: argb(COLORS.line) } };
const border = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

const ACCESS_LABEL = {
  link: 'Link público (uma participação por navegador)',
  token: 'Códigos individuais de uso único',
};

function styleHeader(row) {
  row.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.border = border;
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  row.height = 22;
}

/**
 * Aba "Ranking completo": uma linha por opção. Posição, percentual e empate
 * são FÓRMULAS (recalculam se o arquivo for editado), com o resultado oficial
 * já gravado como valor em cache para abrir corretamente em qualquer programa.
 */
function buildRankingSheet(workbook, snapshot) {
  const sheet = workbook.addWorksheet(RANKING_SHEET, { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [
    { header: 'Categoria', key: 'category', width: 34 },
    { header: 'Posição', key: 'rank', width: 10 },
    { header: 'Opção', key: 'name', width: 40 },
    { header: 'Votos', key: 'votes', width: 10 },
    { header: '% dos votos válidos', key: 'share', width: 20 },
    { header: 'Empate', key: 'tied', width: 10 },
  ];
  styleHeader(sheet.getRow(1));

  const rows = snapshot.categories.flatMap((c) => c.ranking.map((r) => ({ category: c.title, ...r, validVotes: c.validVotes })));
  const last = rows.length + 1;
  const range = (col) => `$${col}$2:$${col}$${last}`;

  rows.forEach((r, i) => {
    const n = i + 2;
    const row = sheet.getRow(n);
    row.getCell(1).value = r.category;
    row.getCell(2).value = { formula: `COUNTIFS(${range('A')},A${n},${range('D')},">"&D${n})+1`, result: r.rank };
    row.getCell(3).value = r.name;
    row.getCell(4).value = r.votes;
    row.getCell(5).value = {
      formula: `IF(SUMIFS(${range('D')},${range('A')},A${n})=0,0,D${n}/SUMIFS(${range('D')},${range('A')},A${n}))`,
      result: r.share,
    };
    row.getCell(6).value = { formula: `IF(COUNTIFS(${range('A')},A${n},${range('D')},D${n})>1,"Sim","Não")`, result: r.tied ? 'Sim' : 'Não' };

    row.getCell(2).alignment = { horizontal: 'center' };
    row.getCell(6).alignment = { horizontal: 'center' };
    row.getCell(4).numFmt = '#,##0';
    row.getCell(5).numFmt = '0.0%';
    row.eachCell((cell) => { cell.border = border; });

    if (r.rank === 1 && r.validVotes > 0) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(COLORS.goldSoft) } };
        cell.font = { bold: true };
      });
    }
  });

  if (rows.length) sheet.autoFilter = { from: 'A1', to: `F${last}` };
}

function buildSummarySheet(workbook, snapshot, resultsHash, rankingLast) {
  const sheet = workbook.addWorksheet('Resumo');
  sheet.columns = [
    { width: 34 }, { width: 12 }, { width: 14 }, { width: 12 }, { width: 12 },
    { width: 12 }, { width: 36 }, { width: 14 }, { width: 14 },
  ];

  sheet.mergeCells('A1:I1');
  sheet.getCell('A1').value = snapshot.poll.title;
  sheet.getCell('A1').font = { bold: true, size: 18, color: { argb: argb(COLORS.navy) } };
  sheet.getRow(1).height = 30;
  sheet.mergeCells('A2:I2');
  sheet.getCell('A2').value = 'Resultado oficial — votação encerrada';
  sheet.getCell('A2').font = { italic: true, color: { argb: argb(COLORS.muted) } };

  const info = [
    ['Descrição', snapshot.poll.description || '—'],
    ['Abertura', formatDateTime(snapshot.poll.openedAt)],
    ['Encerramento', formatDateTime(snapshot.poll.closedAt)],
    ['Forma de participação', ACCESS_LABEL[snapshot.poll.accessMode] || snapshot.poll.accessMode],
    ['Cédulas registradas', snapshot.ballotCount],
    ['Código de verificação', resultsHash.slice(0, 16).toUpperCase()],
  ];
  info.forEach(([label, value], i) => {
    const row = sheet.getRow(4 + i);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true };
    sheet.mergeCells(4 + i, 2, 4 + i, 9);
    row.getCell(2).value = value;
    row.getCell(2).alignment = { horizontal: 'left', wrapText: true };
  });
  const ballotCell = `$B$${4 + info.findIndex(([l]) => l === 'Cédulas registradas')}`;

  const headerRowNumber = 4 + info.length + 2;
  const header = sheet.getRow(headerRowNumber);
  header.values = ['Categoria', 'Opções', 'Votos válidos', 'Brancos', 'Total', '% brancos', '1º lugar', 'Votos do 1º', '% do 1º'];
  styleHeader(header);

  const R = (col) => `${REF}!$${col}$2:$${col}$${rankingLast}`;
  snapshot.categories.forEach((c, i) => {
    const n = headerRowNumber + 1 + i;
    const row = sheet.getRow(n);
    const top = c.ranking[0];
    let winner = 'Sem votos válidos';
    if (c.outcome === 'winner') winner = c.winners[0];
    if (c.outcome === 'tie') winner = `Empate: ${c.winners.join(', ')}`;

    row.getCell(1).value = c.title;
    row.getCell(2).value = { formula: `COUNTIFS(${R('A')},A${n})`, result: c.optionCount };
    row.getCell(3).value = { formula: `SUMIFS(${R('D')},${R('A')},A${n})`, result: c.validVotes };
    row.getCell(4).value = c.blankVotes;
    row.getCell(5).value = { formula: `C${n}+D${n}`, result: c.totalVotes };
    row.getCell(6).value = { formula: `IF(E${n}=0,0,D${n}/E${n})`, result: c.blankShare };
    row.getCell(7).value = winner;
    row.getCell(8).value = c.outcome === 'no-votes' ? 0 : top.votes;
    row.getCell(9).value = c.outcome === 'no-votes' ? 0 : { formula: `IF(C${n}=0,0,H${n}/C${n})`, result: top.share };

    [3, 4, 5, 8].forEach((col) => { row.getCell(col).numFmt = '#,##0'; });
    [6, 9].forEach((col) => { row.getCell(col).numFmt = '0.0%'; });
    row.getCell(2).alignment = { horizontal: 'center' };
    row.eachCell({ includeEmpty: true }, (cell) => { cell.border = border; });
  });

  const first = headerRowNumber + 1;
  const lastCat = headerRowNumber + snapshot.categories.length;
  const totalRow = sheet.getRow(lastCat + 1);
  const totalValid = snapshot.categories.reduce((s, c) => s + c.validVotes, 0);
  const totalBlank = snapshot.categories.reduce((s, c) => s + c.blankVotes, 0);
  totalRow.getCell(1).value = 'Total geral';
  totalRow.getCell(2).value = { formula: `SUM(B${first}:B${lastCat})`, result: snapshot.categories.reduce((s, c) => s + c.optionCount, 0) };
  totalRow.getCell(3).value = { formula: `SUM(C${first}:C${lastCat})`, result: totalValid };
  totalRow.getCell(4).value = { formula: `SUM(D${first}:D${lastCat})`, result: totalBlank };
  totalRow.getCell(5).value = { formula: `SUM(E${first}:E${lastCat})`, result: totalValid + totalBlank };
  totalRow.getCell(6).value = {
    formula: `IF(E${lastCat + 1}=0,0,D${lastCat + 1}/E${lastCat + 1})`,
    result: totalValid + totalBlank ? totalBlank / (totalValid + totalBlank) : 0,
  };
  totalRow.font = { bold: true };
  [3, 4, 5].forEach((col) => { totalRow.getCell(col).numFmt = '#,##0'; });
  totalRow.getCell(6).numFmt = '0.0%';
  totalRow.getCell(2).alignment = { horizontal: 'center' };
  for (let col = 1; col <= 9; col++) {
    const cell = totalRow.getCell(col);
    cell.border = border;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(COLORS.canvas) } };
  }

  const checkRow = lastCat + 3;
  sheet.getCell(`A${checkRow}`).value = 'Conferência (cada categoria soma o total de cédulas)';
  sheet.getCell(`A${checkRow}`).font = { italic: true, color: { argb: argb(COLORS.muted) } };
  sheet.getCell(`B${checkRow}`).value = {
    formula: `IF(SUMPRODUCT(--(E${first}:E${lastCat}<>${ballotCell}))=0,"OK","Divergente")`,
    result: snapshot.categories.every((c) => c.totalVotes === snapshot.ballotCount) ? 'OK' : 'Divergente',
  };
  sheet.getCell(`B${checkRow}`).font = { bold: true };

  const notesRow = checkRow + 2;
  [
    'Notas:',
    '• Percentuais calculados sobre os votos válidos; votos em branco não entram no ranking.',
    '• Empates dividem a mesma posição (ex.: 1º, 1º, 3º). Nenhum critério de desempate foi aplicado.',
    '• Esta planilha não contém dados pessoais nem votos individuais — apenas totais agregados.',
  ].forEach((text, i) => {
    sheet.getCell(`A${notesRow + i}`).value = text;
    sheet.getCell(`A${notesRow + i}`).font = i === 0 ? { bold: true } : { color: { argb: argb(COLORS.muted) } };
  });

  return sheet;
}

/** @returns {Promise<Buffer>} */
export async function buildWorkbook(snapshot, resultsHash) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Urna Online';
  workbook.created = new Date(snapshot.poll.closedAt);
  workbook.title = `Resultado — ${snapshot.poll.title}`;

  // O Resumo (primeira aba) referencia o intervalo de linhas do ranking, que é conhecido de antemão.
  const rankingLast = snapshot.categories.reduce((n, c) => n + c.ranking.length, 0) + 1;
  buildSummarySheet(workbook, snapshot, resultsHash, rankingLast);
  buildRankingSheet(workbook, snapshot);
  workbook.views = [{ activeTab: 0 }];

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
