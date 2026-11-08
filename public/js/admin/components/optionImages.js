import { uploadBinary } from '../../shared/api.js';
import { h, mount, setLoading, uid } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';
import { toast } from '../../shared/feedback.js';
import { initials, toSquareJpeg } from '../../shared/imageResize.js';
import { parseOptions } from '../pollValidation.js';

/**
 * Lista das alternativas de uma categoria com o botão de anexar imagem em cada.
 * As imagens ficam em `cat.images` (nome da alternativa → { imageId, imageUrl })
 * e só passam a valer na votação quando o formulário é salvo.
 */
export function optionImagesField({ pollId, cat, onChange, handleError }) {
  const list = h('ul', { class: 'option-images__list' });
  const root = h('div', { class: 'field option-images' },
    h('p', { class: 'label' }, 'Imagens das alternativas', h('span', { class: 'optional' }, ' (opcional)')),
    pollId
      ? h('p', { class: 'hint' }, 'Aparecem na cédula, no painel e nos slides. Fotos são cortadas no centro em formato quadrado.')
      : h('p', { class: 'hint' }, 'Salve o rascunho primeiro; depois, em “Editar”, você poderá anexar uma imagem para cada alternativa.'),
    pollId ? list : null);

  async function attach(name, file, button) {
    setLoading(button);
    try {
      const blob = await toSquareJpeg(file);
      const { imageId, url } = await uploadBinary(`/api/admin/polls/${pollId}/images`, blob);
      cat.images[name] = { imageId, imageUrl: url };
      onChange();
      toast(`Imagem anexada a “${name}”. Clique em Salvar para manter.`);
      refresh();
    } catch (err) {
      setLoading(button, false);
      if (!handleError(err)) toast(err.message, { type: 'error', duration: 6000 });
    }
  }

  function row(name) {
    const current = cat.images[name];
    const inputId = uid('img');
    const fileInput = h('input', { id: inputId, type: 'file', accept: 'image/jpeg,image/png,image/webp,image/heic', class: 'visually-hidden' });
    const pick = h('button', { class: 'btn btn--secondary btn--sm', type: 'button', onClick: () => fileInput.click() },
      icon(current ? 'refresh' : 'plus'), h('span', {}, current ? 'Trocar' : 'Anexar'));
    pick.setAttribute('aria-label', `${current ? 'Trocar' : 'Anexar'} imagem de ${name}`);
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) attach(name, fileInput.files[0], pick); });

    return h('li', { class: 'option-images__row' },
      current
        ? h('img', { class: 'option-thumb', src: current.imageUrl, alt: '' })
        : h('span', { class: 'option-thumb option-thumb--empty', 'aria-hidden': 'true' }, initials(name)),
      h('span', { class: 'option-images__name' }, name),
      h('span', { class: 'option-images__actions' },
        pick,
        current ? h('button', {
          class: 'icon-btn icon-btn--danger', type: 'button', 'aria-label': `Remover imagem de ${name}`, title: 'Remover imagem',
          onClick: () => { delete cat.images[name]; onChange(); refresh(); },
        }, icon('trash')) : null),
      fileInput);
  }

  function refresh() {
    if (!pollId) return;
    const names = parseOptions(cat.optionsText);
    mount(list, names.length ? names.map(row) : h('li', { class: 'hint' }, 'Digite as alternativas acima para anexar imagens.'));
  }

  refresh();
  return { element: root, refresh };
}
