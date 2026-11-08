/**
 * Criação de elementos sem innerHTML: todo texto vindo do servidor é inserido
 * como textContent, eliminando riscos de XSS.
 *
 *   h('button', { class: 'btn', onClick: fn, 'aria-label': 'Fechar' }, 'Texto', filho)
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'value') el.value = value;
    else if (key === 'checked' || key === 'disabled' || key === 'selected') el[key] = Boolean(value);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function mount(el, ...children) {
  clear(el);
  append(el, children);
  return el;
}

/** Move o foco para o título principal da nova tela (anuncia a mudança a leitores de tela). */
export function focusHeading(root) {
  const heading = root.querySelector('h1, h2');
  if (!heading) return;
  heading.setAttribute('tabindex', '-1');
  heading.focus({ preventScroll: false });
}

/** Coloca o botão em estado de carregamento; retorna função para restaurar. */
export function setLoading(button, loading = true) {
  button.classList.toggle('is-loading', loading);
  button.disabled = loading;
  button.setAttribute('aria-busy', loading ? 'true' : 'false');
}

let idCounter = 0;
export const uid = (prefix = 'id') => `${prefix}-${++idCounter}`;
