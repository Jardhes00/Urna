import { randomId, safeEqual, sha256 } from '../lib/crypto.js';
import { unauthorized } from '../lib/errors.js';

export const SESSION_COOKIE = 'urna_admin';

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

/**
 * Autenticação do administrador por senha (variável ADMIN_PASSWORD) e sessão
 * em cookie HttpOnly + SameSite=Strict. O navegador nunca vê a senha nem o
 * identificador bruto da sessão via JavaScript; o banco guarda apenas o hash.
 */
export function createAuth({ sessions, config }) {
  const ttlMs = config.sessionTtlHours * 3600 * 1000;

  function cookieOptions(maxAgeMs) {
    return {
      httpOnly: true,
      sameSite: 'strict',
      secure: config.isProduction,
      path: '/api',
      maxAge: maxAgeMs,
    };
  }

  function currentSessionHash(req) {
    const raw = readCookie(req, SESSION_COOKIE);
    return raw ? sha256(raw) : null;
  }

  function isAuthenticated(req) {
    const hash = currentSessionHash(req);
    return Boolean(hash && sessions.isValid(hash, new Date().toISOString()));
  }

  return {
    isAuthenticated,

    requireAdmin(req, res, next) {
      if (isAuthenticated(req)) return next();
      next(unauthorized('Sua sessão expirou. Entre novamente.'));
    },

    login(req, res, password) {
      if (typeof password !== 'string' || !safeEqual(password, config.adminPassword)) {
        throw unauthorized('Senha incorreta.');
      }
      const now = Date.now();
      sessions.purgeExpired(new Date(now).toISOString());
      const raw = randomId(32);
      sessions.create(sha256(raw), new Date(now + ttlMs).toISOString());
      res.cookie(SESSION_COOKIE, raw, cookieOptions(ttlMs));
    },

    logout(req, res) {
      const hash = currentSessionHash(req);
      if (hash) sessions.remove(hash);
      res.clearCookie(SESSION_COOKIE, { ...cookieOptions(0), maxAge: undefined });
    },
  };
}
