import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomId } from '../lib/crypto.js';
import { imageInfo } from '../lib/imageInfo.js';
import { validatePollInput } from '../lib/validation.js';

/* ============================================================================
 *  VOTAÇÃO INICIAL — EDITE AQUI
 *
 *  - "titulo": nome da categoria (aparece na cédula, nos slides e na planilha).
 *  - "opcoes": as alternativas que a pessoa toca para votar. Cada uma pode ser:
 *        'Nome'                                    → sem imagem
 *        { nome: 'Nome', imagem: 'arquivo.png' }   → com imagem
 *    As imagens ficam na pasta server/db/seed-images/ (PNG ou JPG, de preferência quadradas).
 *    Também dá para anexar imagens direto pelo painel (Editar → Imagens das alternativas).
 *  - Não repita alternativas dentro da mesma categoria nem use "Branco".
 *
 *  Depois de salvar, reinicie o servidor (Ctrl+C e `npm start`). Enquanto a
 *  votação estiver em RASCUNHO e você não a tiver editado pelo painel, ela é
 *  atualizada automaticamente com o conteúdo abaixo.
 *
 *  ESTA LISTA É A URNA PRONTA: se a votação for excluída, ela é recriada daqui
 *  ao iniciar o servidor ou pelo botão "Criar urna pronta" do painel. Edições
 *  feitas só pelo painel não ficam nesta lista: o que não pode se perder, escreva aqui.
 * ========================================================================== */

const TITULO_DA_VOTACAO = 'Urna Eletrônica';

const CATEGORIAS = [
  {
    titulo: 'Categoria 1 - Melhor rolê',
    opcoes: [
      { nome: 'Brasil X Marrocos', imagem: 'brasil-x-marrocos.png' },
      'Melão 5 anos/Halloween disfarçado',
      'Opção 3',
      'Opção 4',
      { nome: 'Nulo', imagem: 'nulo.png' },
    ],
  },
  {
    titulo: 'Categoria 2 - Maior CAGADA',
    opcoes: ['Luiza!', 'Leo Castro e Luiza', 'Gordox e Luiza!', 'Luiza 2 vzs, mt grande', 'Opção 5'],
  },
  {
    titulo: 'Categoria 3 - Melhor Novato',
    opcoes: ['Antônio', 'Opção 2', 'Opção 3', 'Opção 4', 'Opção 5'],
  },
  {
    titulo: 'Categoria 4 - Melhor PT',
    opcoes: ['Jardhel', 'Paizão', 'Elias', 'Gomide', 'Opção 5'],
  },
  {
    titulo: 'Categoria 5 - Melhor Bebida',
    opcoes: [
      { nome: 'Brahma', imagem: 'bebida-cerveja.png' },
      { nome: 'Caipirinha', imagem: 'bebida-caipirinha.png' },
      { nome: 'Dose de Tetê em eventos', imagem: 'bebida-dose.png' },
      'Pink Lemonade',
      'Opção 5',
    ],
  },
  {
    titulo: 'Categoria 6 - Melhor Local',
    opcoes: ['Bar de Pedrin', 'Casa Jardhel', 'Praça Armando Rios', 'Opção 4', 'Opção 5'],
  },
  {
    titulo: 'Categoria 7 - Melhor casal',
    opcoes: ['Opção 1', 'Opção 2', 'Opção 3', 'Opção 4', 'Opção 5'],
  },
  {
    titulo: 'Categoria 8 - MVP contrário',
    opcoes: ['Gomide', 'Vidal', 'Opção 3', 'Opção 4', 'Opção 5'],
  },
  {
    titulo: 'Categoria 9 - MVP',
    opcoes: ['Paizão', 'Elias', 'Jardhel', 'Gomide', 'Opção 5'],
  },
];

export const SEED_IMAGES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'seed-images');

const optName = (o) => (typeof o === 'string' ? o : o.nome);
const optFile = (o) => (typeof o === 'string' ? null : o.imagem || null);

/** Formato aceito pela API (alternativas como nomes) — usado também nos testes. */
export const DEFAULT_POLL = {
  title: TITULO_DA_VOTACAO,
  description: '',
  accessMode: 'link',
  closesAt: null,
  categories: CATEGORIAS.map(({ titulo, opcoes }) => ({
    title: titulo, description: '', allowBlank: false, options: opcoes.map(optName),
  })),
};

/** Arquivo de imagem de cada alternativa, por categoria: [{ nome: arquivo }]. */
export const DEFAULT_IMAGE_FILES = CATEGORIAS.map(({ opcoes }) =>
  Object.fromEntries(opcoes.filter(optFile).map((o) => [optName(o).trim(), optFile(o)])));

const range = (n, label) => Array.from({ length: n }, (_, i) => `${label} ${i + 1}`);

/** Versões anteriores da votação inicial, reconhecidas para atualização automática. */
export const V1_POLL = {
  title: 'Urna Eletrônica',
  categories: [
    ['Categoria 1 - Presidente', 4], ['Categoria 2 - Governador', 4], ['Categoria 3 - Senador', 4],
    ['Categoria 4 - Deputado Federal', 4], ['Categoria 5 - Prefeito', 4], ['Categoria 6 - Vereador', 4],
    ['Categoria 7 - Deputado Estadual', 9], ['Categoria 8 - Conselheiro', 9],
  ].map(([title, n]) => ({ title, options: range(n, 'Opção') })),
};
const V2_POLL = {
  title: 'Urna Eletrônica',
  categories: range(9, 'Categoria').map((title) => ({ title, options: range(5, 'Opção') })),
};

const STATE_KEY = 'default_poll';
const UPLOADED = '<enviada pelo painel>';

/**
 * Forma comparável de uma votação. Cada alternativa é só o nome, ou [nome, imagem]
 * quando há imagem — assim votações sem imagem mantêm o formato das versões anteriores.
 */
const shape = (title, categories) => JSON.stringify({
  title, categories: categories.map((c) => [c.title, c.options.map((o) => (o.image ? [o.name, o.image] : o.name))]),
});
const shapeOfDb = (polls, poll) => shape(poll.title, polls.structure(poll.id).map((c) => ({
  title: c.title,
  options: c.options.map((o) => ({ name: o.name, image: o.imageId ? (o.imageSource || UPLOADED) : null })),
})));

/** Lê e valida a lista acima; `shape` identifica esta versão da urna pronta. */
function loadModel() {
  let model;
  try {
    model = validatePollInput(DEFAULT_POLL);
  } catch (err) {
    const details = Object.values(err.details || {}).join(' ');
    throw new Error(`server/db/seed.js tem um problema na lista de categorias: ${details || err.message}`);
  }
  model.categories.forEach((c, i) => c.options.forEach((o) => { o.image = DEFAULT_IMAGE_FILES[i][o.name] || null; }));
  for (const file of new Set(model.categories.flatMap((c) => c.options.map((o) => o.image).filter(Boolean)))) {
    if (!fs.existsSync(path.join(SEED_IMAGES_DIR, file))) {
      throw new Error(`server/db/seed.js: imagem "${file}" não encontrada em server/db/seed-images/.`);
    }
  }
  return { desired: model, desiredShape: shape(model.title, model.categories) };
}

// Guarda também o publicId: o id numérico de uma votação excluída pode ser reaproveitado pelo banco.
const saveState = (db, polls, pollId, desiredShape) => db.prepare('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)')
  .run(STATE_KEY, JSON.stringify({ pollId, publicId: polls.findById(pollId).publicId, shape: desiredShape }));

/** Grava a lista na votação, enviando as imagens dos arquivos, e passa a acompanhá-la. */
function applyModel(db, polls, images, { desired, desiredShape }, pollId) {
  const loaded = new Map();
  for (const option of desired.categories.flatMap((c) => c.options)) {
    if (!option.image) { option.imageId = null; continue; }
    if (!loaded.has(option.image)) {
      const data = fs.readFileSync(path.join(SEED_IMAGES_DIR, option.image));
      const info = imageInfo(data);
      if (!info) throw new Error(`server/db/seed.js: "${option.image}" não é um PNG/JPG válido.`);
      loaded.set(option.image, images.insert({ id: randomId(16), pollId, ...info, data, source: option.image }));
    }
    option.imageId = loaded.get(option.image);
  }
  polls.update(pollId, desired);
  saveState(db, polls, pollId, desiredShape);
}

function createFromModel(db, polls, images, model) {
  const empty = { ...model.desired, categories: model.desired.categories.map((c) => ({ ...c, options: c.options.map((o) => ({ name: o.name, imageId: null })) })) };
  const id = polls.create(randomId(9), empty);
  applyModel(db, polls, images, model, id);
  return id;
}

/** Cria um novo rascunho com a urna pronta (botão do painel). @returns {number} id da votação */
export function createDefaultPoll(db, polls, images) {
  const model = loadModel();
  // Já existe um rascunho idêntico: reaproveita, para não haver duas votações iguais com o mesmo nome.
  const existing = polls.list().find((p) => p.status === 'draft' && shapeOfDb(polls, p) === model.desiredShape);
  if (existing) {
    saveState(db, polls, existing.id, model.desiredShape);
    return existing.id;
  }
  return createFromModel(db, polls, images, model);
}

/**
 * Garante que a urna pronta exista: se a votação acompanhada foi excluída, recria.
 * Também a mantém sincronizada com a lista acima ENQUANTO for um rascunho não
 * editado pelo painel. Nunca altera votações abertas, encerradas ou editadas.
 * @returns {string|null} mensagem para o log, quando houver algo a informar
 */
export function seedDefaultPoll(db, polls, images) {
  const model = loadModel();
  const { desiredShape } = model;

  const row = db.prepare('SELECT value FROM app_state WHERE key = ?').get(STATE_KEY);
  const state = row ? JSON.parse(row.value) : null;
  const all = polls.list();
  const tracked = state && all.find((p) => p.id === state.pollId && (!state.publicId || p.publicId === state.publicId));
  if (tracked && state.shape === desiredShape) {
    if (!state.publicId) saveState(db, polls, tracked.id, desiredShape);
    return null;
  }

  // Votação que ainda corresponde à última versão aplicada (ou a uma versão antiga conhecida).
  const legacyShape = (m) => shape(m.title, m.categories.map((c) => ({ title: c.title, options: c.options.map((name) => ({ name })) })));
  const knownShapes = new Set(state ? [state.shape] : [legacyShape(V1_POLL), legacyShape(V2_POLL)]);
  const isUntouchedDraft = (p) => p.status === 'draft' && knownShapes.has(shapeOfDb(polls, p));
  let candidate = state ? tracked : all.find(isUntouchedDraft);
  // Votação acompanhada já foi aberta/encerrada ou excluída: segue uma cópia em rascunho
  // idêntica (ex.: criada com "Duplicar" no painel), se houver.
  if (state && !(candidate && isUntouchedDraft(candidate))) candidate = all.find(isUntouchedDraft) || candidate;

  if (candidate) {
    if (candidate.status === 'draft' && knownShapes.has(shapeOfDb(polls, candidate))) {
      applyModel(db, polls, images, model, candidate.id);
      return 'Votação inicial atualizada com o conteúdo de server/db/seed.js.';
    }
    return 'server/db/seed.js foi alterado, mas a votação inicial já foi aberta ou editada pelo painel: nada foi alterado. Edite-a pelo painel.';
  }

  // A votação já está igual à lista (ex.: editada antes deste mecanismo existir): passa a acompanhá-la.
  const identical = all.find((p) => p.status === 'draft' && shapeOfDb(polls, p) === desiredShape);
  if (identical) {
    saveState(db, polls, identical.id, desiredShape);
    return null;
  }

  createFromModel(db, polls, images, model);
  return state ? 'A urna pronta havia sido excluída e foi recriada a partir de server/db/seed.js.' : null;
}
