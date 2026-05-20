/*
 * Post-build step. Vite emits a single dist/index.html whose <head> meta
 * tags describe the Yuniverse home page. Social crawlers (Twitter, Discord,
 * Facebook) do not run JS, so every route would otherwise share that one
 * card. This script emits a static dist/remind.yu/index.html with its own
 * Open Graph / Twitter tags — GitHub Pages serves it directly at /remind.yu,
 * while the SPA bundle it loads still resolves the route client-side.
 *
 * It also produces dist/404.html (the GitHub Pages SPA fallback), which must
 * keep the home-page meta — so it is a plain copy of dist/index.html.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const indexPath = resolve(dist, 'index.html');
const base = readFileSync(indexPath, 'utf8');

const REMIND_YU = {
  outDir: resolve(dist, 'remind.yu'),
  title: 'remind.yu',
  description:
    "it nags you. so you never forget. free, private, on-device — " +
    "no account, no servers, no internet permission.",
  url: 'https://yuniverse.au/remind.yu',
  image: 'https://yuniverse.au/images/remindyu/og-remind-yu.png',
  imageAlt: 'remind.yu — private by default. unignorable by design.',
};

function buildRemindYuHtml(html, m) {
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${m.title}</title>`)
    .replace(
      /<meta name="description"[^>]*>/,
      `<meta name="description" content="${m.description}" />`
    )
    .replace(
      /<meta property="og:url"[^>]*>/,
      `<meta property="og:url" content="${m.url}" />`
    )
    .replace(
      /<meta property="og:title"[^>]*>/,
      `<meta property="og:title" content="${m.title}" />`
    )
    .replace(
      /<meta property="og:description"[^>]*>/,
      `<meta property="og:description" content="${m.description}" />`
    )
    .replace(
      /<meta property="og:image"[^>]*>/,
      `<meta property="og:image" content="${m.image}" />\n` +
        `    <meta property="og:image:width" content="2400" />\n` +
        `    <meta property="og:image:height" content="1260" />\n` +
        `    <meta property="og:image:alt" content="${m.imageAlt}" />`
    )
    .replace(
      /<meta property="twitter:url"[^>]*>/,
      `<meta property="twitter:url" content="${m.url}" />`
    )
    .replace(
      /<meta property="twitter:title"[^>]*>/,
      `<meta property="twitter:title" content="${m.title}" />`
    )
    .replace(
      /<meta property="twitter:description"[^>]*>/,
      `<meta property="twitter:description" content="${m.description}" />\n` +
        `    <meta property="twitter:image" content="${m.image}" />`
    );
}

mkdirSync(REMIND_YU.outDir, { recursive: true });
writeFileSync(
  resolve(REMIND_YU.outDir, 'index.html'),
  buildRemindYuHtml(base, REMIND_YU)
);

copyFileSync(indexPath, resolve(dist, '404.html'));

console.log('og pages: wrote dist/remind.yu/index.html and dist/404.html');
