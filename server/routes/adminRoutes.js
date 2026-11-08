import express, { Router } from 'express';
import { badRequest } from '../lib/errors.js';

function sendFile(res, { buffer, filename, type }) {
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', buffer.length);
  res.end(buffer);
}

/** API administrativa. Todas as rotas exigem sessão de administrador. */
export function adminRoutes({ auth, pollService, exportService, config }) {
  const router = Router();
  router.use(auth.requireAdmin);

  router.get('/config', (req, res) => {
    res.json({ publicBaseUrl: config.publicBaseUrl || `${req.protocol}://${req.get('host')}`, optionImages: config.optionImages });
  });

  router.get('/polls', (req, res) => res.json(pollService.list()));

  router.post('/polls', (req, res) => {
    const id = pollService.create(req.body);
    res.status(201).json(pollService.adminView(id));
  });

  router.post('/polls/from-model', (req, res) => {
    res.status(201).json(pollService.adminView(pollService.createFromModel()));
  });

  router.get('/polls/:id', (req, res) =>res.json(pollService.adminView(req.params.id)));

  router.put('/polls/:id', (req, res) => {
    pollService.update(req.params.id, req.body);
    res.json(pollService.adminView(req.params.id));
  });

  router.delete('/polls/:id', (req, res) => {
    pollService.remove(req.params.id);
    res.status(204).end();
  });

  router.post('/polls/:id/duplicate', (req, res) => {
    const copyId = pollService.duplicate(req.params.id);
    res.status(201).json(pollService.adminView(copyId));
  });

  router.post('/polls/:id/open',(req, res) => {
    pollService.open(req.params.id);
    res.json(pollService.adminView(req.params.id));
  });

  // Encerramento definitivo: exige confirmação explícita no corpo da requisição.
  router.post('/polls/:id/close', (req, res) => {
    if (req.body?.confirm !== true) throw badRequest('Confirme o encerramento da votação.');
    pollService.close(req.params.id);
    res.json(pollService.adminView(req.params.id));
  });

  // Imagem de alternativa: corpo binário (image/png ou image/jpeg), até 5 MB.
  router.post('/polls/:id/images', express.raw({ type: ['image/png', 'image/jpeg'], limit: '5mb' }), (req, res) => {
    if (!Buffer.isBuffer(req.body) || !req.body.length) throw badRequest('Envie uma imagem JPG ou PNG.');
    res.status(201).json(pollService.uploadImage(req.params.id, req.body));
  });

  router.get('/polls/:id/tokens',(req, res) => res.json(pollService.listTokens(req.params.id)));

  router.post('/polls/:id/tokens', (req, res) => {
    res.status(201).json(pollService.generateTokens(req.params.id, req.body?.count));
  });

  router.get('/polls/:id/export/pptx', async (req, res) => sendFile(res, await exportService.pptx(req.params.id)));
  router.get('/polls/:id/export/xlsx', async (req, res) => sendFile(res, await exportService.xlsx(req.params.id)));
  router.get('/polls/:id/export/zip', async (req, res) => sendFile(res, await exportService.bundle(req.params.id)));

  return router;
}
