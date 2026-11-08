import { Router } from 'express';
import { rateLimit } from '../middleware/rateLimit.js';

export function authRoutes({ auth, config }) {
  const router = Router();
  const loginLimiter = rateLimit({
    windowMs: 15 * 60_000, max: config.loginRateLimit, message:'Muitas tentativas de login. Aguarde 15 minutos.',
  });

  router.post('/login', loginLimiter, (req, res) => {
    auth.login(req, res, req.body?.password);
    res.json({ authenticated: true });
  });

  router.post('/logout', (req, res) => {
    auth.logout(req, res);
    res.json({ authenticated: false });
  });

  router.get('/session', (req, res) => {
    res.json({ authenticated: auth.isAuthenticated(req) });
  });

  return router;
}
