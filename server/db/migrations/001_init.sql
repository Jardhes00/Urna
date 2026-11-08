-- Esquema inicial da Urna Online.
--
-- Princípio de privacidade: o CONTROLE DE PARTICIPAÇÃO (quem já votou) e o
-- CONTEÚDO DOS VOTOS (em quem votou) ficam em estruturas sem nenhuma ligação.
--   * participations: apenas o hash da chave/código de participação, sem horário.
--   * options.votes / categories.blank_votes: contadores agregados. Não existe
--     registro individual de cédula, então não há como reconstruir o voto de alguém.

CREATE TABLE polls (
  id            INTEGER PRIMARY KEY,
  public_id     TEXT    NOT NULL UNIQUE,
  title         TEXT    NOT NULL,
  description   TEXT    NOT NULL DEFAULT '',
  access_mode   TEXT    NOT NULL DEFAULT 'link' CHECK (access_mode IN ('link', 'token')),
  status        TEXT    NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed')),
  closes_at     TEXT,
  ballot_count  INTEGER NOT NULL DEFAULT 0,
  results_json  TEXT,
  results_hash  TEXT,
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL,
  opened_at     TEXT,
  closed_at     TEXT
);

CREATE TABLE categories (
  id           INTEGER PRIMARY KEY,
  poll_id      INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL,
  title        TEXT    NOT NULL,
  description  TEXT    NOT NULL DEFAULT '',
  allow_blank  INTEGER NOT NULL DEFAULT 1,
  blank_votes  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (poll_id, position)
);

CREATE TABLE options (
  id           INTEGER PRIMARY KEY,
  category_id  INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL,
  name         TEXT    NOT NULL,
  votes        INTEGER NOT NULL DEFAULT 0,
  UNIQUE (category_id, position)
);

-- WITHOUT ROWID: as linhas ficam ordenadas pelo hash (aleatório), e não pela
-- ordem de inserção, evitando correlação temporal com os contadores.
CREATE TABLE participations (
  poll_id     INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  voter_hash  TEXT    NOT NULL,
  PRIMARY KEY (poll_id, voter_hash)
) WITHOUT ROWID;

-- Códigos de uso único (modo "token"). O código fica guardado em texto para que
-- o administrador possa reimprimir a lista; o uso é verificado via participations.
CREATE TABLE tokens (
  poll_id     INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  code_hash   TEXT    NOT NULL,
  code        TEXT    NOT NULL,
  PRIMARY KEY (poll_id, code_hash)
) WITHOUT ROWID;

CREATE TABLE admin_sessions (
  id_hash     TEXT PRIMARY KEY,
  expires_at  TEXT NOT NULL
) WITHOUT ROWID;

CREATE INDEX idx_categories_poll ON categories(poll_id);
CREATE INDEX idx_options_category ON options(category_id);
