/**
 * Prepara a imagem no próprio navegador antes do envio: corta o centro em
 * quadrado, reduz para no máximo `size` px e converte para JPEG. Uma foto de
 * celular de vários MB vira ~60–120 KB, e todas as alternativas ficam com o
 * mesmo formato na cédula e nos slides.
 */
export async function toSquareJpeg(file, size = 640) {
  if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem (JPG ou PNG).');
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Não foi possível ler esta imagem. Tente uma foto em JPG ou PNG.');
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const target = Math.min(size, side);
  const canvas = document.createElement('canvas');
  canvas.width = target;
  canvas.height = target;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; // PNG transparente ganha fundo branco (JPEG não tem transparência)
  ctx.fillRect(0, 0, target, target);
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, target, target);
  bitmap.close?.();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Falha ao processar a imagem.'))), 'image/jpeg', 0.86);
  });
}

/** Iniciais para o marcador de alternativas sem imagem. */
export function initials(name) {
  const words = String(name).trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] || '?').slice(0, 2);
  return letters.toUpperCase();
}
