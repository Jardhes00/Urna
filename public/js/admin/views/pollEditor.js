import { api } from '../../shared/api.js';
import { focusHeading, h, mount, setLoading } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';
import { alertBox, confirmDialog, toast } from '../../shared/feedback.js';
import { toLocalInput } from '../../shared/format.js';
import { backLink, iconButton, loadingBlock } from '../components/ui.js';
import { LIMITS, parseOptions, toPayload, validatePollForm } from '../pollValidation.js';
import { optionImagesField } from '../components/optionImages.js';

let keySeq = 0;
const optionName = (o) => (typeof o === 'string' ? o : o.name);
const newCategory = (data = {}) => ({
  key: ++keySeq,
  title: data.title || '',
  description: data.description || '',
  optionsText: (data.options || []).map(optionName).join('\n'),
  allowBlank: data.allowBlank !== false,
  // nome da alternativa → { imageId, imageUrl }
  images: Object.fromEntries((data.options || []).filter((o) => o.imageId).map((o) => [o.name, { imageId: o.imageId, imageUrl: o.imageUrl }])),
});

/* ---------- Campos reutilizáveis ---------- */

function errorFor(errors, key, id) {
  return errors[key] ? h('p', { class: 'field-error', id }, icon('alert'), h('span', {}, errors[key])) : null;
}

function textField({ id, label, value, onInput, errors, errorKey, hint, optional, multiline, max, placeholder, className = '' }) {
  const errId = `${id}-error`;
  const hintId = hint ? `${id}-hint` : null;
  const describedBy = [hintId, errors[errorKey] ? errId : null].filter(Boolean).join(' ') || null;
  const counter = max ? h('span', { class: 'counter', 'aria-hidden': 'true' }, `${value.length}/${max}`) : null;
  const control = h(multiline ? 'textarea' : 'input', {
    id, class: `${multiline ? 'textarea' : 'input'} ${className}`, value, placeholder,
    'aria-invalid': errors[errorKey] ? 'true' : null, 'aria-describedby': describedBy, 'data-error-key': errorKey,
    ...(multiline ? {} : { type: 'text' }),
  });
  control.addEventListener('input', () => {
    onInput(control.value);
    // O erro some assim que o campo é editado; nova validação ocorre ao salvar.
    if (errors[errorKey]) {
      delete errors[errorKey];
      control.removeAttribute('aria-invalid');
      document.getElementById(errId)?.remove();
    }
    if (counter) counter.textContent = `${control.value.length}/${max}`;
  });
  return h('div', { class: 'field' },
    h('label', { class: 'label', for: id }, label, optional ? h('span', { class: 'optional' }, ' (opcional)') : null),
    hint ? h('p', { class: 'hint', id: hintId }, hint) : null,
    control,
    counter,
    errorFor(errors, errorKey, errId));
}

/* ---------- Tela ---------- */

export async function renderPollEditor(view, params, ctx) {
  const pollId = params[0] ? Number(params[0]) : null;
  const container = h('div', { class: 'container' });
  mount(view, container);

  const { optionImages } = await api.get('/api/admin/config');

  let form = {
    title: '', description: '', accessMode: 'link', closesAt: '',
    categories: [newCategory()],
  };

  if (pollId) {
    mount(container, loadingBlock('Carregando votação…'));
    try {
      const poll = await api.get(`/api/admin/polls/${pollId}`);
      if (poll.status !== 'draft') {
        toast('Só é possível editar votações em rascunho.', { type: 'error' });
        ctx.navigate(`/polls/${pollId}`);
        return null;
      }
      form = {
        title: poll.title, description: poll.description, accessMode: poll.accessMode,
        closesAt: toLocalInput(poll.closesAt), categories: poll.categories.map(newCategory),
      };
    } catch (err) {
      if (ctx.handleError(err)) return null;
      throw err;
    }
  }

  let errors = {};
  let dirty = false;
  let saving = false;
  const markDirty = () => { dirty = true; };
  const beforeUnload = (e) => { if (dirty && !saving) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', beforeUnload);

  function categoryCard(cat, index) {
    const p = `categories.${index}`;
    const count = h('span', { class: 'counter' });
    const updateCount = () => {
      const n = parseOptions(cat.optionsText).length;
      count.textContent = `${n} ${n === 1 ? 'opção' : 'opções'}`;
    };
    updateCount();

    const optionsField = textField({
      id: `cat-${cat.key}-options`, label: 'Opções (uma por linha)', value: cat.optionsText, multiline: true,
      className: 'textarea--options', errors, errorKey: `${p}.options`,
      hint: `De ${LIMITS.optionsMin} a ${LIMITS.optionsMax} opções. Você pode colar uma lista.`,
      placeholder: 'Ana Souza\nBruno Lima\nCarla Dias',
      onInput: (v) => {
        cat.optionsText = v;
        updateCount();
        markDirty();
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => images.refresh(), 400);
      },
    });
    optionsField.append(count);
    let refreshTimer;
    const images = optionImagesField({ pollId, cat, onChange: markDirty, handleError: ctx.handleError });

    const blankSwitch = h('label', { class: 'switch' },
      h('input', { type: 'checkbox', role: 'switch', checked: cat.allowBlank, onChange: (e) => { cat.allowBlank = e.target.checked; markDirty(); } }),
      h('span', {}, 'Permitir voto em branco'));

    return h('div', { class: 'category-card', 'data-key': cat.key },
      h('div', { class: 'category-card__head' },
        h('h3', {}, `Categoria ${index + 1}`),
        h('div', { class: 'category-card__tools' },
          iconButton('chevronUp', `Mover categoria ${index + 1} para cima`, () => move(index, -1), { disabled: index === 0 }),
          iconButton('chevronDown', `Mover categoria ${index + 1} para baixo`, () => move(index, 1), { disabled: index === form.categories.length - 1 }),
          iconButton('trash', `Remover categoria ${index + 1}`, () => remove(index), { danger: true, disabled: form.categories.length === 1 }))),
      h('div', { class: 'category-card__body' },
        h('div', { class: 'category-card__row' },
          textField({ id: `cat-${cat.key}-title`, label: 'Nome da categoria', value: cat.title, errors, errorKey: `${p}.title`, placeholder: 'Ex.: Melhor colaborador', onInput: (v) => { cat.title = v; markDirty(); } }),
          textField({ id: `cat-${cat.key}-desc`, label: 'Descrição', optional: true, value: cat.description, errors, errorKey: `${p}.description`, placeholder: 'Explique o critério desta categoria', onInput: (v) => { cat.description = v; markDirty(); } })),
        optionsField,
        optionImages ? images.element : null,
        blankSwitch));
  }

  function move(index, delta) {
    const [cat] = form.categories.splice(index, 1);
    form.categories.splice(index + delta, 0, cat);
    errors = {};
    markDirty();
    draw();
    container.querySelector(`[data-key="${cat.key}"] .icon-btn:not(:disabled)`)?.focus();
  }

  async function remove(index) {
    const cat = form.categories[index];
    const hasContent = cat.title.trim() || cat.optionsText.trim();
    if (hasContent && !(await confirmDialog({
      title: 'Remover categoria?', message: `A categoria “${cat.title || `Categoria ${index + 1}`}” e suas opções serão removidas deste formulário.`,
      confirmLabel: 'Remover', danger: true, iconName: 'trash',
    }))) return;
    form.categories.splice(index, 1);
    errors = {};
    markDirty();
    draw();
  }

  function addCategory() {
    const cat = newCategory();
    form.categories.push(cat);
    markDirty();
    draw();
    document.getElementById(`cat-${cat.key}-title`)?.focus();
  }

  function accessChoice(value, title, desc) {
    return h('label', { class: 'choice' },
      h('input', { type: 'radio', name: 'accessMode', value, checked: form.accessMode === value, onChange: () => { form.accessMode = value; markDirty(); } }),
      h('span', { class: 'choice__body' }, h('span', { class: 'choice__radio' }),
        h('span', {}, h('span', { class: 'choice__title' }, title), h('span', { class: 'choice__desc' }, desc))));
  }

  const saveButton = h('button', { class: 'btn btn--primary', type: 'submit' }, icon('check'), h('span', {}, pollId ? 'Salvar alterações' : 'Salvar rascunho'));

  function draw() {
    const errorCount = Object.keys(errors).length;
    const closesAtInput = h('input', {
      id: 'poll-closes', class: 'input', type: 'datetime-local', value: form.closesAt,
      'aria-describedby': 'poll-closes-hint', 'aria-invalid': errors.closesAt ? 'true' : null, 'data-error-key': 'closesAt',
    });
    closesAtInput.addEventListener('input', () => { form.closesAt = closesAtInput.value; markDirty(); });

    const formEl = h('form', { class: 'editor', novalidate: true },
      errorCount ? alertBox('danger', h('strong', {}, 'Revise os campos destacados. '), `${errorCount} ${errorCount === 1 ? 'problema encontrado' : 'problemas encontrados'}.`) : null,

      h('section', { class: 'card editor-section' }, h('div', { class: 'card__body' },
        h('h2', {}, 'Informações'),
        textField({ id: 'poll-title', label: 'Título da votação', value: form.title, errors, errorKey: 'title', max: LIMITS.title, placeholder: 'Ex.: Prêmio Destaques 2026', onInput: (v) => { form.title = v; markDirty(); } }),
        textField({ id: 'poll-desc', label: 'Descrição', optional: true, multiline: true, value: form.description, errors, errorKey: 'description', max: LIMITS.description, hint: 'Aparece na tela inicial da cédula e na capa da apresentação.', onInput: (v) => { form.description = v; markDirty(); } }))),

      h('section', { class: 'card editor-section' }, h('div', { class: 'card__body' },
        h('h2', {}, 'Participação'),
        h('p', { class: 'hint' }, 'Como evitar votos repetidos sem pedir identificação.'),
        h('div', { class: 'choice-grid choice-grid--2', role: 'radiogroup', 'aria-label': 'Forma de participação' },
          accessChoice('link', 'Link aberto', 'Um único link para todos. Cada navegador vota uma vez. Mais simples, mas quem trocar de navegador ou limpar os dados consegue votar de novo.'),
          accessChoice('token', 'Códigos individuais', 'Cada pessoa recebe um código de uso único. Garante um voto por código. Os códigos não são ligados ao voto.')),
        h('div', { class: 'field' },
          h('label', { class: 'label', for: 'poll-closes' }, 'Encerramento automático', h('span', { class: 'optional' }, ' (opcional)')),
          h('p', { class: 'hint', id: 'poll-closes-hint' }, 'Se definido, a votação para de aceitar votos neste horário. Você também pode encerrar manualmente.'),
          h('div', { class: 'btn-row' }, closesAtInput,
            form.closesAt ? h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onClick: () => { form.closesAt = ''; markDirty(); draw(); } }, 'Remover data') : null),
          errorFor(errors, 'closesAt', 'poll-closes-error')))),

      h('section', { class: 'card editor-section' }, h('div', { class: 'card__body' },
        h('h2', {}, 'Categorias e opções'),
        h('p', { class: 'hint' }, 'Os participantes escolhem uma opção em cada categoria. Cada categoria gera seu próprio ranking.'),
        errors.categories ? alertBox('danger', errors.categories) : null,
        h('div', {}, form.categories.map(categoryCard)),
        form.categories.length < LIMITS.categories
          ? h('button', { class: 'btn btn--secondary btn--block', type: 'button', onClick: addCategory }, icon('plus'), h('span', {}, 'Adicionar categoria'))
          : h('p', { class: 'hint' }, `Limite de ${LIMITS.categories} categorias atingido.`))),

      h('div', { class: 'editor-footer' },
        h('a', { class: 'btn btn--secondary', href: pollId ? `#/polls/${pollId}` : '#/' }, 'Cancelar'),
        saveButton));

    formEl.addEventListener('submit', submit);
    mount(container,
      backLink(pollId ? `#/polls/${pollId}` : '#/', pollId ? 'Voltar à votação' : 'Votações'),
      h('div', { class: 'page-head' }, h('div', {},
        h('h1', {}, pollId ? 'Editar votação' : 'Nova votação'),
        h('p', { class: 'page-head__meta' }, 'A votação é salva como rascunho. Você poderá revisá-la antes de abrir.'))),
      formEl);
  }

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    errors = validatePollForm(form);
    if (Object.keys(errors).length) return showErrors();

    saving = true;
    setLoading(saveButton);
    try {
      const payload = toPayload(form);
      const poll = pollId ? await api.put(`/api/admin/polls/${pollId}`, payload) : await api.post('/api/admin/polls', payload);
      dirty = false;
      toast(pollId ? 'Alterações salvas.' : 'Votação criada como rascunho.');
      ctx.navigate(`/polls/${poll.id}`);
    } catch (err) {
      saving = false;
      setLoading(saveButton, false);
      if (ctx.handleError(err)) return;
      errors = err.details || {};
      if (!Object.keys(errors).length) toast(err.message, { type: 'error', duration: 6000 });
      else showErrors();
    }
  }

  function showErrors() {
    draw();
    const first = container.querySelector('[aria-invalid="true"]');
    if (first) first.focus();
    else container.querySelector('.alert')?.scrollIntoView({ block: 'center' });
  }

  draw();
  focusHeading(container);
  return () => window.removeEventListener('beforeunload', beforeUnload);
}
