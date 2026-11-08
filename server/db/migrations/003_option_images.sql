-- Imagens das alternativas (ilustrações/fotos exibidas na cédula, no painel e nos slides).
-- Guardadas no próprio banco: um único arquivo para backup e nenhum disco extra no deploy.
CREATE TABLE images (
  id          TEXT    PRIMARY KEY,               -- aleatório, usado na URL /img/<id>
  poll_id     INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  mime        TEXT    NOT NULL CHECK (mime IN ('image/png', 'image/jpeg')),
  width       INTEGER NOT NULL,
  height      INTEGER NOT NULL,
  data        BLOB    NOT NULL,
  source      TEXT,                              -- arquivo de origem quando vem de server/db/seed.js
  created_at  TEXT    NOT NULL
);
CREATE INDEX idx_images_poll ON images(poll_id);

ALTER TABLE options ADD COLUMN image_id TEXT REFERENCES images(id) ON DELETE SET NULL;
