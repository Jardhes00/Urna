/**
 * Armazenamento local do participante. Nada aqui identifica a pessoa:
 *  - chave de participação: 32 bytes aleatórios, um por votação (sem ligação entre votações);
 *  - rascunho da cédula: guardado só na aba atual (sessionStorage) para sobreviver a recarregamentos.
 * Se o navegador bloquear o armazenamento (modo privado restrito), cai para memória.
 */
const memory = new Map();

function safeGet(storage, key) {
  try { return storage.getItem(key); } catch { return memory.get(key) ?? null; }
}
function safeSet(storage, key, value) {
  try { storage.setItem(key, value); } catch { memory.set(key, value); }
}
function safeRemove(storage, key) {
  try { storage.removeItem(key); } catch { memory.delete(key); }
}

function randomKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function getVoterKey(publicId) {
  const key = `urna:chave:${publicId}`;
  let value = safeGet(localStorage, key);
  if (!value || !/^[A-Za-z0-9_-]{22,128}$/.test(value)) {
    value = randomKey();
    safeSet(localStorage, key, value);
  }
  return value;
}

export function loadDraft(publicId) {
  try { return JSON.parse(safeGet(sessionStorage, `urna:rascunho:${publicId}`)) || null; } catch { return null; }
}
export function saveDraft(publicId, draft) {
  safeSet(sessionStorage, `urna:rascunho:${publicId}`, JSON.stringify(draft));
}
export function clearDraft(publicId) {
  safeRemove(sessionStorage, `urna:rascunho:${publicId}`);
}
