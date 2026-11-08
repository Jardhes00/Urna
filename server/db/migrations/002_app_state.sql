-- Estado interno da aplicação (ex.: última versão aplicada da votação inicial de server/db/seed.js).
CREATE TABLE app_state (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
) WITHOUT ROWID;
