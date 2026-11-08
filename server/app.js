import path from 'node:path';
import express from 'express';
import { openDatabase } from './db/database.js';
import { createDefaultPoll, seedDefaultPoll } from './db/seed.js';
import { createPollRepository } from './repositories/pollRepository.js';
import { createBallotRepository } from './repositories/ballotRepository.js';
import { createTokenRepository } from './repositories/tokenRepository.js';
import { createSessionRepository } from './repositories/sessionRepository.js';
import { createImageRepository } from './repositories/imageRepository.js';
import { IMAGE_ID } from './lib/validation.js';
import { createPollService } from './services/pollService.js';
import { createVotingService } from './services/votingService.js';
import { createExportService } from './services/exportService.js';
import { createAuth } from './middleware/auth.js';
import { noStore, requireJsonSameOrigin, securityHeaders } from './middleware/security.js';
import { errorHandler, notFoundApi } from './middleware/errors.js';
import { publicRoutes } from './routes/publicRoutes.js';
import { authRoutes } from './routes/authRoutes.js';
import { adminRoutes } from './routes/adminRoutes.js';

/**
 * Monta a aplicação (sem iniciar o servidor) — usada pelo index.js e pelos testes.
 */
export function createApp(config, { logger = console } = {}) {
  const db = openDatabase(config.databaseFile);

  const polls = createPollRepository(db);
  const ballots = createBallotRepository(db);
  const tokens = createTokenRepository(db);
  const sessions = createSessionRepository(db);
  const images = createImageRepository(db);
  const seedMessage = config.seedDefaultPoll ? seedDefaultPoll(db, polls, images) : null;
  if (seedMessage) logger.info?.(seedMessage);

  const pollService = createPollService({
    polls, tokens, images, config, createFromModel: () => createDefaultPoll(db, polls, images),
  });
  const votingService = createVotingService({ polls, ballots, tokens, pollService });
  const exportService = createExportService({ pollService, polls, images, config });
  const auth = createAuth({ sessions, config });

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy ? 1 : false);
  app.use(securityHeaders);

  // --- API ---
  const api = express.Router();
  api.use(noStore);
  api.use(express.json({ limit: '100kb' }));
  api.use(requireJsonSameOrigin);
  api.get('/health', (req, res) => res.json({ ok: true }));
  api.use('/public', publicRoutes({ votingService, config }));
  api.use('/auth', authRoutes({ auth, config }));
  api.use('/admin', adminRoutes({ auth, pollService, exportService, config }));
  api.use(notFoundApi);
  app.use('/api', api);

  // --- Imagens das alternativas (id aleatório de 128 bits; conteúdo imutável) ---
  app.get('/img/:id', (req, res, next) => {
    const img = config.optionImages && IMAGE_ID.test(req.params.id) ? images.get(req.params.id) : null;
    if (!img) return next();
    res.setHeader('Content-Type', img.mime);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(img.data);
  });

  // --- Páginas ---
  const page = (file) => (req, res) => res.sendFile(path.join(config.publicDir, file));
  // Sem página inicial: o endereço principal leva à votação aberta ou, se não houver, ao painel.
  app.get('/', (req, res) => {
    const open = pollService.list().find((p) => p.status === 'open');
    res.redirect(open ? `/v/${open.publicId}` : '/admin');
  });
  app.get('/v/:publicId', page('vote.html'));
  app.get('/admin', page('admin.html'));
  app.use(express.static(config.publicDir, { index: false, maxAge: config.isProduction ? '1h' : 0 }));
  app.use((req, res) => res.status(404).sendFile(path.join(config.publicDir, '404.html')));

  app.use(errorHandler(logger));

  // Encerramento automático de votações com prazo vencido.
  const sweeper = setInterval(() => pollService.closeDuePolls(), 30_000);
  sweeper.unref();

  return { app, db, close: () => { clearInterval(sweeper); db.close(); } };
}
