import { api } from '../../shared/api.js';
import { h, mount, setLoading } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';

export function renderLogin(view, { onSuccess }) {
  const input = h('input', {
    id: 'admin-password', class: 'input', type: 'password', name: 'password', autocomplete: 'current-password',
    required: true, 'aria-describedby': 'login-error',
  });
  const toggle = h('button', { class: 'input-group__btn', type: 'button', 'aria-label': 'Mostrar senha', 'aria-pressed': 'false' }, icon('eye'));
  toggle.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(show));
    toggle.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
    mount(toggle, icon(show ? 'eyeOff' : 'eye'));
  });

  const error = h('p', { class: 'field-error', id: 'login-error', hidden: true });
  const button = h('button', { class: 'btn btn--primary btn--lg btn--block', type: 'submit' }, h('span', {}, 'Entrar'));

  const showError = (message) => {
    mount(error, icon('alert'), h('span', {}, message));
    error.hidden = false;
    input.setAttribute('aria-invalid', 'true');
    input.focus();
  };

  const form = h('form', { class: 'stack', novalidate: true },
    h('div', { class: 'field' },
      h('label', { class: 'label', for: 'admin-password' }, 'Senha do administrador'),
      h('div', { class: 'input-group' }, input, toggle),
      error),
    button);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!input.value) return showError('Digite a senha.');
    setLoading(button);
    try {
      await api.post('/api/auth/login', { password: input.value });
      onSuccess();
    } catch (err) {
      setLoading(button, false);
      showError(err.message);
    }
  });

  view.className = 'admin-main admin-main--flush';
  mount(view, h('div', { class: 'login theme-night stage-glow' },
    h('div', { class: 'card login__card' }, h('div', { class: 'card__body' },
      h('div', { class: 'login__emblem', 'aria-hidden': 'true' }, icon('lock')),
      h('h1', {}, 'Área do organizador'),
      h('p', { class: 'muted' }, 'Acesso restrito a quem administra as votações. Participantes não precisam de senha: eles votam pelo link.'),
      form))));
  input.focus();
}
