// Measures frame rate on a page with the CPU throttled to roughly phone speed.
// Usage: node scripts/perf.mjs <page.html> [--click=<selector>]... [--throttle=4]
// Reports idle, a drag-pan, and each --click (e.g. a zoom toggle), as fps / worst
// frame / frames over 34 ms. Target: >= 55 fps and no frame over 50 ms at 4×.
import { chromium } from 'playwright-core';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const page = args.find((a) => !a.startsWith('--'));
const clicks = args.filter((a) => a.startsWith('--click=')).map((a) => a.slice(8));
const rate = Number(args.find((a) => a.startsWith('--throttle='))?.slice(11) ?? 4);
if (!page) { console.error('usage: node scripts/perf.mjs <page.html> [--click=<selector>]... [--throttle=4]'); process.exit(1); }

const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(pathToFileURL(resolve(page)).href, { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
const cdp = await ctx.newCDPSession(p);
await cdp.send('Emulation.setCPUThrottlingRate', { rate });

const start = () => p.evaluate(() => { window.__f = []; window.__run = true; let l = performance.now(); const t = (n) => { __f.push(n - l); l = n; if (__run) requestAnimationFrame(t); }; requestAnimationFrame(t); });
const stop = () => p.evaluate(() => { __run = false; const f = __f.slice(2); const a = f.reduce((x, y) => x + y, 0) / (f.length || 1); return `${Math.round(1000 / a)} fps, worst ${Math.round(Math.max(...f))} ms, ${f.filter((x) => x > 34).length} janky`; });

await start(); await p.waitForTimeout(1200); console.log(`idle:  ${await stop()}`);
await start();
await p.mouse.move(200, 600); await p.mouse.down();
for (let i = 0; i < 40; i++) await p.mouse.move(200 + Math.sin(i / 6) * 120, 600 - i * 6);
await p.mouse.up(); await p.waitForTimeout(800);
console.log(`pan:   ${await stop()}`);
for (const sel of clicks) {
  await start(); await p.locator(sel).first().click(); await p.waitForTimeout(1400);
  console.log(`click ${sel}: ${await stop()}`);
}
console.log(`(CPU throttled ${rate}×, 390×844 @3×)`);
if (errors.length) console.log(`PAGE ERRORS:\n${errors.join('\n')}`);
await browser.close();
