import { randomId, randomCode, sha256 } from '../lib/crypto.js';
import { AppError, badRequest, conflict, notFound } from '../lib/errors.js';
import { LIMITS, validatePollInput } from '../lib/validation.js';
import { buildSnapshot, computeResults, verifySnapshot } from './results.js';
import { imageInfo } from '../lib/imageInfo.js';

/** Hash do código de participação, vinculado à votação. Usado também pelo serviço de voto. */
export const codeHash = (pollId, code) => sha256(`token:${pollId}:${code}`);

const MAX_IMAGE_SIDE = 6000;

export function createPollService({ polls, tokens, images, config, createFromModel }) {
  const imageUrl = (imageId) => (config.optionImages && imageId ? `/img/${imageId}` : null);

  function requirePoll(id) {
    const poll = polls.findById(Number(id));
    if (!poll) throw notFound('Votação não encontrada.');
    return poll;
  }

  function close(pollId) {
    return polls.markClosed(pollId, (poll, closedAt) => buildSnapshot(poll, polls.structure(pollId), closedAt));
  }

  /** Encerra automaticamente as votações cujo prazo expirou. */
  function closeDuePolls() {
    for (const id of polls.idsDueToClose(new Date().toISOString())) close(id);
  }

  function summary(poll) {
    return {
      id: poll.id,
      publicId: poll.publicId,
      title: poll.title,
      description: poll.description,
      accessMode: poll.accessMode,
      status: poll.status,
      closesAt: poll.closesAt,
      ballotCount: poll.ballotCount,
      createdAt: poll.createdAt,
      openedAt: poll.openedAt,
      closedAt: poll.closedAt,
    };
  }

  return {
    closeDuePolls,
    requirePoll,
    imageUrl,

    list() {
      closeDuePolls();
      return polls.list().map(summary);
    },

    create(body) {
      const input = validatePollInput(body);
      // Imagens só podem ser enviadas depois que a votação existe (são vinculadas a ela).
      input.categories.forEach((c) => c.options.forEach((o) => { o.imageId = null; }));
      return polls.create(randomId(9), input);
    },

    update(id, body) {
      const poll = requirePoll(id);
      if (poll.status !== 'draft') {
        throw conflict('NOT_EDITABLE', 'Só é possível editar a votação enquanto ela é um rascunho.');
      }
      const input = validatePollInput(body);
      const owned = images.idsOfPoll(poll.id);
      if (input.categories.some((c) => c.options.some((o) => o.imageId && !owned.has(o.imageId)))) {
        throw badRequest('Uma das imagens não pertence a esta votação. Envie a imagem novamente.');
      }
      polls.update(poll.id, input);
    },

    /** Recebe a imagem de uma alternativa (bytes brutos). Só PNG/JPEG reais, conferidos pelo conteúdo. */
    uploadImage(id, buffer) {
      if (!config.optionImages) throw conflict('IMAGES_DISABLED', 'As imagens das alternativas estão desativadas.');
      const poll = requirePoll(id);
      if (poll.status !== 'draft') {
        throw conflict('NOT_EDITABLE', 'Só é possível alterar imagens enquanto a votação é um rascunho.');
      }
      const info = imageInfo(buffer);
      if (!info) throw badRequest('Formato de imagem não suportado. Use JPG ou PNG.');
      if (!info.width || !info.height || info.width > MAX_IMAGE_SIDE || info.height > MAX_IMAGE_SIDE) {
        throw badRequest('Dimensões de imagem inválidas.');
      }
      const imageId = images.insert({ id: randomId(16), pollId: poll.id, ...info, data: buffer });
      return { imageId, url: imageUrl(imageId) };
    },

    /** Visão completa para o administrador, com resultados parciais ou oficiais. */
    adminView(id) {
      closeDuePolls();
      const poll = requirePoll(id);
      const structure = polls.structure(poll.id);
      const official = poll.status === 'closed' ? verifySnapshot(poll.resultsJson, poll.resultsHash) : null;
      return {
        ...summary(poll),
        categories: structure.map(({ id: cid, title, description, allowBlank, options }) => ({
          id: cid, title, description, allowBlank,
          options: options.map((o) => ({ id: o.id, name: o.name, imageId: o.imageId, imageUrl: imageUrl(o.imageId) })),
        })),
        results: official?.ok ? official.snapshot : computeResults(poll.ballotCount, structure),
        resultsOfficial: Boolean(official?.ok),
        integrityError: official && !official.ok ? official.reason : null,
        verificationCode: official?.ok ? poll.resultsHash.slice(0, 16).toUpperCase() : null,
        tokens: poll.accessMode === 'token' ? tokens.stats(poll.id) : null,
      };
    },

    open(id) {
      const poll = requirePoll(id);
      if (poll.status !== 'draft') throw conflict('INVALID_STATE', 'Esta votação já foi aberta.');
      if (poll.closesAt && poll.closesAt <= new Date().toISOString()) {
        throw badRequest('O prazo de encerramento já passou. Edite a votação e escolha uma nova data.');
      }
      polls.markOpen(poll.id);
    },

    close(id) {
      const poll = requirePoll(id);
      if (poll.status !== 'open') throw conflict('INVALID_STATE', 'Apenas votações abertas podem ser encerradas.');
      if (!close(poll.id)) throw conflict('INVALID_STATE', 'A votação já foi encerrada.');
    },

    /** Novo rascunho com a urna pronta de server/db/seed.js. */
    createFromModel,

    duplicate(id) {
      const poll = requirePoll(id);
      return polls.duplicate(poll.id, randomId(9), () => randomId(16));
    },

    remove(id) {
      const poll = requirePoll(id);
      if (poll.status === 'open') {
        throw conflict('INVALID_STATE', 'Encerre a votação antes de excluí-la.');
      }
      polls.remove(poll.id);
    },

    /** Snapshot validado — exigido para gerar PowerPoint e Excel. */
    officialResults(id) {
      closeDuePolls();
      const poll = requirePoll(id);
      if (poll.status !== 'closed') {
        throw conflict('NOT_CLOSED', 'Encerre a votação antes de gerar os arquivos: os resultados ainda podem mudar.');
      }
      const check = verifySnapshot(poll.resultsJson, poll.resultsHash);
      if (!check.ok) throw new AppError(500, 'INTEGRITY_ERROR', check.reason);
      return check.snapshot;
    },

    generateTokens(id, count) {
      const poll = requirePoll(id);
      if (poll.accessMode !== 'token') throw badRequest('Esta votação não usa códigos de participação.');
      if (poll.status === 'closed') throw conflict('INVALID_STATE', 'A votação já foi encerrada.');
      const n = Number(count);
      const current = tokens.stats(poll.id).total;
      if (!Number.isInteger(n) || n < 1 || n > 500) throw badRequest('Gere entre 1 e 500 códigos por vez.');
      if (current + n > LIMITS.tokensMax) throw badRequest(`Limite de ${LIMITS.tokensMax} códigos por votação.`);

      let created = 0;
      while (created < n) {
        const batch = Array.from({ length: n - created }, () => {
          const code = randomCode();
          return { code, hash: codeHash(poll.id, code) };
        });
        created += tokens.insertMany(poll.id, batch);
      }
      return tokens.stats(poll.id);
    },

    listTokens(id) {
      const poll = requirePoll(id);
      return { publicId: poll.publicId, title: poll.title, codes: tokens.listCodes(poll.id), ...tokens.stats(poll.id) };
    },
  };
}
