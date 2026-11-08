import { AppError } from '../lib/errors.js';

export function notFoundApi(req, res, next) {
  next(new AppError(404, 'NOT_FOUND', 'Rota não encontrada.'));
}

/** Converte erros em JSON padronizado sem vazar detalhes internos. */
export function errorHandler(logger) {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, next) => {
    if (err?.type === 'entity.parse.failed') {
      err = new AppError(400, 'INVALID_JSON', 'Dados enviados em formato inválido.');
    } else if (err?.type === 'entity.too.large') {
      err = new AppError(413, 'PAYLOAD_TOO_LARGE', 'Dados enviados excedem o tamanho permitido.');
    }
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    }
    logger.error('[erro interno]', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erro interno. Tente novamente em instantes.' } });
  };
}
