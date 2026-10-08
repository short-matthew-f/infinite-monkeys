// Renders an HTML page to PNGs so reviewers judge pixels, not source.
// Usage: node scripts/shoot.mjs <page.html> [outDir] [--click=<css selector>]...
// Output: light/dark × motion/reduced at 390×844 (2× DPR), plus animation frames
// ~400 ms apart in light mode, plus one shot after each --click.
// Uses the system Chrome, so no browser download is needed.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const page = args.find((a) => !a.startsWith('--'));
if (!page) {
  console.error('usage: node scripts/shoot.mjs <page.html> [outDir] [--click=<selector>]...');
  process.exit(1);
}
const outDir = args.filter((a) => !a.startsWith('--'))[1] ?? join(dirname(resolve(page)), 'shots');
const clicks = args.filter((a) => a.startsWith('--click=')).map((a) => a.slice(8));
mkdirSync(outDir, { recursive: true });
const url = pathToFileURL(resolve(page)).href;
const name = basename(page, '.html');

const browser = await chromium.launch({ channel: 'chrome' });
const shots = [];
const errors = [];
async function open(colorScheme, reducedMotion) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme, reducedMotion, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${colorScheme}/${reducedMotion}: ${e.message}`));
  p.on('console', (m) => m.type() === 'error' && errors.push(`${colorScheme}/${reducedMotion} console: ${m.text()}`));
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);
  return { ctx, p };
}
async function shot(p, label) {
  const file = join(outDir, `${name}-${label}.png`);
  await p.screenshot({ path: file });
  shots.push(file);
}

for (const scheme of ['light', 'dark']) {
  for (const motion of ['no-preference', 'reduce']) {
    const { ctx, p } = await open(scheme, motion);
    await shot(p, `${scheme}${motion === 'reduce' ? '-reduced' : ''}`);
    if (scheme === 'light' && motion === 'no-preference') {
      for (let i = 1; i <= 3; i++) {
        await p.waitForTimeout(400);
        await shot(p, `frame${i}`);
      }
      for (const [i, sel] of clicks.entries()) {
        await p.locator(sel).first().click();
        await p.waitForTimeout(900);
        await shot(p, `click${i + 1}`);
      }
      const dom = await p.evaluate(() => ({ nodes: document.querySelectorAll('*').length, scrollWidth: document.documentElement.scrollWidth, width: innerWidth }));
      console.log(`DOM nodes: ${dom.nodes}; horizontal overflow: ${dom.scrollWidth > dom.width ? `YES (${dom.scrollWidth}px)` : 'no'}`);
    }
    await ctx.close();
  }
}
await browser.close();
console.log(shots.join('\n'));
if (errors.length) console.log(`\nPAGE ERRORS:\n${errors.join('\n')}`);
