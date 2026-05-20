/*
 * Rasterises scripts/og-card.html into the remind.yu social share PNG at
 * public/images/remindyu/og-remind-yu.png. Run after editing the card:
 *   npm run og:card
 *
 * Uses a headless Chromium browser (Edge or Chrome) — no extra npm deps.
 * Output is rendered at 2x for a crisp 2400x1260 image (1.91:1, the size
 * Twitter / Discord / Facebook expect for a large summary card).
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cardHtml = resolve(root, 'scripts', 'og-card.html');
const outPng = resolve(root, 'public', 'images', 'remindyu', 'og-remind-yu.png');

const candidates = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
];
const browser = candidates.find(existsSync);
if (!browser) {
  console.error('No Edge/Chrome found. Edit candidate paths in this script.');
  process.exit(1);
}

execFileSync(browser, [
  '--headless',
  '--disable-gpu',
  '--hide-scrollbars',
  '--force-device-scale-factor=2',
  '--window-size=1200,630',
  `--screenshot=${outPng}`,
  `file:///${cardHtml.replace(/\\/g, '/')}`,
]);

console.log(`og card: wrote ${outPng}`);
