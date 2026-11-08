import JSZip from 'jszip';

const PART = /^ppt\/(slides\/slide|slideLayouts\/slideLayout|slideMasters\/slideMaster)\d+\.xml$/;

/**
 * Correções no XML gerado pelo PptxGenJS 4.x:
 *
 * 1. Placeholders de imagem saem sem `type="pic"` (bug na conversão do tipo),
 *    o que faria o PowerPoint tratá-los como caixa de texto. Nossos únicos
 *    placeholders sem tipo são os de foto, então recebem `type="pic"`.
 * 2. Em textos com vários trechos de formatação, a biblioteca repete `<a:pPr>`
 *    depois de cada `</a:r>`, violando o esquema OOXML (o PowerPoint pode pedir
 *    "reparo"). O `<a:pPr>` só é válido como primeiro filho de `<a:p>`.
 * 3. Idioma de revisão: en-US → pt-BR, para o corretor ortográfico.
 */
export async function postprocessPptx(buffer) {
  const zip = await JSZip.loadAsync(buffer);

  await Promise.all(Object.keys(zip.files).filter((name) => PART.test(name)).map(async (name) => {
    let xml = await zip.file(name).async('string');
    xml = xml
      .replace(/<p:ph(\s+idx="\d+")\s+hasCustomPrompt="1"\s*\/>/g, '<p:ph type="pic"$1 hasCustomPrompt="1"/>')
      .replace(/(<\/a:r>)<a:pPr\b[^>]*?(?:\/>|>.*?<\/a:pPr>)/g, '$1')
      .replace(/lang="en-US"/g, 'lang="pt-BR"');
    zip.file(name, xml);
  }));

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
}
