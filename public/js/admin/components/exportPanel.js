import { downloadFile } from '../../shared/api.js';
import { h, setLoading } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';
import { alertBox, toast } from '../../shared/feedback.js';
import { card } from './ui.js';

export const exportUrl = (pollId, type) => `/api/admin/polls/${pollId}/export/${type}`;

export async function runDownload(button, pollId, type, handleError) {
  setLoading(button);
  try {
    const name = await downloadFile(exportUrl(pollId, type));
    toast(`Arquivo gerado: ${name}`);
  } catch (err) {
    if (!handleError(err)) toast(err.message, { type: 'error', duration: 7000 });
  } finally {
    setLoading(button, false);
  }
}

/** Downloads dos arquivos finais — disponível apenas com o resultado oficial (votação encerrada). */
export function exportPanel(poll, { handleError, verifyCode }) {
  const item = (type, iconName, label, detail) => {
    const btn = h('button', { class: 'btn btn--secondary export-btn', type: 'button', 'data-export': type },icon(iconName), h('span', {}, label), h('small', {}, detail));
    btn.addEventListener('click', () => runDownload(btn, poll.id, type, handleError));
    return btn;
  };

  return card({
    title: 'Arquivos do resultado',
    body: [
      alertBox('success', h('strong', {}, 'Resultado oficial consolidado. '), 'Os arquivos são gerados a partir dos totais validados no encerramento.'),
      h('div', { class: 'export-list' },
        item('pptx', 'slides', 'Baixar apresentação', '.pptx'),
        item('xlsx', 'sheet', 'Baixar planilha', '.xlsx'),
        item('zip', 'archive', 'Baixar os dois', '.zip')),
      h('a', { class: 'btn btn--accent btn--block', href: `#/polls/${poll.id}/present` }, icon('presentation'), h('span', {}, 'Modo apresentação')),
      verifyCode ? h('p', { class: 'panel-text' }, 'Código de verificação: ', h('span', { class: 'verify-code' }, verifyCode)) : null,
    ],
  });
}
