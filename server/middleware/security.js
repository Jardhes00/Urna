import { AppError } from '../lib/errors.js';

/** Cabeçalhos de segurança. Nenhum recurso externo é carregado (sem CDN, sem fontes de terceiros). */
export function securityHeaders(req, res, next) {
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; '));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
}

/**
 * Proteção contra CSRF nas rotas que alteram dados: exige JSON (formulários
 * de outros sites não conseguem enviar application/json sem CORS) e, quando o
 * navegador informa Origin, que seja o próprio host.
 */
export function requireJsonSameOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const origin = req.get('origin');
  if (origin) {
    let host;
    try { host = new URL(origin).host; } catch { host = null; }
    if (host !== req.get('host')) return next(new AppError(403, 'FORBIDDEN_ORIGIN', 'Origem não permitida.'));
  }
  // Imagens (PNG/JPEG) também não podem ser enviadas por formulários de outros sites:
  // esses tipos exigem requisição CORS com "preflight", que este servidor não autoriza.
  if (req.method !== 'DELETE' && !req.is('application/json') && !req.is(['image/png', 'image/jpeg'])) {
    return next(new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Envie os dados em JSON.'));
  }
  next();
}

export function noStore(req, res, next) {
  res.setHeader('Cache-Control', 'no-store');
  next();
}
