export function createImageRepository(db) {
  const stmts = {
    insert: db.prepare(`INSERT INTO images (id, poll_id, mime, width, height, data, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`),
    get: db.prepare('SELECT id, poll_id, mime, width, height, data FROM images WHERE id = ?'),
    idsOfPoll: db.prepare('SELECT id FROM images WHERE poll_id = ?'),
    forPollOptions: db.prepare(`SELECT o.id AS option_id, i.mime, i.width, i.height, i.data FROM options o
      JOIN categories c ON c.id = o.category_id JOIN images i ON i.id = o.image_id WHERE c.poll_id = ?`),
  };

  return {
    insert(img) {
      stmts.insert.run(img.id, img.pollId, img.mime, img.width, img.height, img.data, img.source || null, new Date().toISOString());
      return img.id;
    },
    get(id) {
      const row = stmts.get.get(id);
      return row && { id: row.id, pollId: row.poll_id, mime: row.mime, width: row.width, height: row.height, data: Buffer.from(row.data) };
    },
    idsOfPoll: (pollId) => new Set(stmts.idsOfPoll.all(pollId).map((r) => r.id)),
    /** Mapa optionId → imagem, usado na geração do PowerPoint. */
    byOptionForPoll(pollId) {
      return new Map(stmts.forPollOptions.all(pollId).map((r) => [r.option_id, {
        mime: r.mime, width: r.width, height: r.height, data: Buffer.from(r.data),
      }]));
    },
  };
}
