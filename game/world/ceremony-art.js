// SVG builders for the quarter-end ceremony (game/world/ceremony.ts). Pure: same input, same markup.
// Ported from the tower exploration (design/explorations/tower/index.html: boardroom, CLIP, charts,
// creamPie). The monkey parts come from floor-art.js; nothing here knows about game state, so every
// number arrives already formatted by the caller.
/* eslint-disable */
import { f1, stand } from './floor-art.js';

/** The department heads, then the Chief Accountant. Same cast as the exploration. */
export const HEADS = [
  { fur: 1, H: 72, bw: 26, tw: 1.1, hr: 13, ears: 'big', view: 'f', gaze: [0, 0], eyes: 'open', mouth: 'smile', head: 'phones', tail: true, shirt: 'sk-rust' },
  { fur: 0, H: 78, bw: 34, tw: 1.1, hr: 14, ears: 'round', view: 'f', gaze: [0, 0], eyes: 'open', mouth: 'flat', head: 'pencil', tail: true, shirt: 'sk-mustard' },
  { fur: 5, H: 76, bw: 34, tw: 1.02, hr: 15, ears: 'small', view: 'f', gaze: [0, .4], eyes: 'heavy', mouth: 'flat', head: 'visor', tail: true, shirt: 'sk-ink' },
  // the Chief Accountant: only comes to the review when there were requests to account for
  { fur: 2, H: 70, bw: 30, tw: 1.05, hr: 14, ears: 'tuft', view: 'f', gaze: [0, .4], eyes: 'open', mouth: 'flat', head: 'visor', body: 'tie', tail: true, shirt: 'sk-olive' },
];

const txt = (x, y, t, st = '', cls = 'sg') => `<text class="${cls}" x="${x}" y="${y}" style="${st}">${t}</text>`;
const sh = (x, yb, w) => `<polygon class="shl" points="${x - w / 2},${yb} ${x + w / 2},${yb} ${x + w / 2 + 22},${yb + 7} ${x - w / 2 + 14},${yb + 7}"/><polygon class="shc" points="${x - w / 2},${yb} ${x + w / 2},${yb} ${x + w / 2 + 3},${yb + 3} ${x - w / 2 + 3},${yb + 3}"/>`;

export function banana(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-14 -2q14 14 30 -6q-4 4 -12 4q-10 0 -18 2z" fill="var(--mustard)" stroke="var(--screen)" stroke-width="1.1" stroke-linejoin="round"/><path d="M16 -8l3 -3" stroke="var(--walnut)" stroke-width="2.4" stroke-linecap="round"/></g>`;
}

function bell(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 -4v-6" stroke="var(--screen)" stroke-width="1.6"/><g class="bellring" style="transform-origin:0px -4px"><path d="M-12 14q0 -18 12 -18q12 0 12 18z" fill="var(--mustard)" stroke="var(--screen)" stroke-width="1.4"/><path d="M-14 14h28" stroke="var(--screen)" stroke-width="2.2"/><circle cx="0" cy="17" r="2.6" fill="var(--walnut)"/></g></g>`;
}

/** The Bursar's pot, where the unspent wallet goes at quarter end. */
export function potSVG(x, yb, s = 1) {
  return `<g transform="translate(${x} ${yb}) scale(${s})">${sh(0, 0, 50)}<path d="M-26 -40h52l-5 34q-2 6 -8 6h-26q-6 0 -8 -6z" fill="color-mix(in srgb, var(--tangerine) 55%, var(--walnut))" stroke="var(--edge)" stroke-width="2"/><path d="M-30 -42h60" stroke="var(--edge)" stroke-width="6" stroke-linecap="round"/><path d="M-30 -42h60" stroke="var(--mustard)" stroke-width="3.4" stroke-linecap="round"/>` +
    `<path d="M-18 -44q8 -10 16 -2M-2 -46q10 -12 18 0M8 -44q6 -8 12 -2" fill="none" stroke="var(--mustard)" stroke-width="5" stroke-linecap="round"/><path d="M-18 -44q8 -10 16 -2M-2 -46q10 -12 18 0M8 -44q6 -8 12 -2" fill="none" stroke="var(--screen)" stroke-width="1" stroke-linecap="round" opacity=".5"/>` +
    `<rect x="-14" y="-28" width="28" height="12" rx="1.5" fill="var(--edge)" stroke="var(--screen)" stroke-width=".8"/><text x="0" y="-19" style="font:700 8px var(--font-display);letter-spacing:.12em;fill:var(--screen);text-anchor:middle">POT</text></g>`;
}

const door = (x, y) => `<g><rect x="${x}" y="${y}" width="52" height="120" fill="var(--screen)"/><rect class="door-l" x="${x}" y="${y}" width="26" height="120" fill="var(--concrete)" stroke="var(--edge)" stroke-width="1.6"/><rect class="door-r" x="${x + 26}" y="${y}" width="26" height="120" fill="var(--concrete)" stroke="var(--edge)" stroke-width="1.6"/><path d="M${x + 8} ${y - 6}a18 18 0 0 1 36 0z" fill="var(--edge)" stroke="var(--mustard)" stroke-width="2"/><path d="M${x + 26} ${y - 6}l12 -8" stroke="var(--screen)" stroke-width="1.6"/></g>`;

/** Arrival: the boardroom door opens and the heads walk in. `heads: false` shows an empty room (first budget). */
export function arrivalSVG(sign, heads, accountant = false) {
  const W = 360, H = 200;
  return `<rect width="${W}" height="${H}" fill="var(--cer-wall)"/><rect y="164" width="${W}" height="36" fill="var(--cer-floor)"/>` +
    `<g><rect x="70" y="10" width="160" height="26" rx="2" class="brass"/>${txt(150, 28, sign, 'font-size:14px')}${bell(260, 16, .9)}</g>` +
    door(304, 44) +
    `<g class="ding"><rect x="286" y="60" width="40" height="18" rx="3" fill="var(--glow)" stroke="var(--screen)" stroke-width="1.2"/>${txt(306, 73, 'DING', 'font-size:11px')}</g>` +
    `<g><rect x="12" y="92" width="44" height="66" rx="10" fill="color-mix(in srgb, var(--olive) 80%, var(--edge))" stroke="var(--edge)" stroke-width="3"/>${txt(34, 86, 'YOU', 'font-size:10px')}</g>` +
    (heads ? HEADS.slice(0, accountant ? 4 : 3).map((h, k) => `<g class="walkin" style="--k:${k}"><g transform="translate(${120 + k * (accountant ? 52 : 70)} 170)">${stand(h, k === 1 ? { xr: `<rect x="2" y="-56" width="16" height="22" fill="var(--edge)" stroke="var(--screen)" stroke-width="1"/>` } : {})}</g></g>`).join('') : potSVG(200, 172, 1.2)) +
    `<rect x="118" y="198" width="180" height="2" fill="none"/>`;
}

/**
 * The presenters' strip under the pull-down screen: floor, projector and its beam, the door, and the three
 * heads (only the one presenting is shown). Each head is a `.presenter` > `.pw` (slides in x) > `.pb` (bobs
 * in y) so the walk is two transforms and nothing else.
 */
// The pointing hand sits beside the head (clear of the face), whatever the build.
function pointerPose(h) {
  const hx = h.bw / 2 + 10, hy = -h.H + 1.92 * h.hr + 8 - 12;
  return { hr: [f1(hx), f1(hy)], xr: `<path class="ptr" d="M${f1(hx)} ${f1(hy)}l24 -24" stroke="var(--walnut)" stroke-width="2.4" stroke-linecap="round"/><circle class="ptr" cx="${f1(hx + 24)}" cy="${f1(hy - 24)}" r="2" fill="var(--alert)"/>` };
}
export function stripSVG() {
  const W = 360, H = 116, fy = 108;
  return `<rect width="${W}" height="${H}" fill="var(--cer-wall)"/><rect y="100" width="${W}" height="16" fill="var(--cer-floor)"/><path d="M0 100.5H${W}" stroke="var(--edge)" stroke-width="2"/>` +
    `<g><rect x="306" y="${fy - 74}" width="50" height="74" fill="var(--screen)"/><rect class="door-l" x="306" y="${fy - 74}" width="25" height="74" fill="var(--concrete)" stroke="var(--edge)" stroke-width="1.4"/><rect class="door-r" x="331" y="${fy - 74}" width="25" height="74" fill="var(--concrete)" stroke="var(--edge)" stroke-width="1.4"/></g>` +
    `<polygon class="beam" points="196,${fy - 20} 130,0 262,0" fill="var(--glow)" opacity=".2"/><rect x="180" y="${fy - 14}" width="34" height="14" rx="2" fill="var(--concrete)" stroke="var(--edge)" stroke-width="1.4"/><rect x="192" y="${fy - 24}" width="10" height="10" fill="var(--screen)"/>` +
    HEADS.map((h, k) => `<g class="presenter" data-h="${k}"><g class="pw"><g class="pb"><g transform="translate(70 ${fy})">${stand(Object.assign({}, h, { view: 'pr', gaze: [1, -.3] }), pointerPose(h))}<g class="pbub" style="display:none"><path class="bt" d="M-2 -86l6 8l6 -8z"/><rect class="bg" x="0" y="-102" width="40" height="16" rx="3"/><text class="bx" x="0" y="-90"></text></g></g></g></g></g>`).join('');
}

/** The budget band: the Bursar's pot, with the unspent wallet sweeping into it (`.sweep`, moved by a class). */
export function potBandSVG(sweeping) {
  const W = 360, H = 104;
  return `<rect width="${W}" height="${H}" fill="var(--cer-wall)"/><rect y="86" width="${W}" height="18" fill="var(--cer-floor)"/><path d="M0 86.5H${W}" stroke="var(--edge)" stroke-width="2"/>` +
    `<g><rect x="30" y="18" width="110" height="24" rx="2" class="brass"/>${txt(85, 35, 'THE BURSAR', 'font-size:13px')}</g>` +
    potSVG(240, 96, 1.15) +
    (sweeping ? `<g class="sweep">${[0, 1, 2].map((k) => banana(150 + k * 14, 66 - k * 6, .8)).join('')}</g>` : '');
}

/* ---- clip art for the slides, in the paper vocabulary ---- */
export const CLIP = {
  phone: `<svg viewBox="0 0 60 40" aria-hidden="true"><rect x="10" y="18" width="40" height="18" rx="4" fill="var(--screen)"/><path d="M6 16q24 -18 48 0" stroke="var(--screen)" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="30" cy="27" r="5" fill="var(--edge)"/></svg>`,
  people: `<svg viewBox="0 0 60 40" aria-hidden="true">${[10, 30, 50].map((x, k) => `<circle cx="${x}" cy="12" r="6" fill="${['var(--tangerine)', 'var(--olive)', 'var(--mustard)'][k]}" stroke="var(--screen)"/><rect x="${x - 7}" y="19" width="14" height="16" rx="6" fill="${['var(--tangerine)', 'var(--olive)', 'var(--mustard)'][k]}" stroke="var(--screen)"/>`).join('')}</svg>`,
  hat: `<svg viewBox="0 0 60 40" aria-hidden="true"><path d="M10 30q0 -22 20 -22q20 0 20 22z" fill="var(--mustard)" stroke="var(--screen)" stroke-width="2"/><path d="M4 30h52" stroke="var(--screen)" stroke-width="5" stroke-linecap="round"/><path d="M30 8v22" stroke="var(--screen)" stroke-width="1.6"/></svg>`,
  pencil: `<svg viewBox="0 0 60 40" aria-hidden="true"><g transform="rotate(-30 30 20)"><rect x="8" y="16" width="38" height="9" fill="var(--alert)" stroke="var(--screen)"/><path d="M46 16l10 4.5l-10 4.5z" fill="var(--glow)" stroke="var(--screen)"/><rect x="2" y="16" width="6" height="9" fill="color-mix(in srgb, var(--alert) 40%, var(--edge))" stroke="var(--screen)"/></g></svg>`,
  ledger: `<svg viewBox="0 0 60 40" aria-hidden="true"><path d="M6 8l24 -4l24 4v28l-24 -4l-24 4z" fill="var(--edge)" stroke="var(--screen)" stroke-width="2"/><path d="M30 4v28" stroke="var(--screen)" stroke-width="1.6"/><path d="M12 14l14 -2M12 20l14 -2M12 26l14 -2M34 12l14 2M34 18l14 2" stroke="var(--olive)" stroke-width="1.6"/></svg>`,
  lens: `<svg viewBox="0 0 60 40" aria-hidden="true"><circle cx="26" cy="18" r="13" fill="var(--glow)" stroke="var(--mustard)" stroke-width="5"/><path d="M36 28l16 10" stroke="var(--walnut)" stroke-width="6" stroke-linecap="round"/></svg>`,
  star: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3l5 11l12 1l-9 8l3 12l-11 -6l-11 6l3 -12l-9 -8l12 -1z" fill="var(--mustard)" stroke="var(--screen)" stroke-width="1.4"/></svg>`,
};

const FILLS = ['var(--olive)', 'var(--mustard)', 'var(--tangerine)'];
const AX = 'font:600 8.2px var(--font-display);fill:var(--screen);text-anchor:middle';
const VAL = 'font:600 8.2px var(--font-mono);fill:var(--screen);text-anchor:middle';

/** bars: [{ v: number, label: string, text: string }]. Heights scale to the largest bar. */
export function barChart(bars, unit) {
  const m = Math.max(1, ...bars.map((b) => b.v)), step = 140 / bars.length, bw = Math.min(40, step - 14);
  return `<svg class="chart-svg" viewBox="0 0 160 70" aria-hidden="true"><path d="M14 60H156M14 6V60" stroke="var(--screen)" stroke-width="1.4"/>` +
    bars.map((b, i) => { const x = 18 + i * step + (step - bw) / 2, hh = 42 * b.v / m, cx = x + bw / 2; return `<rect x="${x}" y="${60 - hh}" width="${bw}" height="${hh}" fill="${FILLS[i % 3]}" stroke="var(--screen)" stroke-width="1"/><text x="${cx}" y="${56 - hh}" style="${VAL}">${b.text}</text><text x="${cx}" y="68" style="${AX}">${b.label}</text>`; }).join('') +
    `<text x="20" y="6" style="font:600 8.2px var(--font-display);fill:var(--screen)">${unit}</text></svg>`;
}

/** points: [{ v, label, text }]. The line always goes somewhere. */
export function lineChart(points) {
  const m = Math.max(1, ...points.map((p) => p.v)), step = 100 / Math.max(1, points.length - 1);
  const pts = points.map((p, i) => [32 + i * step, 56 - 40 * p.v / m]);
  return `<svg class="chart-svg" viewBox="0 0 160 70" aria-hidden="true"><path d="M14 60H156M14 6V60" stroke="var(--screen)" stroke-width="1.4"/><path d="M${pts.map((p) => p.join(' ')).join('L')}" fill="none" stroke="var(--tangerine)" stroke-width="3" stroke-linejoin="round"/>` +
    pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="var(--mustard)" stroke="var(--screen)"/><text x="${p[0]}" y="${p[1] - 7}" style="${VAL}">${points[i].text}</text><text x="${p[0]}" y="68" style="${AX}">${points[i].label}</text>`).join('') + `</svg>`;
}

/** A pie chart that is literally a banana cream pie: crust ring, cream, banana slices, one wedge served. */
export function creamPie(frac, lines) {
  const f = Math.max(0, Math.min(0.999, frac)), a = f * 2 * Math.PI, x = 40 + 30 * Math.sin(a), y = 36 - 30 * Math.cos(a);
  return `<svg class="chart-svg" viewBox="0 0 160 72" aria-hidden="true"><circle cx="40" cy="36" r="33" fill="var(--walnut)" stroke="var(--screen)"/><circle cx="40" cy="36" r="29" fill="var(--edge)"/>` +
    [[30, 26], [48, 30], [36, 44], [52, 46], [26, 40]].map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="4" fill="color-mix(in srgb, var(--mustard) 45%, var(--edge))" stroke="var(--mustard)"/>`).join('') +
    (f > 0 ? `<path d="M40 36L40 6A30 30 0 ${f > .5 ? 1 : 0} 1 ${x.toFixed(1)} ${y.toFixed(1)}Z" fill="var(--sheet)" stroke="var(--alert)" stroke-width="1.6" stroke-dasharray="3 2" transform="translate(5 -3)"/>` : '') +
    `<text x="76" y="26" style="font:700 8.2px var(--font-display);fill:var(--screen)">${lines[0]}</text><text x="76" y="42" style="font:700 8.2px var(--font-display);fill:var(--stamp)">${lines[1]}</text><text x="76" y="58" style="font:400 8px var(--font-type);fill:var(--screen)">(banana cream)</text></svg>`;
}

/** A hand-drawn signature, for the Sign step. */
export const SIGNATURE = `<svg viewBox="0 0 220 40" aria-hidden="true"><path class="sig" d="M8 28c10 -18 18 -18 16 0s10 -20 18 -8s8 10 16 -4s10 -6 14 4c4 8 10 -14 18 -10s4 12 12 4s8 -10 16 -2s14 6 30 -6s20 4 34 0"/></svg>`;
