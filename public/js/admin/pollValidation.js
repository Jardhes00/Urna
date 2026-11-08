/**
 * Validação no navegador — espelha server/lib/validation.js para dar retorno
 * imediato. O servidor SEMPRE valida de novo; esta camada é só conveniência.
 */
export const LIMITS = { title: 120, description: 500, categoryDescription: 300, option: 80, categories: 20, optionsMin: 2, optionsMax: 60 };

export const parseOptions = (text) => text.split('\n').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);

export function validatePollForm(form) {
  const errors = {};
  const title = form.title.trim();
  if (title.length < 3) errors.title = 'Informe um título com pelo menos 3 caracteres.';
  else if (title.length > LIMITS.title) errors.title = `Use no máximo ${LIMITS.title} caracteres.`;
  if (form.description.trim().length > LIMITS.description) errors.description = `Use no máximo ${LIMITS.description} caracteres.`;

  if (form.closesAt) {
    const date = new Date(form.closesAt);
    if (Number.isNaN(date.getTime())) errors.closesAt = 'Data inválida.';
    else if (date <= new Date()) errors.closesAt = 'Escolha uma data e hora no futuro.';
  }

  if (!form.categories.length) errors.categories = 'Adicione pelo menos uma categoria.';
  const titles = new Set();
  form.categories.forEach((cat, i) => {
    const p = `categories.${i}`;
    const t = cat.title.trim().toLocaleLowerCase('pt-BR');
    if (!t) errors[`${p}.title`] = 'Informe o nome da categoria.';
    else if (titles.has(t)) errors[`${p}.title`] = 'Já existe uma categoria com este nome.';
    titles.add(t);
    if (cat.description.trim().length > LIMITS.categoryDescription) errors[`${p}.description`] = `Use no máximo ${LIMITS.categoryDescription} caracteres.`;

    const options = parseOptions(cat.optionsText);
    const seen = new Set();
    const dup = options.find((o) => { const k = o.toLocaleLowerCase('pt-BR'); if (seen.has(k)) return true; seen.add(k); return false; });
    if (options.length < LIMITS.optionsMin) errors[`${p}.options`] = `Informe pelo menos ${LIMITS.optionsMin} opções, uma por linha.`;
    else if (options.length > LIMITS.optionsMax) errors[`${p}.options`] = `Use no máximo ${LIMITS.optionsMax} opções.`;
    else if (options.some((o) => o.length > LIMITS.option)) errors[`${p}.options`] = `Cada opção pode ter no máximo ${LIMITS.option} caracteres.`;
    else if (dup) errors[`${p}.options`] = `A opção “${dup}” está repetida.`;
    else if (seen.has('branco')) errors[`${p}.options`] = 'Não cadastre “Branco” como opção: use a chave “Permitir voto em branco”.';
  });
  return errors;
}

/** Formato enviado à API. */
export function toPayload(form) {
  return {
    title: form.title,
    description: form.description,
    accessMode: form.accessMode,
    closesAt: form.closesAt ? new Date(form.closesAt).toISOString() : null,
    categories: form.categories.map((c) => ({
      title: c.title,
      description: c.description,
      allowBlank: c.allowBlank,
      options: parseOptions(c.optionsText).map((name) => ({ name, imageId: c.images?.[name]?.imageId || null })),
    })),
  };
}
