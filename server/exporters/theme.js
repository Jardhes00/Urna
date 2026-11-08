/**
 * Identidade visual dos arquivos gerados — espelha os tokens de public/css/tokens.css.
 * Cores sem "#" (formato exigido por PptxGenJS e ExcelJS).
 */
export const COLORS = {
  navy: '0F2A47',
  navyDeep: '0A1D33',
  navySoft: '1E4170',
  ink: '15202E',
  muted: '5B6676',
  line: 'DDE2E8',
  surface: 'FFFFFF',
  canvas: 'F4F6F9',
  gold: 'C8961E',
  goldBright: 'E9B949',
  goldSoft: 'FBF3DF',
  silver: '8A96A8',
  bronze: 'A86B3C',
  blank: 'A7B0BD',
  white: 'FFFFFF',
};

export const FONTS = {
  heading: 'Segoe UI Semibold',
  body: 'Segoe UI',
};

const percentFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1,
});
const intFormatter = new Intl.NumberFormat('pt-BR');

export const formatPercent = (fraction) => percentFormatter.format(fraction);
export const formatInt = (n) => intFormatter.format(n);
export const plural = (n, one, many) => `${formatInt(n)} ${n === 1 ? one : many}`;

export function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: process.env.TZ_DISPLAY || 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function formatDateLong(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: process.env.TZ_DISPLAY || 'America/Sao_Paulo',
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

export const rankLabel = (rank) => `${rank}º`;

/** Nome de arquivo seguro a partir do título da votação. */
export function fileSlug(title) {
  const slug = String(title)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .toLowerCase().slice(0, 60);
  return slug || 'votacao';
}
