import JSZip from 'jszip';
import { buildPresentation } from '../exporters/pptx/index.js';
import { buildWorkbook } from '../exporters/xlsx.js';
import { fileSlug } from '../exporters/theme.js';

export const MIME = {
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip',
};

/**
 * Gera os arquivos SEMPRE a partir do snapshot oficial validado (hash + somas).
 * Votações abertas são recusadas por pollService.officialResults.
 * As imagens das alternativas (só ilustração, não resultado) vêm do banco pelo optionId.
 */
export function createExportService({ pollService, polls, images, config }) {
  function load(id) {
    const snapshot = pollService.officialResults(id);
    const poll = polls.findById(Number(id));
    const base = `resultado-${fileSlug(snapshot.poll.title)}`;
    return { snapshot, resultsHash: poll.resultsHash, base, pollId: poll.id };
  }

  const presentation = ({ snapshot, resultsHash, pollId }) => buildPresentation(
    snapshot, resultsHash, config.optionImages ? images.byOptionForPoll(pollId) : new Map(),
  );

  return {
    async pptx(id) {
      const data = load(id);
      return { buffer: await presentation(data), filename: `${data.base}.pptx`, type: MIME.pptx };
    },

    async xlsx(id) {
      const { snapshot, resultsHash, base } = load(id);
      return { buffer: await buildWorkbook(snapshot, resultsHash), filename: `${base}.xlsx`, type: MIME.xlsx };
    },

    async bundle(id) {
      const data = load(id);
      const [pptx, xlsx] = await Promise.all([presentation(data), buildWorkbook(data.snapshot, data.resultsHash)]);
      const zip = new JSZip();
      zip.file(`${data.base}.pptx`, pptx);
      zip.file(`${data.base}.xlsx`, xlsx);
      const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
      return { buffer, filename: `${data.base}.zip`, type: MIME.zip };
    },
  };
}
