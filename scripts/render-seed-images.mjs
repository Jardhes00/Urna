/**
 * Converte as ilustrações SVG de server/db/seed-images/fontes/ em PNG 640x640
 * (formato aceito também pelo PowerPoint), usando o Edge/Chrome instalado.
 *
 *   node scripts/render-seed-images.mjs            (Edge)
 *   BROWSER_CHANNEL=chrome node scripts/render-seed-images.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server', 'db', 'seed-images');
const sources = path.join(dir, 'fontes');

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 640, height: 640 } });

for (const file of fs.readdirSync(sources).filter((f) => f.endsWith('.svg'))) {
  const svg = fs.readFileSync(path.join(sources, file), 'utf8');
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`);
  const out = path.join(dir, file.replace(/\.svg$/, '.png'));
  await page.locator('svg').first().screenshot({ path: out, omitBackground: true });
  console.log('gerado', path.relative(process.cwd(), out));
}
await browser.close();
