import { transaction } from '../db/database.js';

const now = () => new Date().toISOString();

function mapPoll(row) {
  if (!row) return null;
  return {
    id: row.id,
    publicId: row.public_id,
    title: row.title,
    description: row.description,
    accessMode: row.access_mode,
    status: row.status,
    closesAt: row.closes_at,
    ballotCount: row.ballot_count,
    resultsJson: row.results_json,
    resultsHash: row.results_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
  };
}

export function createPollRepository(db) {
  const stmts = {
    insertPoll: db.prepare(`INSERT INTO polls (public_id, title, description, access_mode, closes_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`),
    updatePoll: db.prepare(`UPDATE polls SET title = ?, description = ?, access_mode = ?, closes_at = ?, updated_at = ? WHERE id = ?`),
    insertCategory: db.prepare(`INSERT INTO categories (poll_id, position, title, description, allow_blank) VALUES (?, ?, ?, ?, ?)`),
    insertOption: db.prepare(`INSERT INTO options (category_id, position, name, image_id) VALUES (?, ?, ?, ?)`),
    // Imagens enviadas que deixaram de ser usadas por alguma alternativa.
    deleteOrphanImages: db.prepare(`DELETE FROM images WHERE poll_id = ? AND id NOT IN (
      SELECT o.image_id FROM options o JOIN categories c ON c.id = o.category_id WHERE c.poll_id = ? AND o.image_id IS NOT NULL)`),
    deleteCategories: db.prepare('DELETE FROM categories WHERE poll_id = ?'),
    byId: db.prepare('SELECT * FROM polls WHERE id = ?'),
    byPublicId: db.prepare('SELECT * FROM polls WHERE public_id = ?'),
    list: db.prepare('SELECT * FROM polls ORDER BY created_at DESC'),
    categories: db.prepare('SELECT * FROM categories WHERE poll_id = ? ORDER BY position'),
    options: db.prepare(`SELECT o.*, i.source AS image_source FROM options o JOIN categories c ON c.id = o.category_id
      LEFT JOIN images i ON i.id = o.image_id
      WHERE c.poll_id = ? ORDER BY c.position, o.position`),
    open: db.prepare(`UPDATE polls SET status = 'open', opened_at = ?, updated_at = ? WHERE id = ? AND status = 'draft'`),
    close: db.prepare(`UPDATE polls SET status = 'closed', closed_at = ?, updated_at = ?, results_json = ?, results_hash = ?
      WHERE id = ? AND status = 'open'`),
    remove: db.prepare('DELETE FROM polls WHERE id = ?'),
    dueToClose: db.prepare(`SELECT id FROM polls WHERE status = 'open' AND closes_at IS NOT NULL AND closes_at <= ?`),
  };

  function insertStructure(pollId, categories) {
    categories.forEach((cat, ci) => {
      const { lastInsertRowid } = stmts.insertCategory.run(pollId, ci, cat.title, cat.description, cat.allowBlank ? 1 : 0);
      cat.options.forEach((opt, oi) => stmts.insertOption.run(Number(lastInsertRowid), oi, opt.name, opt.imageId || null));
    });
  }

  return {
    create(publicId, input) {
      return transaction(db, () => {
        const ts = now();
        const { lastInsertRowid } = stmts.insertPoll.run(
          publicId, input.title, input.description, input.accessMode, input.closesAt, ts, ts,
        );
        const id = Number(lastInsertRowid);
        insertStructure(id, input.categories);
        return id;
      });
    },

    /** Substitui a configuração completa (permitido apenas em rascunho; checado no serviço). */
    update(id, input) {
      transaction(db, () => {
        stmts.updatePoll.run(input.title, input.description, input.accessMode, input.closesAt, now(), id);
        stmts.deleteCategories.run(id);
        insertStructure(id, input.categories);
        stmts.deleteOrphanImages.run(id, id);
      });
    },

    findById: (id) => mapPoll(stmts.byId.get(id)),
    findByPublicId: (publicId) => mapPoll(stmts.byPublicId.get(publicId)),
    list: () => stmts.list.all().map(mapPoll),

    /** Categorias com suas opções e contadores. */
    structure(pollId) {
      const options = stmts.options.all(pollId);
      return stmts.categories.all(pollId).map((c) => ({
        id: c.id,
        position: c.position,
        title: c.title,
        description: c.description,
        allowBlank: c.allow_blank === 1,
        blankVotes: c.blank_votes,
        options: options
          .filter((o) => o.category_id === c.id)
          .map((o) => ({
            id: o.id, position: o.position, name: o.name, votes: o.votes,
            imageId: o.image_id || null, imageSource: o.image_source || null,
          })),
      }));
    },

    markOpen: (id) => stmts.open.run(now(), now(), id).changes === 1,

    /** Encerra e grava o snapshot oficial. Só altera se ainda estiver aberta. */
    markClosed(id, buildSnapshot) {
      return transaction(db, () => {
        const poll = mapPoll(stmts.byId.get(id));
        if (!poll || poll.status !== 'open') return false;
        const closedAt = now();
        const { json, hash } = buildSnapshot(poll, closedAt);
        return stmts.close.run(closedAt, closedAt, json, hash, id).changes === 1;
      });
    },

    /**
     * Copia a configuração (categorias, alternativas e imagens) para um novo
     * rascunho. Votos, participações e códigos NÃO são copiados.
     */
    duplicate(id, newPublicId, newImageId) {
      return transaction(db, () => {
        const poll = mapPoll(stmts.byId.get(id));
        const ts = now();
        const { lastInsertRowid } = stmts.insertPoll.run(newPublicId, poll.title, poll.description, poll.accessMode, null, ts, ts);
        const copyId = Number(lastInsertRowid);

        const imageMap = new Map();
        for (const row of db.prepare('SELECT * FROM images WHERE poll_id = ?').all(id)) {
          const newId = newImageId();
          db.prepare(`INSERT INTO images (id, poll_id, mime, width, height, data, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(newId, copyId, row.mime, row.width, row.height, row.data, row.source, ts);
          imageMap.set(row.id, newId);
        }
        const categories = this.structure(id).map((c) => ({
          title: c.title, description: c.description, allowBlank: c.allowBlank,
          options: c.options.map((o) => ({ name: o.name, imageId: o.imageId ? imageMap.get(o.imageId) : null })),
        }));
        insertStructure(copyId, categories);
        return copyId;
      });
    },

    remove: (id) => stmts.remove.run(id).changes === 1,
    idsDueToClose: (iso) => stmts.dueToClose.all(iso).map((r) => r.id),
  };
}
