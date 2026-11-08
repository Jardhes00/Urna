import { badRequest } from './errors.js';

export const LIMITS = {
  titleMax: 120,
  descriptionMax: 500,
  categoryDescriptionMax: 300,
  optionNameMax: 80,
  categoriesMax: 20,
  optionsMin: 2,
  optionsMax: 60,
  tokensMax: 1000,
};

export const IMAGE_ID = /^[A-Za-z0-9_-]{16,32}$/;

/** Remove caracteres de controle e espaços excedentes. */
function cleanText(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Valida e normaliza a configuração de uma votação.
 * Erros são acumulados por campo para que o formulário mostre todos de uma vez.
 */
export function validatePollInput(body) {
  const errors = {};
  const input = body && typeof body === 'object' ? body : {};

  const title = cleanText(input.title);
  if (title.length < 3) errors.title = 'Informe um título com pelo menos 3 caracteres.';
  else if (title.length > LIMITS.titleMax) errors.title = `O título pode ter no máximo ${LIMITS.titleMax} caracteres.`;

  const description = cleanText(input.description);
  if (description.length > LIMITS.descriptionMax) {
    errors.description = `A descrição pode ter no máximo ${LIMITS.descriptionMax} caracteres.`;
  }

  const accessMode = input.accessMode === 'token' ? 'token' : 'link';

  let closesAt = null;
  if (input.closesAt) {
    const date = new Date(input.closesAt);
    if (Number.isNaN(date.getTime())) errors.closesAt = 'Data de encerramento inválida.';
    else closesAt = date.toISOString();
  }

  const rawCategories = Array.isArray(input.categories) ? input.categories : [];
  if (rawCategories.length === 0) errors.categories = 'Adicione pelo menos uma categoria.';
  if (rawCategories.length > LIMITS.categoriesMax) {
    errors.categories = `Use no máximo ${LIMITS.categoriesMax} categorias.`;
  }

  const categories = rawCategories.slice(0, LIMITS.categoriesMax).map((cat, ci) => {
    const prefix = `categories.${ci}`;
    const catTitle = cleanText(cat?.title);
    if (!catTitle) errors[`${prefix}.title`] = 'Informe o nome da categoria.';
    else if (catTitle.length > LIMITS.titleMax) errors[`${prefix}.title`] = 'Nome da categoria muito longo.';

    const catDescription = cleanText(cat?.description);
    if (catDescription.length > LIMITS.categoryDescriptionMax) {
      errors[`${prefix}.description`] = `Descrição com no máximo ${LIMITS.categoryDescriptionMax} caracteres.`;
    }

    // Cada alternativa: "nome" ou { name, imageId }. A posse da imagem é conferida no serviço.
    const optionObjects = (Array.isArray(cat?.options) ? cat.options : [])
      .map((opt) => ({
        name: cleanText(typeof opt === 'string' ? opt : opt?.name),
        imageId: typeof opt === 'object' && IMAGE_ID.test(opt?.imageId || '') ? opt.imageId : null,
      }))
      .filter((o) => o.name);
    const options = optionObjects.map((o) => o.name);

    if (options.length < LIMITS.optionsMin) {
      errors[`${prefix}.options`] = `Informe pelo menos ${LIMITS.optionsMin} opções.`;
    } else if (options.length > LIMITS.optionsMax) {
      errors[`${prefix}.options`] = `Use no máximo ${LIMITS.optionsMax} opções por categoria.`;
    } else if (options.some((o) => o.length > LIMITS.optionNameMax)) {
      errors[`${prefix}.options`] = `Cada opção pode ter no máximo ${LIMITS.optionNameMax} caracteres.`;
    } else {
      const seen = new Set();
      const dup = options.find((o) => {
        const key = o.toLocaleLowerCase('pt-BR');
        if (seen.has(key)) return true;
        seen.add(key);
        return false;
      });
      if (dup) errors[`${prefix}.options`] = `A opção "${dup}" está repetida.`;
      else if (options.some((o) => o.toLocaleLowerCase('pt-BR') === 'branco')) {
        errors[`${prefix}.options`] = 'Não cadastre "Branco" como opção; use a chave "Permitir voto em branco".';
      }
    }

    return { title: catTitle, description: catDescription, allowBlank: cat?.allowBlank !== false, options: optionObjects };
  });

  const seenTitles = new Set();
  categories.forEach((cat, ci) => {
    const key = cat.title.toLocaleLowerCase('pt-BR');
    if (key && seenTitles.has(key)) errors[`categories.${ci}.title`] = 'Já existe uma categoria com este nome.';
    seenTitles.add(key);
  });

  if (Object.keys(errors).length) throw badRequest('Revise os campos destacados.', errors);
  return { title, description, accessMode, closesAt, categories };
}

/**
 * Valida o formato da cédula. A coerência com as categorias da votação é
 * verificada no serviço de votação, que conhece o esquema da votação.
 */
export function validateBallotInput(body) {
  const input = body && typeof body === 'object' ? body : {};
  const choices = Array.isArray(input.choices) ? input.choices : null;
  if (!choices || choices.length === 0 || choices.length > LIMITS.categoriesMax) {
    throw badRequest('Cédula inválida.');
  }
  const parsed = choices.map((c) => ({
    categoryId: Number(c?.categoryId),
    optionId: c?.optionId === null ? null : Number(c?.optionId),
  }));
  if (parsed.some((c) => !Number.isInteger(c.categoryId) || (c.optionId !== null && !Number.isInteger(c.optionId)))) {
    throw badRequest('Cédula inválida.');
  }

  const voterKey = typeof input.voterKey === 'string' ? input.voterKey : '';
  const code = typeof input.code === 'string' ? input.code : '';
  return { choices: parsed, voterKey, code };
}

export function isValidVoterKey(key) {
  return /^[A-Za-z0-9_-]{22,128}$/.test(key);
}
