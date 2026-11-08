import crypto from 'node:crypto';

// Alfabeto sem caracteres ambíguos (0/O, 1/I/L) para códigos digitados por pessoas.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

export const randomId = (bytes = 9) => crypto.randomBytes(bytes).toString('base64url');

/** Código de participação no formato XXXX-XXXX (~39 bits de entropia). */
export function randomCode(length = 8) {
  const chars = [];
  for (let i = 0; i < length; i++) chars.push(CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]);
  const raw = chars.join('');
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/** Normaliza o que o participante digitou: maiúsculas, sem espaços, com hífen. */
export function normalizeCode(input) {
  const raw = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (raw.length !== 8) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/** Comparação em tempo constante (evita ataques de temporização na senha). */
export function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}
