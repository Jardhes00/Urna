/**
 * Erro de aplicação com status HTTP e código estável, consumido pelo front-end.
 */
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) => new AppError(400, 'VALIDATION_ERROR', message, details);
export const notFound = (message = 'Recurso não encontrado.') => new AppError(404, 'NOT_FOUND', message);
export const conflict = (code, message) => new AppError(409, code, message);
export const unauthorized = (message = 'Faça login para continuar.') => new AppError(401, 'UNAUTHORIZED', message);
