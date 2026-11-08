import { transaction } from '../db/database.js';
import { AppError, conflict } from '../lib/errors.js';

/**
 * Registro de cédulas. Tudo acontece em UMA transação:
 *   1. confere se a votação está aberta (dentro da trava, sem condição de corrida);
 *   2. registra a participação — a PRIMARY KEY (poll_id, voter_hash) impede reuso;
 *   3. incrementa os contadores agregados de cada categoria.
 * Se qualquer passo falhar, nada é gravado.
 */
export function createBallotRepository(db) {
  const stmts = {
    poll: db.prepare('SELECT status, closes_at, access_mode FROM polls WHERE id = ?'),
    tokenExists: db.prepare('SELECT 1 FROM tokens WHERE poll_id = ? AND code_hash = ?'),
    hasParticipated: db.prepare('SELECT 1 FROM participations WHERE poll_id = ? AND voter_hash = ?'),
    participate: db.prepare('INSERT OR IGNORE INTO participations (poll_id, voter_hash) VALUES (?, ?)'),
    voteOption: db.prepare(`UPDATE options SET votes = votes + 1
      WHERE id = ? AND category_id = (SELECT id FROM categories WHERE id = ? AND poll_id = ?)`),
    voteBlank: db.prepare('UPDATE categories SET blank_votes = blank_votes + 1 WHERE id = ? AND poll_id = ? AND allow_blank = 1'),
    countBallot: db.prepare('UPDATE polls SET ballot_count = ballot_count + 1 WHERE id = ?'),
  };

  return {
    hasParticipated: (pollId, voterHash) => Boolean(stmts.hasParticipated.get(pollId, voterHash)),

    cast(pollId, voterHash, choices, { nowIso, requireToken }) {
      return transaction(db, () => {
        const poll = stmts.poll.get(pollId);
        if (!poll || poll.status !== 'open' || (poll.closes_at && poll.closes_at <= nowIso)) {
          throw conflict('POLL_CLOSED', 'Esta votação não está aceitando votos.');
        }
        if (requireToken && !stmts.tokenExists.get(pollId, voterHash)) {
          throw new AppError(403, 'INVALID_CODE', 'Código de participação inválido.');
        }

        // INSERT OR IGNORE + verificação de "changes": o segundo envio simultâneo
        // com a mesma chave não insere nada e é recusado.
        if (stmts.participate.run(pollId, voterHash).changes !== 1) {
          throw conflict('ALREADY_VOTED', 'Este voto já foi registrado anteriormente.');
        }

        for (const choice of choices) {
          const result = choice.optionId === null
            ? stmts.voteBlank.run(choice.categoryId, pollId)
            : stmts.voteOption.run(choice.optionId, choice.categoryId, pollId);
          if (result.changes !== 1) throw new AppError(400, 'VALIDATION_ERROR', 'Cédula inválida.');
        }
        stmts.countBallot.run(pollId);
      });
    },
  };
}
