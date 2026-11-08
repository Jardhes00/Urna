import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Configuração centralizada, lida das variáveis de ambiente.
 * Ver .env.example para a documentação de cada variável.
 */
export function loadConfig(env = process.env) {
  const isProduction = env.NODE_ENV === 'production';

  let adminPassword = env.ADMIN_PASSWORD || '';
  let generatedPassword = false;
  if (!adminPassword) {
    if (isProduction) {
      throw new Error('ADMIN_PASSWORD é obrigatória em produção (NODE_ENV=production).');
    }
    adminPassword = crypto.randomBytes(9).toString('base64url');
    generatedPassword = true;
  }
  if (isProduction && adminPassword.length < 12) {
    throw new Error('ADMIN_PASSWORD deve ter pelo menos 12 caracteres em produção.');
  }

  return {
    root: ROOT,
    publicDir: path.join(ROOT, 'public'),
    port: Number(env.PORT) || 3000,
    host: env.HOST || '0.0.0.0',
    isProduction,
    databaseFile: env.DATABASE_FILE || path.join(ROOT, 'data', 'urna.db'),
    adminPassword,
    generatedPassword,
    // URL pública usada para montar os links compartilháveis (ex.: https://urna.suaempresa.com).
    // Se vazia, o link é montado a partir do endereço acessado pelo administrador.
    publicBaseUrl: (env.PUBLIC_BASE_URL || '').replace(/\/+$/, ''),
    sessionTtlHours: Number(env.SESSION_TTL_HOURS) || 12,
    // Atrás de proxy reverso (Render, Railway, Nginx...) o IP real vem do X-Forwarded-For.
    trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true',
    // Limite de envios de cédula por IP por minuto. Freia scripts de abuso; folgado
    // para uma sala inteira na mesma rede (Wi-Fi/4G compartilham IP).
    voteRateLimit: Number(env.VOTE_RATE_LIMIT) || 120,
    loginRateLimit: Number(env.LOGIN_RATE_LIMIT) || 10,
    // Cria, no primeiro início, a votação inicial (9 categorias x 5 opções) em rascunho.
    seedDefaultPoll: env.SEED_LEGACY_POLL !== '0' && env.SEED_LEGACY_POLL !== 'false',
    // Imagens das alternativas, desligadas por enquanto. As já salvas ficam no banco e voltam ao religar.
    optionImages: env.OPTION_IMAGES === '1' || env.OPTION_IMAGES === 'true',
  };
}
