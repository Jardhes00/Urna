// Ícones de traço (24x24), desenhados para este projeto no estilo "outline".
const PATHS = {
  ballot: 'M4 10h16v10H4z M8 10V4h8v6 M10 7h4 M9 15h6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  checkCircle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M8 12.5l2.8 2.8L16.5 9.5',
  alert: 'M12 3l9.5 17h-19z M12 10v4 M12 17.2v.3',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 11v5 M12 7.8v.2',
  lock: 'M6 11h12v9H6z M8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  shield: 'M12 3l7.5 3v5.5c0 4.5-3.2 8.2-7.5 9.5-4.3-1.3-7.5-5-7.5-9.5V6z M9 12l2.2 2.2L15.5 10',
  copy: 'M9 9h11v11H9z M15 9V4H4v11h5',
  share: 'M12 15V3 M7.5 7.5L12 3l4.5 4.5 M5 12v8h14v-8',
  external: 'M14 4h6v6 M20 4l-9 9 M18 14v6H4V6h6',
  plus: 'M12 5v14 M5 12h14',
  trash: 'M4 7h16 M9 7V4h6v3 M6.5 7l1 13h9l1-13 M10 11v5 M14 11v5',
  edit: 'M4 20h4L19 9l-4-4L4 16z M13.5 6.5l4 4',
  play: 'M7 4.5v15l12-7.5z',
  flag: 'M5 21V4 M5 4h12l-2.5 4L17 12H5',
  download: 'M12 3v12 M7.5 10.5L12 15l4.5-4.5 M5 20h14',
  file: 'M6 3h8l4 4v14H6z M14 3v4h4',
  slides: 'M3 5h18v12H3z M12 17v4 M8 21h8',
  sheet: 'M4 4h16v16H4z M4 9.5h16 M4 15h16 M10 4v16',
  archive: 'M3 4h18v5H3z M5 9v11h14V9 M10 13h4',
  arrowLeft: 'M19 12H5 M11 6l-6 6 6 6',
  arrowRight: 'M5 12h14 M13 6l6 6-6 6',
  chevronUp: 'M6 15l6-6 6 6',
  chevronDown: 'M6 9l6 6 6-6',
  logout: 'M15 4h4v16h-4 M10 8l-4 4 4 4 M6 12h10',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0z M8 6H5v1.5A3.5 3.5 0 0 0 8.5 11 M16 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5 M12 13v4 M8.5 20h7 M10 17h4v3h-4z',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5 M16 4.3a3.5 3.5 0 0 1 0 6.4 M18 14.8c1.9.8 3.1 2.6 3.5 5.2',
  key: 'M14.5 9.5a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0z M13.2 12.7L20 19.5 M17 16.5l2-2 M18.5 18l1.5-1.5',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2',
  eye: 'M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff: 'M3 3l18 18 M10.6 5.1A10 10 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-2.6 3.4 M6.6 6.6C3.9 8.4 2.5 12 2.5 12s3.5 7 9.5 7a9.6 9.6 0 0 0 4.4-1.1 M9.9 9.9a3 3 0 0 0 4.2 4.2',
  refresh: 'M20 11a8 8 0 0 0-14.6-4.5L4 8 M4 4v4h4 M4 13a8 8 0 0 0 14.6 4.5L20 16 M20 20v-4h-4',
  printer: 'M7 9V3h10v6 M7 17H4v-7h16v7h-3 M7 14h10v7H7z',
  presentation: 'M3 4h18 M4.5 4v10h15V4 M12 14v3 M8 21l4-4 4 4',
  x: 'M6 6l12 12 M18 6L6 18',
  calendar: 'M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4',
  wifiOff: 'M3 3l18 18 M8.5 16.5a5 5 0 0 1 7 0 M5 13a10 10 0 0 1 5.3-2.8 M12 20h.01 M2 9.5a15 15 0 0 1 4.6-2.9 M16.8 10.9A10 10 0 0 1 19 13 M11.5 5a15 15 0 0 1 10.5 4.5',
};

const SVG_NS = 'http://www.w3.org/2000/svg';

export function icon(name, { label, size } = {}) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  if (size) { svg.setAttribute('width', size); svg.setAttribute('height', size); }
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
  }
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', PATHS[name] || PATHS.info);
  svg.append(path);
  return svg;
}

/** Substitui <span data-icon="nome"> estáticos do HTML pelos SVGs. */
export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    el.replaceWith(icon(el.dataset.icon));
  });
}
