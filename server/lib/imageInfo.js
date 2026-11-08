/**
 * Identifica PNG/JPEG pelos bytes iniciais (não confia na extensão nem no
 * Content-Type enviado) e lê as dimensões do cabeçalho. Outros formatos —
 * inclusive SVG, que pode conter scripts — são recusados.
 * @returns {{ mime: string, width: number, height: number } | null}
 */
export function imageInfo(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 24) return null;

  // PNG: assinatura de 8 bytes + bloco IHDR com largura/altura.
  if (buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(4) === 0x0d0a1a0a && buf.toString('ascii', 12, 16) === 'IHDR') {
    return { mime: 'image/png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }

  // JPEG: percorre os segmentos até um marcador SOF (início de quadro).
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    let offset = 2;
    while (offset + 9 < buf.length) {
      if (buf[offset] !== 0xff) return null;
      const marker = buf[offset + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
      const length = buf.readUInt16BE(offset + 2);
      const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isSof) return { mime: 'image/jpeg', height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
      offset += 2 + length;
    }
  }
  return null;
}
