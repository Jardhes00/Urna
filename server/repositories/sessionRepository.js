export function createSessionRepository(db) {
  const stmts = {
    insert: db.prepare('INSERT INTO admin_sessions (id_hash, expires_at) VALUES (?, ?)'),
    find: db.prepare('SELECT expires_at FROM admin_sessions WHERE id_hash = ?'),
    remove: db.prepare('DELETE FROM admin_sessions WHERE id_hash = ?'),
    purge: db.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?'),
  };

  return {
    create: (idHash, expiresAt) => stmts.insert.run(idHash, expiresAt),
    isValid(idHash, nowIso) {
      const row = stmts.find.get(idHash);
      return Boolean(row && row.expires_at > nowIso);
    },
    remove: (idHash) => stmts.remove.run(idHash),
    purgeExpired: (nowIso) => stmts.purge.run(nowIso),
  };
}
