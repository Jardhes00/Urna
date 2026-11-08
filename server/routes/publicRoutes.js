import { Router } from 'express';
import { rateLimit } from '../middleware/rateLimit.js';

/** API pública (participantes). Nunca expõe contagens nem resultados. */
export function publicRoutes({ votingService, config }) {
  const router = Router();

  const voteLimiter = rateLimit({ windowMs: 60_000, max: config.voteRateLimit });
  const codeLimiter = rateLimit({
    windowMs: 10 * 60_000, max: config.voteRateLimit, message: 'Muitas tentativas de código. Aguarde alguns minutos.',
  });

  router.get('/polls/:publicId', (req, res) => {
    res.json(votingService.publicView(req.params.publicId, req.get('x-voter-key') || ''));
  });

  router.post('/polls/:publicId/check-code', codeLimiter, (req, res) => {
    res.json(votingService.checkCode(req.params.publicId, req.body?.code));
  });

  router.post('/polls/:publicId/ballots', voteLimiter, (req, res) => {
    votingService.cast(req.params.publicId, req.body);
    res.status(201).json({ ok: true });
  });

  return router;
}
