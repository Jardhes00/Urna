const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat('pt-BR');

export const fmtPercent = (fraction) => percent.format(fraction || 0);
export const fmtInt = (n) => integer.format(n || 0);
export const plural = (n, one, many) => `${fmtInt(n)} ${n === 1 ? one : many}`;

export function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function fmtTime(date = new Date()) {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Converte ISO para o valor aceito por <input type="datetime-local"> (horário local). */
export function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "Categoria 3 - Melhor Novato" → "Melhor Novato": o número já aparece em outro lugar da tela. */
export const categoryName = (title) => String(title).replace(/^categoria\s*\d+\s*[-–—:.]\s*/i, '') || title;

export const STATUS_LABEL ={ draft: 'Rascunho', open: 'Aberta', closed: 'Encerrada' };
