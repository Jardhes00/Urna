import { h } from './dom.js';
import { icon } from './icons.js';

/* ---------- Toasts (avisos rápidos, anunciados a leitores de tela) ---------- */
let region;
function toastRegion() {
  if (!region) {
    region = h('div', { class: 'toast-region', role: 'status', 'aria-live': 'polite' });
    document.body.append(region);
  }
  return region;
}

export function toast(message, { type = 'success', duration = 3500 } = {}) {
  const el = h('div', { class: `toast toast--${type}` },
    icon(type === 'error' ? 'alert' : 'checkCircle'),
    h('span', {}, message));
  toastRegion().append(el);
  setTimeout(() => el.remove(), duration);
}

/* ---------- Alertas inline ---------- */
const ALERT_ICON = { info: 'info', success: 'checkCircle', warning: 'alert', danger: 'alert' };
export function alertBox(type, ...content) {
  return h('div', { class: `alert alert--${type}`, role: type === 'danger' ? 'alert' : null },
    icon(ALERT_ICON[type]), h('div', {}, ...content));
}

/* ---------- Diálogo de confirmação (usa <dialog> nativo: foco preso e Esc) ---------- */
/**
 * @returns {Promise<boolean>}
 * `requireCheck`: texto de uma caixa que precisa ser marcada antes de confirmar
 * (usado em ações irreversíveis, como encerrar a votação).
 */
export function confirmDialog({ title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger = false, iconName, requireCheck }) {
  return new Promise((resolve) => {
    const titleId = `dlg-title-${Date.now()}`;
    const confirmBtn = h('button', { class: `btn ${danger ? 'btn--danger' : 'btn--primary'}`, type: 'button', disabled: Boolean(requireCheck) }, confirmLabel);
    const cancelBtn = h('button', { class: 'btn btn--secondary', type: 'button' }, cancelLabel);
    const check = requireCheck
      ? h('label', { class: 'check-confirm' },
        h('input', { type: 'checkbox', onChange: (e) => { confirmBtn.disabled = !e.target.checked; } }),
        h('span', {}, requireCheck))
      : null;

    const dialog = h('dialog', { class: 'dialog', 'aria-labelledby': titleId },
      h('div', { class: 'dialog__body' },
        h('div', { class: `dialog__icon ${danger ? 'dialog__icon--danger' : ''}` }, icon(iconName || (danger ? 'alert' : 'info'))),
        h('h2', { class: 'dialog__title', id: titleId }, title),
        h('div', { class: 'dialog__text' }, message),
        check),
      h('div', { class: 'dialog__footer' }, cancelBtn, confirmBtn));

    let result = false;
    const close = (value) => { result = value; dialog.close(); };
    cancelBtn.addEventListener('click', () => close(false));
    confirmBtn.addEventListener('click', () => close(true));
    dialog.addEventListener('close', () => { dialog.remove(); resolve(result); });

    document.body.append(dialog);
    dialog.showModal();
    cancelBtn.focus();
  });
}
