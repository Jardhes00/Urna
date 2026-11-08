/**
 * Cliente HTTP da aplicação: JSON, tempo limite, mensagens de erro em português
 * e repetição automática apenas para leituras (GET) com falha de rede.
 */
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const NETWORK_MESSAGE = 'Sem conexão com o servidor. Verifique sua internet e tente novamente.';

async function attempt(method, url, { body, headers, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    const timeout = err?.name === 'AbortError';
    throw new ApiError(0, timeout ? 'TIMEOUT' : 'NETWORK_ERROR', timeout ? 'O servidor demorou para responder. Tente novamente.' : NETWORK_MESSAGE);
  } finally {
    clearTimeout(timer);
  }
  return res;
}

export async function request(method, url, { body, headers = {}, timeoutMs = 15000, retries = method === 'GET' ? 2 : 0 } = {}) {
  let res;
  for (let i = 0; ; i++) {
    try {
      res = await attempt(method, url, { body, headers, timeoutMs });
      break;
    } catch (err) {
      if (i >= retries) throw err;
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }

  if (res.status === 204) return null;
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    const e = data?.error;
    throw new ApiError(res.status, e?.code || 'HTTP_ERROR', e?.message || `Erro inesperado (${res.status}).`, e?.details);
  }
  return data;
}

export const api = {
  get: (url, opts) => request('GET', url, opts),
  post: (url, body = {}, opts) => request('POST', url, { ...opts, body }),
  put: (url, body = {}, opts) => request('PUT', url, { ...opts, body }),
  del: (url, opts) => request('DELETE', url, opts),
};

/** Envia um arquivo binário (ex.: imagem JPEG) no corpo da requisição. */
export async function uploadBinary(url, blob) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST', credentials: 'same-origin', body: blob, signal: controller.signal,
      headers: { Accept: 'application/json', 'Content-Type': blob.type },
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', NETWORK_MESSAGE);
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error?.code || 'HTTP_ERROR', data?.error?.message || 'Não foi possível enviar a imagem.');
  return data;
}

/** Baixa um arquivo via fetch (permite mostrar carregamento e tratar erros). */
export async function downloadFile(url) {
  const res = await attempt('GET', url, { headers: {}, timeoutMs: 120000 });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(res.status, data?.error?.code || 'HTTP_ERROR', data?.error?.message || 'Não foi possível gerar o arquivo.');
  }
  const disposition = res.headers.get('content-disposition') || '';
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] || 'arquivo';
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10000);
  return filename;
}
