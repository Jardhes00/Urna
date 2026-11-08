import { api, ApiError } from '../shared/api.js';
import { focusHeading, mount, setLoading, h } from '../shared/dom.js';
import { icon } from '../shared/icons.js';
import { clearDraft, getVoterKey, loadDraft, saveDraft } from './storage.js';
import * as views from './views.js';
import { stickers } from '../shared/celebrate.js';
import { QUIPS, deck, pickEmojis, pickQuip } from '../shared/quips.js';

const root = document.getElementById('app');
const publicId = decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] || '');
const voterKey = getVoterKey(publicId);
const endpoint = `/api/public/polls/${encodeURIComponent(publicId)}`;

const state = {
  poll: null,
  step: 'loading',
  index: 0,
  choices: {}, // categoryId -> optionId | null (branco)
  code: '',
  // Se um envio anterior falhou por rede, um "já votou" posterior com a MESMA
  // chave significa que aquele envio chegou ao servidor: é sucesso, não erro.
  pendingSubmit: false,
};

function render(node, { focus = true } = {}) {
  mount(root, node);
  if (focus) focusHeading(root);
  window.scrollTo({ top: 0 });
}

// Cada categoria mantém a mesma referência enquanto a página estiver aberta (voltar não troca a piada).
const nextQuip = deck(QUIPS.general);
const quipByCategory = new Map();
function quipFor(category) {
  if (!quipByCategory.has(category.id)) {
    const aboutLuiza = category.options.some((o) => /luiza/i.test(o.name));
    quipByCategory.set(category.id, aboutLuiza ? QUIPS.luiza : nextQuip());
  }
  return quipByCategory.get(category.id);
}

function persist() {
  saveDraft(publicId, { choices: state.choices, index: state.index, step: state.step, code: state.code, pendingSubmit: state.pendingSubmit });
}

const reloadButton = () => h('button', { class: 'btn btn--secondary', type: 'button', onClick: () => location.reload() }, icon('refresh'), h('span', {}, 'Tentar novamente'));

function showStatusScreen(kind) {
  const screens = {
    unavailable: { iconName: 'lock', title: 'Votação indisponível', text: 'Esta votação ainda não foi aberta pelo organizador. Tente novamente mais tarde ou confirme o link recebido.', action: reloadButton(), quip: pickQuip('unavailable') },
    closed: { iconName: 'lock', title: 'Votação encerrada', text: 'O período de votação terminou e novos votos não são mais aceitos. Os resultados serão divulgados pelo organizador.', quip: pickQuip('closed') },
    notFound: { iconName: 'alert', tone: 'danger', title: 'Link inválido', text: 'Não encontramos esta votação. Confira se o link foi copiado por completo.', quip: pickQuip('notFound') },
    already: { iconName: 'checkCircle', tone: 'success', title: 'Você já votou', text: 'Já existe um voto registrado a partir deste navegador nesta votação. Cada participante pode votar apenas uma vez.', quip: pickQuip('already') },
    codeUsed: { iconName: 'checkCircle', tone: 'success', title: 'Código já utilizado', text: 'Este código de participação já foi usado para votar. Cada código vale para um único voto.', quip: pickQuip('already') },
  };
  state.step = kind;
  render(views.messageView(screens[kind]));
}

function showError(err) {
  render(views.messageView({
    iconName: err.code === 'NETWORK_ERROR' || err.code === 'TIMEOUT' ? 'wifiOff' : 'alert',
    tone: 'danger', title: 'Não foi possível carregar', text: err.message, action: reloadButton(),
  }));
}

/* ---------- Fluxo ---------- */

// Pausa entre o toque e a troca de tela: tempo de ver a opção marcada.
const AUTO_ADVANCE_MS = 320;
let advanceTimer = null;

function goToCategory(index, error) {
  clearTimeout(advanceTimer);
  state.step = 'category';
  state.index = index;
  persist();
  const category = state.poll.categories[index];
  const isLast = index === state.poll.categories.length - 1;
  const next = () => (isLast ? goToReview() : goToCategory(index + 1));

  render(views.categoryView(state.poll, index, state.choices, {
    error,
    quip: quipFor(category),
    onSelect: (optionId, viaPointer) => {
      state.choices[category.id] = optionId;
      persist();
      clearTimeout(advanceTimer);
      if (viaPointer) advanceTimer = setTimeout(() => { if (state.step === 'category' && state.index === index) next(); }, AUTO_ADVANCE_MS);
    },
    onBack: () => (index === 0 ? goToStart() : goToCategory(index - 1)),
    onNext: () => {
      if (!(category.id in state.choices)) {
        return goToCategory(index, category.allowBlank
          ? 'Escolha uma opção ou marque “Votar em branco” para continuar.'
          : 'Escolha uma opção para continuar.');
      }
      return next();
    },
  }), { focus: true });
}

function goToStart() {
  if (state.poll.accessMode === 'token') return goToCode();
  if (state.poll.categories.length > 1 || state.poll.description) {
    state.step = 'intro';
    persist();
    return render(views.introView(state.poll, { onStart: () => goToCategory(0) }));
  }
  return goToCategory(0);
}

function goToCode(error) {
  state.step = 'code';
  render(views.codeView(state.poll, {
    initialCode: state.code,
    error,
    onSubmit: async (value, button) => {
      const code = value.trim();
      if (!/^[A-Z0-9]{4}-?[A-Z0-9]{4}$/i.test(code)) return goToCode('Digite os 8 caracteres do código.');
      setLoading(button);
      try {
        await api.post(`${endpoint}/check-code`, { code });
        state.code = code;
        persist();
        goToCategory(0);
      } catch (err) {
        setLoading(button, false);
        if (err.code === 'ALREADY_VOTED') return showStatusScreen('codeUsed');
        if (err.code === 'POLL_CLOSED') return showStatusScreen('closed');
        state.code = code;
        goToCode(err.message);
      }
    },
  }));
}

function goToReview(error) {
  clearTimeout(advanceTimer);
  state.step = 'review';
  persist();
  render(views.reviewView(state.poll, state.choices, {
    error,
    onEdit: (i) => goToCategory(i),
    onBack: () => goToCategory(state.poll.categories.length - 1),
    onConfirm: submit,
  }), { focus: !error });
}

let submitting = false;
async function submit(button) {
  if (submitting) return; // impede cliques duplos
  submitting = true;
  setLoading(button);

  const body = {
    choices: state.poll.categories.map((c) => ({ categoryId: c.id, optionId: state.choices[c.id] })),
    ...(state.poll.accessMode === 'token' ? { code: state.code } : { voterKey }),
  };

  try {
    await api.post(`${endpoint}/ballots`, body, { timeoutMs: 20000 });
    finish();
  } catch (err) {
    if (err.code === 'ALREADY_VOTED') {
      if (state.pendingSubmit) return finish();
      clearDraft(publicId);
      return showStatusScreen(state.poll.accessMode === 'token' ? 'codeUsed' : 'already');
    }
    if (err.code === 'POLL_CLOSED') { clearDraft(publicId); return showStatusScreen('closed'); }
    if (err.code === 'NETWORK_ERROR' || err.code === 'TIMEOUT') {
      state.pendingSubmit = true;
      persist();
    }
    if (err.code === 'INVALID_CODE') { state.code = ''; return goToCode(err.message); }
    goToReview(`${err.message} Suas escolhas foram mantidas — toque em “Confirmar voto” para tentar de novo.`);
  } finally {
    submitting = false;
  }
}

function finish() {
  clearDraft(publicId);
  state.step = 'success';
  render(views.successView(state.poll));
}

/* ---------- Início ---------- */

async function init() {
  document.body.append(stickers(pickEmojis(6)));
  render(views.loadingView(), { focus: false });
  if (!publicId) return showStatusScreen('notFound');

  let poll;
  try {
    poll = await api.get(endpoint, { headers: { 'X-Voter-Key': voterKey } });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return showStatusScreen('notFound');
    return showError(err);
  }

  state.poll = poll;
  document.title = poll.title;
  if (poll.status === 'unavailable') return showStatusScreen('unavailable');
  if (poll.status === 'closed') return showStatusScreen('closed');

  const draft = loadDraft(publicId);
  if (draft) Object.assign(state, { choices: draft.choices || {}, code: draft.code || '', pendingSubmit: Boolean(draft.pendingSubmit) });

  if (poll.hasVoted) {
    if (state.pendingSubmit) return finish();
    return showStatusScreen('already');
  }

  // Link individual com código: /v/abc?c=ABCD-2345 (removido da barra de endereço em seguida).
  const params = new URLSearchParams(location.search);
  if (params.get('c')) {
    state.code = params.get('c').toUpperCase();
    history.replaceState(null, '', location.pathname);
  }

  // Descarta escolhas de opções que não existem mais.
  const valid = new Map(poll.categories.map((c) => [String(c.id), c]));
  for (const [cid, oid] of Object.entries(state.choices)) {
    const c = valid.get(cid);
    if (!c || (oid === null ? !c.allowBlank : !c.options.some((o) => o.id === oid))) delete state.choices[cid];
  }

  if (draft && poll.accessMode === 'link' && ['category', 'review'].includes(draft.step)) {
    return draft.step === 'review' && Object.keys(state.choices).length === poll.categories.length
      ? goToReview()
      : goToCategory(Math.min(draft.index || 0, poll.categories.length - 1));
  }
  goToStart();
}

init();
