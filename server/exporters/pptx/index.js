import PptxGenJS from 'pptxgenjs';
import { defineMasters } from './masters.js';
import { addClosingSlide, addCoverSlide, addOverviewSlides, addSummarySlide } from './globalSlides.js';
import { addCategorySlides } from './categorySlides.js';
import { postprocessPptx } from './postprocess.js';
import { FONTS } from '../theme.js';

/**
 * Gera a apresentação .pptx a partir do snapshot OFICIAL (votação encerrada).
 * Todos os elementos são editáveis: textos, tabelas, formas e gráficos nativos.
 * @returns {Promise<Buffer>}
 */
export async function buildPresentation(snapshot, resultsHash, images = new Map()) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = `Resultado — ${snapshot.poll.title}`;
  pptx.subject = 'Resultado oficial da votação';
  pptx.company = 'Urna Online';
  pptx.author = 'Urna Online';
  pptx.lang = 'pt-BR';
  pptx.theme = { headFontFace: FONTS.heading, bodyFontFace: FONTS.body };

  defineMasters(pptx, snapshot.poll.title);

  addCoverSlide(pptx, snapshot);
  addSummarySlide(pptx, snapshot);
  addOverviewSlides(pptx, snapshot);
  snapshot.categories.forEach((category, index) => {
    addCategorySlides(pptx, category, index, snapshot.categories.length, snapshot.ballotCount, images);
  });
  addClosingSlide(pptx, snapshot, resultsHash);

  const raw = await pptx.write({ outputType: 'nodebuffer' });
  return postprocessPptx(raw);
}
