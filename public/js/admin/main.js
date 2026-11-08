import { api } from '../shared/api.js';
import { mount, h } from '../shared/dom.js';
import { toast } from '../shared/feedback.js';
import { renderLogin } from './views/login.js';
import { renderPollList } from './views/pollList.js';
import { renderPollEditor } from './views/pollEditor.js';
import { renderPollDetail } from './views/pollDetail.js';
import { renderPresentation } from './views/presentation.js';

const view = document.getElementById('view');
const nav = document.getElementById('admin-nav');

const ROUTES = [
  { pattern: /^\/$/, render: renderPollList },
  { pattern: /^\/new$/, render: renderPollEditor },
  { pattern: /^\/polls\/(\d+)$/, render: renderPollDetail },
  { pattern: /^\/polls\/(\d+)\/edit$/, render: renderPollEditor },
  { pattern: /^\/polls\/(\d+)\/present$/, render: renderPresentation },
];

let cleanup = null;
let authenticated = false;

/** Contexto passado às telas. */
const ctx = {
  navigate: (path) => { location.hash = `#${path}`; },
  /** Chamado quando a API responde 401: volta ao login sem perder a rota atual. */
  handleError(err) {
    if (err?.status === 401) {
      authenticated = false;
      showLogin();
      return true;
    }
    return false;
  },
};

function currentPath() {
  return location.hash.replace(/^#/, '') || '/';
}

async function route() {
  if (cleanup) { cleanup(); cleanup = null; }
  if (!authenticated) return showLogin();

  nav.hidden = false;
  const path = currentPath();
  const match = ROUTES.map((r) => ({ r, m: r.pattern.exec(path) })).find((x) => x.m);
  if (!match) {
    ctx.navigate('/');
    return;
  }
  view.className = 'admin-main';
  mount(view);
  try {
    cleanup = (await match.r.render(view, match.m.slice(1), ctx)) || null;
  } catch (err) {
    if (!ctx.handleError(err)) {
      mount(view, h('div', { class: 'container' }, h('div', { class: 'card' }, h('div', { class: 'card__body' },
        h('h1', {}, 'Algo deu errado'), h('p', { class: 'muted' }, err.message || 'Erro inesperado.'),
        h('button', { class: 'btn btn--primary', type: 'button', onClick: route }, 'Tentar novamente')))));
    }
  }
}

function showLogin() {
  nav.hidden = true;
  if (cleanup) { cleanup(); cleanup = null; }
  renderLogin(view, {
    onSuccess: () => {
      authenticated = true;
      route();
    },
  });
}

document.getElementById('logout-btn').addEventListener('click', async () => {
  try { await api.post('/api/auth/logout'); } catch { /* sessão já inválida */ }
  authenticated = false;
  toast('Você saiu do painel.');
  showLogin();
});

window.addEventListener('hashchange', route);

(async function init() {
  try {
    ({ authenticated } = await api.get('/api/auth/session'));
  } catch {
    authenticated = false;
  }
  route();
})();
