import { sha256 } from '../lib/crypto.js';

export const SNAPSHOT_VERSION = 1;

/**
 * Calcula o resultado de uma categoria a partir dos contadores.
 *
 * Ranking por "classificação de competição" (1, 2, 2, 4): opções com o mesmo
 * número de votos dividem a posição. Nenhum critério de desempate é aplicado.
 * Votos em branco não são votos válidos: aparecem separados e não entram no ranking.
 * Os percentuais são frações (0–1) sobre os votos válidos.
 */
export function computeCategoryResults(category) {
  const validVotes = category.options.reduce((sum, o) => sum + o.votes, 0);
  const blankVotes = category.blankVotes;
  const totalVotes = validVotes + blankVotes;

  const sorted = [...category.options].sort((a, b) => b.votes - a.votes || a.position - b.position);
  const ranking = sorted.map((o) => {
    const rank = 1 + sorted.filter((x) => x.votes > o.votes).length;
    const tiedWith = sorted.filter((x) => x.votes === o.votes).length;
    return {
      optionId: o.id,
      name: o.name,
      votes: o.votes,
      rank,
      tied: tiedWith > 1,
      share: validVotes > 0 ? o.votes / validVotes : 0,
    };
  });

  const winners = validVotes > 0 ? ranking.filter((r) => r.rank === 1) : [];
  let outcome = 'no-votes';
  if (winners.length === 1) outcome = 'winner';
  else if (winners.length > 1) outcome = 'tie';

  return {
    categoryId: category.id,
    title: category.title,
    description: category.description,
    allowBlank: category.allowBlank,
    validVotes,
    blankVotes,
    totalVotes,
    blankShare: totalVotes > 0 ? blankVotes / totalVotes : 0,
    optionCount: category.options.length,
    outcome,
    winners: winners.map((w) => w.name),
    ranking,
  };
}

export function computeResults(ballotCount, structure) {
  const categories = structure.map(computeCategoryResults);
  return { ballotCount, categories, consistent: categories.every((c) => c.totalVotes === ballotCount) };
}

/** Snapshot oficial gravado no encerramento. É a ÚNICA fonte dos arquivos exportados. */
export function buildSnapshot(poll, structure, closedAt) {
  const results = computeResults(poll.ballotCount, structure);
  if (!results.consistent) {
    throw new Error('Inconsistência nos contadores: total de votos por categoria difere do número de cédulas.');
  }
  const snapshot = {
    version: SNAPSHOT_VERSION,
    poll: {
      publicId: poll.publicId,
      title: poll.title,
      description: poll.description,
      accessMode: poll.accessMode,
      openedAt: poll.openedAt,
      closedAt,
    },
    ballotCount: results.ballotCount,
    categories: results.categories,
  };
  const json = JSON.stringify(snapshot);
  return { json, hash: sha256(json), snapshot };
}

/**
 * Confere integridade antes de gerar arquivos: hash do snapshot e coerência
 * aritmética (soma dos votos de cada categoria = total de cédulas).
 */
export function verifySnapshot(json, hash) {
  if (!json || !hash) return { ok: false, reason: 'A votação ainda não possui resultado oficial.' };
  if (sha256(json) !== hash) return { ok: false, reason: 'O resultado oficial não confere com sua assinatura (hash).' };
  const snapshot = JSON.parse(json);
  for (const c of snapshot.categories) {
    const sum = c.ranking.reduce((s, r) => s + r.votes, 0);
    if (sum !== c.validVotes || c.validVotes + c.blankVotes !== snapshot.ballotCount) {
      return { ok: false, reason: `Totais inconsistentes na categoria "${c.title}".` };
    }
  }
  return { ok: true, snapshot };
}
