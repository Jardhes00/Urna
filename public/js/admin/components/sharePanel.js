import { h } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';
import { alertBox, toast } from '../../shared/feedback.js';
import { card } from './ui.js';

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback para navegadores/contextos sem a Clipboard API (ex.: HTTP sem TLS).
    const area = h('textarea', { class: 'visually-hidden', readonly: true }, text);
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

/** Cartão com o link público da votação: copiar, compartilhar e abrir. */
export function sharePanel(poll, url) {
  const input = h('input', { class: 'input', type: 'text', readonly: true, value: url, 'aria-label': 'Link da votação', onFocus: (e) => e.target.select() });
  const copyBtn = h('button', { class: 'btn btn--primary', type: 'button' }, icon('copy'), h('span', {}, 'Copiar'));
  copyBtn.addEventListener('click', async () => {
    if (await copyText(url)) toast('Link copiado. Agora é só enviar aos participantes.');
    else { input.select(); toast('Não foi possível copiar automaticamente. Use Ctrl+C.', { type: 'error' }); }
  });

  const shareBtn = navigator.share
    ? h('button', {
      class: 'btn btn--secondary', type: 'button',
      onClick: () => navigator.share({ title: poll.title, text: `Vote em “${poll.title}”:`, url }).catch(() => {}),
    }, icon('share'), h('span', {}, 'Compartilhar'))
    : null;

  const body = [
    poll.status === 'draft'
      ? alertBox('info', 'O link já pode ser enviado, mas só aceitará votos depois que você abrir a votação.')
      : h('p', { class: 'panel-text' }, poll.accessMode === 'token'
        ? 'Envie o link junto com um código para cada pessoa — ou use os links individuais da seção de códigos.'
        : 'Envie este link aos participantes (WhatsApp, e-mail, chat). Não é necessário cadastro.'),
    h('div', { class: 'share-link' }, input, copyBtn),
    h('div', { class: 'btn-row' }, shareBtn,
      h('a', { class: 'btn btn--ghost', href: url, target: '_blank', rel: 'noopener' }, icon('external'), h('span', {}, 'Abrir cédula'))),
  ];
  return card({ title: 'Link da votação', body });
}
