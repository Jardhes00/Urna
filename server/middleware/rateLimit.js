import { AppError } from '../lib/errors.js';

/**
 * Limitador de requisições em memória (janela fixa por IP).
 * Serve para frear abuso automatizado — NÃO é usado para decidir quem pode
 * votar, já que várias pessoas podem compartilhar o mesmo IP (Wi-Fi, 4G).
 * Os limites são folgados para uma sala inteira na mesma rede.
 */
export function rateLimit({ windowMs, max, message }) {
  const hits = new Map();

  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, windowMs);
  timer.unref();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || 'unknown';
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      return next(new AppError(429, 'RATE_LIMITED', message || 'Muitas tentativas. Aguarde um instante e tente novamente.'));
    }
    next();
  };
}
