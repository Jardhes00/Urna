import { transaction } from '../db/database.js';

export function createTokenRepository(db) {
  const stmts = {
    insert: db.prepare('INSERT OR IGNORE INTO tokens (poll_id, code_hash, code) VALUES (?, ?, ?)'),
    list: db.prepare('SELECT code FROM tokens WHERE poll_id = ? ORDER BY code'),
    exists: db.prepare('SELECT 1 FROM tokens WHERE poll_id = ? AND code_hash = ?'),
    total: db.prepare('SELECT COUNT(*) AS n FROM tokens WHERE poll_id = ?'),
    used: db.prepare(`SELECT COUNT(*) AS n FROM tokens t
      JOIN participations p ON p.poll_id = t.poll_id AND p.voter_hash = t.code_hash WHERE t.poll_id = ?`),
  };

  return {
    /** Insere os códigos; retorna quantos eram inéditos (colisões são ignoradas). */
    insertMany(pollId, entries) {
      return transaction(db, () =>
        entries.reduce((n, { hash, code }) => n + stmts.insert.run(pollId, hash, code).changes, 0),
      );
    },
    exists: (pollId, hash) => Boolean(stmts.exists.get(pollId, hash)),
    listCodes: (pollId) =>stmts.list.all(pollId).map((r) => r.code),
    // Apenas totais: a interface não mostra QUAIS códigos foram usados.
    stats: (pollId) => ({ total: stmts.total.get(pollId).n, used: stmts.used.get(pollId).n }),
  };
}
