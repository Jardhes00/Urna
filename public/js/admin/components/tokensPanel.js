import { api } from '../../shared/api.js';
import { h, mount, setLoading } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';
import { alertBox, toast } from '../../shared/feedback.js';
import { fmtInt } from '../../shared/format.js';
import { card, kpi } from './ui.js';
import { copyText } from './sharePanel.js';

/** Impressão: uma folha com "bilhetes" recortáveis, cada um com código e link. */
function printCodes(poll, codes, baseUrl) {
  const sheet = h('div', { class: 'print-sheet' },
    h('h1', {}, poll.title),
    h('p', {}, 'Código de participação — válido para um único voto. Acesse o link e digite o código.'),
    h('div', { class: 'print-sheet__grid' }, codes.map((code) => h('div', { class: 'print-ticket' },
      h('span', {}, 'Seu código'), h('strong', {}, code), h('span', {}, `${baseUrl}?c=${code}`)))));
  document.body.append(sheet);
  document.body.classList.add('printing-codes');
  const done = () => { sheet.remove(); document.body.classList.remove('printing-codes'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
  setTimeout(done, 1000);
}

/**
 * Gestão dos códigos de uso único. Mostra apenas QUANTOS foram usados — nunca
 * quais —, para que o painel não sirva para rastrear a participação de ninguém.
 */
export function tokensPanel(poll, voteUrl, { onChange, handleError }) {
  const stats = poll.tokens || { total: 0, used: 0 };
  const listArea = h('div', {});
  const canGenerate = poll.status !== 'closed';

  const countInput = h('input', { id: 'token-count', class: 'input', type: 'number', min: '1', max: '500', value: '20', inputmode: 'numeric' });
  const generateBtn = h('button', { class: 'btn btn--primary', type: 'submit' }, icon('key'), h('span', {}, 'Gerar'));
  const form = h('form', { class: 'token-generate', novalidate: true },
    h('div', { class: 'field' }, h('label', { class: 'label', for: 'token-count' }, 'Quantidade de novos códigos'), countInput),
    generateBtn);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const count = Number(countInput.value);
    if (!Number.isInteger(count) || count < 1 || count > 500) {
      toast('Informe um número entre 1 e 500.', { type: 'error' });
      countInput.focus();
      return;
    }
    setLoading(generateBtn);
    try {
      await api.post(`/api/admin/polls/${poll.id}/tokens`, { count });
      toast(`${fmtInt(count)} códigos gerados.`);
      onChange();
    } catch (err) {
      setLoading(generateBtn, false);
      if (!handleError(err)) toast(err.message, { type: 'error' });
    }
  });

  const showBtn = h('button', { class: 'btn btn--secondary', type: 'button' }, icon('eye'), h('span', {}, 'Ver códigos'));
  showBtn.addEventListener('click', async () => {
    setLoading(showBtn);
    try {
      const { codes } = await api.get(`/api/admin/polls/${poll.id}/tokens`);
      setLoading(showBtn, false);
      const lines = codes.map((c) => `${c}  ${voteUrl}?c=${c}`).join('\n');
      mount(listArea,
        h('div', { class: 'codes-grid', role: 'list', 'aria-label': 'Códigos de participação' }, codes.map((c) => h('div', { class: 'code-chip', role: 'listitem' }, c))),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn btn--secondary btn--sm', type: 'button', onClick: async () => { if (await copyText(lines)) toast('Códigos e links individuais copiados.'); } }, icon('copy'), h('span', {}, 'Copiar com links')),
          h('button', { class: 'btn btn--secondary btn--sm', type: 'button', onClick: () => printCodes(poll, codes, voteUrl) }, icon('printer'), h('span', {}, 'Imprimir'))));
    } catch (err) {
      setLoading(showBtn, false);
      if (!handleError(err)) toast(err.message, { type: 'error' });
    }
  });

  return card({
    title: 'Códigos de participação',
    body: [
      h('div', { class: 'token-stats' }, kpi('Códigos gerados', fmtInt(stats.total)), kpi('Já utilizados', fmtInt(stats.used))),
      stats.total === 0 && poll.status !== 'closed'
        ? alertBox('warning', 'Gere os códigos antes de compartilhar: sem código, ninguém consegue votar.')
        : null,
      h('p', { class: 'panel-text' }, 'Distribua um código por pessoa, sem anotar quem recebeu qual. O painel mostra apenas quantos foram usados, não quais.'),
      canGenerate ? form : null,
      stats.total > 0 ? showBtn : null,
      listArea,
    ],
  });
}
