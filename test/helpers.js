import { loadConfig } from '../server/config.js';
import { createApp } from '../server/app.js';

export const ADMIN_PASSWORD = 'senha-de-teste-123';

/** Sobe um servidor real (porta aleatória, banco em memória) para testes de ponta a ponta. */
export async function startServer({ file = ':memory:', env = {} } = {}) {
  const config = { ...loadConfig({ ADMIN_PASSWORD, VOTE_RATE_LIMIT: '100000', LOGIN_RATE_LIMIT: '1000', SEED_LEGACY_POLL: '0', OPTION_IMAGES: '1', ...env }), databaseFile: file };
  const silent = { error() {} };
  const instance = createApp(config, { logger: silent });
  const server = await new Promise((resolve) => { const s = instance.app.listen(0, '127.0.0.1', () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return {
    baseUrl,
    db: instance.db,
    async stop() {
      // closeAllConnections: navegadores abrem conexões antecipadas, sem requisição, que prenderiam o close().
      await new Promise((r) => { server.close(r); server.closeAllConnections(); });
      instance.close();
    },
  };
}

/** Cliente HTTP com "pote de cookies" (simula um navegador). */
export function client(baseUrl) {
  let cookie = '';
  async function call(method, path, body, headers = {}) {
    const res = await fetch(baseUrl + path, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers },
      body: body === undefined ? undefined : (typeof body === 'string' || Buffer.isBuffer(body)) ? body : JSON.stringify(body),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const type = res.headers.get('content-type') || '';
    const data = type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
    return { status: res.status, data, headers: res.headers };
  }
  return {
    get: (p, h) => call('GET', p, undefined, h),
    post: (p, b = {}, h) => call('POST', p, b, h),
    put: (p, b, h) => call('PUT', p, b, h),
    del: (p, h) => call('DELETE', p, undefined, h),
  };
}

export async function adminClient(baseUrl) {
  const c = client(baseUrl);
  const res = await c.post('/api/auth/login', { password: ADMIN_PASSWORD });
  if (res.status !== 200) throw new Error(`login falhou: ${res.status}`);
  return c;
}

export const samplePoll = (overrides = {}) => ({
  title: 'Prêmio Destaques 2026',
  description: 'Escolha anual dos destaques da equipe',
  categories: [
    { title: 'Melhor Colaborador', description: 'Quem mais ajudou o time', options: ['Ana Souza', 'Bruno Lima', 'Carla Dias', 'Diego Alves'] },
    { title: 'Ideia do Ano', allowBlank: false, options: ['Automação de relatórios', 'Novo onboarding', 'Café às sextas'] },
  ],
  ...overrides,
});

export const voterKey = (n) => `teste-chave-aleatoria-${String(n).padStart(6, '0')}`;

/** Monta a cédula a partir dos índices das opções (null = branco). */
export function ballot(view, picks) {
  return view.categories.map((c, i) => ({ categoryId: c.id, optionId: picks[i] === null ? null : c.options[picks[i]].id }));
}
