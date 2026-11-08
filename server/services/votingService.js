import { normalizeCode, sha256 } from '../lib/crypto.js';
import { AppError, badRequest, conflict, notFound } from '../lib/errors.js';
import { isValidVoterKey, validateBallotInput } from '../lib/validation.js';
import { codeHash } from './pollService.js';

/** Hash da chave aleatória do navegador (modo "link"), vinculado à votação. */
const linkHash = (pollId, key) => sha256(`link:${pollId}:${key}`);

export function createVotingService({ polls, ballots, tokens, pollService }) {
  function findPublic(publicId) {
    pollService.closeDuePolls();
    const poll = typeof publicId === 'string' && publicId.length <= 32 ? polls.findByPublicId(publicId) : null;
    if (!poll) throw notFound('Votação não encontrada. Confira o link recebido.');
    return poll;
  }

  /** Resolve a identidade de participação SEM guardar nada pessoal. */
  function participationHash(poll, { voterKey, code }) {
    if (poll.accessMode === 'token') {
      const normalized = normalizeCode(code);
      if (!normalized) throw new AppError(403, 'INVALID_CODE', 'Código de participação inválido. Ele tem 8 caracteres, como ABCD-2345.');
      return codeHash(poll.id, normalized);
    }
    if (!isValidVoterKey(voterKey)) throw badRequest('Não foi possível identificar este navegador. Recarregue a página.');
    return linkHash(poll.id, voterKey);
  }

  return {
    /**
     * Dados públicos da cédula. Nunca inclui contagens ou resultados parciais.
     * Votações em rascunho aparecem como "indisponível".
     */
    publicView(publicId, voterKey) {
      const poll = findPublic(publicId);
      const status = poll.status === 'draft' ? 'unavailable' : poll.status;
      const view = {
        publicId: poll.publicId,
        title: poll.title,
        description: poll.description,
        accessMode: poll.accessMode,
        status,
        closesAt: poll.closesAt,
        hasVoted: false,
        categories: [],
      };
      if (status !== 'open') return view;

      if (poll.accessMode === 'link' && isValidVoterKey(voterKey)) {
        view.hasVoted = ballots.hasParticipated(poll.id, linkHash(poll.id, voterKey));
      }
      view.categories = polls.structure(poll.id).map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        allowBlank: c.allowBlank,
        options: c.options.map((o) => ({ id: o.id, name: o.name, imageUrl: pollService.imageUrl(o.imageId) })),
      }));
      return view;
    },

    /** Verifica um código antes de mostrar a cédula (sem consumi-lo). */
    checkCode(publicId, code) {
      const poll = findPublic(publicId);
      if (poll.accessMode !== 'token') throw badRequest('Esta votação não usa códigos.');
      const hash = participationHash(poll, { code });
      if (!tokens.exists(poll.id, hash)) {
        throw new AppError(403, 'INVALID_CODE', 'Código não encontrado. Confira se digitou corretamente.');
      }
      if (ballots.hasParticipated(poll.id, hash)) {
        throw new AppError(409, 'ALREADY_VOTED', 'Este código já foi utilizado.');
      }
      return { ok: true };
    },

    cast(publicId, body) {
      const poll = findPublic(publicId);
      // Checagem antecipada para a mensagem certa; a definitiva ocorre dentro da transação.
      if (poll.status !== 'open') throw conflict('POLL_CLOSED', 'Esta votação não está aceitando votos.');
      const { choices, voterKey, code } = validateBallotInput(body);
      const voterHash = participationHash(poll, { voterKey, code });

      // A cédula precisa ter exatamente uma escolha por categoria.
      const structure = polls.structure(poll.id);
      const byCategory = new Map(choices.map((c) => [c.categoryId, c.optionId]));
      if (byCategory.size !== choices.length || byCategory.size !== structure.length) {
        throw badRequest('Escolha uma opção em todas as categorias antes de confirmar.');
      }
      for (const category of structure) {
        if (!byCategory.has(category.id)) throw badRequest('Escolha uma opção em todas as categorias antes de confirmar.');
        const optionId = byCategory.get(category.id);
        if (optionId === null ? !category.allowBlank : !category.options.some((o) => o.id === optionId)) {
          throw badRequest('Cédula inválida.');
        }
      }

      ballots.cast(poll.id, voterHash, choices, {
        nowIso: new Date().toISOString(),
        requireToken: poll.accessMode === 'token',
      });
    },
  };
}
