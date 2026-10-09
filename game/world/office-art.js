// The office heads' art: the Chief Accountant and Training Officer, and the payoff vignettes. Pure: same input, same markup, no DOM. Ported from the tower
// exploration (design/explorations/tower/index.html: the pv* scenes),
// built on the parts kit in floor-art.js. The typed boundary is office-art.d.ts.
//
// Payoff vignettes are 360 x 220. Motion classes (.mv .fi .po .bye and a few named ones) animate one
// transform or opacity per element (payoff.css). Each element's own style is its END state and the
// keyframes only say `from`, so reduced motion (animation: none) shows the finished frame.
/* eslint-disable */
import { f1, hash, stand, seatSVG, pbox, lamp, ficus, T } from './floor-art.js';
import { banana } from './ceremony-art.js';

const r1 = f1;
const EARS = ['round', 'big', 'small', 'tuft'], MOUTHS = ['smile', 'flat', 'o', 'tongue', 'teeth', 'frown', 'smirk'];
const txt = (x, y, t, st = '', cls = 'sg') => `<text class="${cls}" x="${x}" y="${y}" style="${st}">${t}</text>`;
const txs = txt;
const sh = (x, yb, w, k = 1) => `<polygon class="shl" points="${x - w / 2},${yb} ${x + w / 2},${yb} ${x + w / 2 + 22 * k},${yb + 7} ${x - w / 2 + 14 * k},${yb + 7}"/><polygon class="shc" points="${x - w / 2},${yb} ${x + w / 2},${yb} ${x + w / 2 + 3},${yb + 3} ${x - w / 2 + 3},${yb + 3}"/>`;
const standAt = (x, y, s, pose = {}, cls = '') => `<g transform="translate(${x} ${y})"${cls ? ` class="${cls}"` : ''}>${stand(s, pose)}</g>`;
const seat = (i, cx, yb, over = {}, o = {}) => seatSVG(i, cx, yb, Object.assign({}, o, { over }));

/* ---------- the heads ---------- */
// the Chief Accountant: a visor and a sharp tie, a different fur from the Chief Editor
export const CA = { fur: 2, H: 70, bw: 30, tw: 1.05, hr: 14, ears: 'small', view: 'f', gaze: [0, .4], eyes: 'heavy', mouth: 'flat', head: 'visor', body: 'tie', tail: true, shirt: 'sk-olive' };
export const TO = { fur: 3, H: 78, bw: 28, tw: 1, hr: 13, ears: 'tuft', view: 'pl', gaze: [-1, .2], eyes: 'open', mouth: 'flat', head: 'glassesR', tail: true, shirt: 'sk-mustard' };
export const clipboard = (x, y) => `<g transform="translate(${x} ${y})"><rect x="0" y="0" width="16" height="22" fill="var(--walnut)" stroke="var(--screen)" stroke-width="1"/><rect x="2" y="3" width="12" height="17" fill="var(--paper)"/><path d="M4 8h8M4 12h8M4 16h6" stroke="var(--concrete)" stroke-width=".9"/><rect x="5" y="-1" width="6" height="3" class="brass"/></g>`;
export const pizzaBox = (x, y, w = 40, open) => `<g transform="translate(${x} ${y})"><rect x="${-w / 2}" y="-7" width="${w}" height="7" rx="1" fill="color-mix(in srgb, var(--walnut) 40%, var(--paper-shade))" stroke="var(--screen)" stroke-width="1.2"/><path d="M${-w / 2 + 3} -3.5h${w - 6}" stroke="var(--screen)" stroke-width=".7" opacity=".5"/>${open ? `<ellipse cx="0" cy="-8" rx="${w * .4}" ry="3.6" fill="var(--tangerine)" stroke="var(--screen)" stroke-width="1"/><circle cx="-6" cy="-8.4" r="1.7" fill="var(--alert)"/><circle cx="3" cy="-7.4" r="1.7" fill="var(--alert)"/><circle cx="9" cy="-9" r="1.4" fill="var(--alert)"/>` : `<circle cx="${w * .2}" cy="-3.6" r="1.6" fill="var(--tangerine)" opacity=".8"/>`}</g>`;

/* ---------- parts from the exploration ---------- */
function pile(x, yb, n, w = 30, seed = 1) {
  let s = '';
  for (let k = 0; k < n; k++) {
    const j = (hash(k * 7 + seed) % 7) - 3, r = ((hash(k * 13 + seed) % 9) - 4) * .7;
    s += `<rect class="page" x="${x - w / 2 + j}" y="${yb - 4 - k * 3.6}" width="${w}" height="4" transform="rotate(${r.toFixed(1)} ${x} ${yb - k * 3.6})"/>`;
  }
  return s;
}
function chalkboard(x, y, w, h, l1, l2) {
  return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="color-mix(in srgb, var(--olive) 55%, var(--screen))" stroke="var(--walnut)" stroke-width="5"/><path d="M${x + 4} ${y + h - 2}h${w - 8}" stroke="var(--walnut)" stroke-width="4"/><rect x="${x + w - 24}" y="${y + h - 6}" width="10" height="3" fill="var(--edge)"/>` +
    txt(x + w / 2, y + h * .42, l1, `font:700 ${Math.min(15, w / 9)}px var(--font-type);fill:var(--edge)`) + txt(x + w / 2, y + h * .8, l2, 'font:400 15px var(--font-type);fill:var(--edge)') + `</g>`;
}
function waterCooler(x, yb) {
  return `<g>${sh(x, yb, 26)}<rect class="fr c-steel" x="${x - 12}" y="${yb - 44}" width="24" height="44" rx="2"/><path class="rim" d="M${x - 10.5} ${yb - 1}V${yb - 42.5}H${x + 10.5}"/>` +
    `<rect x="${x - 4}" y="${yb - 34}" width="8" height="5" rx="1" fill="var(--screen)"/><path d="M${x - 2} ${yb - 29}v3M${x + 2} ${yb - 29}v3" stroke="var(--alert)" stroke-width="1.6"/>` +
    `<path d="M${x - 11} ${yb - 46}q0 -30 11 -30q11 0 11 30z" fill="color-mix(in srgb, var(--glow) 35%, var(--edge))" stroke="var(--concrete)" stroke-width="1.4" opacity=".92"/><path d="M${x - 6} ${yb - 70}v20" stroke="var(--edge)" stroke-width="2.4" opacity=".8"/>` +
    `<circle class="bub" cx="${x + 2}" cy="${yb - 52}" r="2" fill="var(--edge)" stroke="var(--concrete)" stroke-width=".6" style="--d:-.6s"/><circle class="bub" cx="${x - 3}" cy="${yb - 56}" r="1.5" fill="var(--edge)" stroke="var(--concrete)" stroke-width=".6" style="--d:-1.7s"/>` +
    `<path d="M${x + 14} ${yb - 26}h7l-1 8h-5z" class="page"/><path d="M${x + 15} ${yb - 18}h7l-1 8h-5z" class="page"/></g>`;
}
const pendant = x => `<path d="M${x} 0V12" stroke="var(--screen)" stroke-width="2"/><ellipse class="halo" cx="${x}" cy="40" rx="36" ry="22" style="opacity:.4"/><path class="fr" style="--c:var(--tangerine)" d="M${x - 12} 25L${x - 6} 12H${x + 6}L${x + 12} 25Z"/><ellipse class="lampc" cx="${x}" cy="26" rx="8" ry="3"/>`;
/* ---------- payoff vignettes (360 x 220) ---------- */
const mkc = (i, o = {}) => Object.assign({ fur: i % 6, H: 64, bw: 26 + (i % 3) * 3, tw: 1.1, hr: 12 + (i % 3), ears: EARS[i % 4], view: 'pr', gaze: [1, .2], eyes: ['open', 'wide', 'heavy'][i % 3], mouth: MOUTHS[(i * 3) % 7], head: 'none', tail: true, shirt: ['sk-paper', 'sk-mustard', 'sk-olive', 'sk-rust', 'sk-shade'][i % 5] }, o);
const pvBase = (fy = 160) => `<rect width="360" height="220" fill="var(--wall)"/><rect y="${fy - 46}" width="360" height="46" fill="color-mix(in srgb, var(--wall-dk) 50%, var(--wall))"/><path d="M0 ${fy - 45.5}H360" stroke="var(--edge)" stroke-width="2"/><rect y="${fy}" width="360" height="${220 - fy}" fill="var(--floor)"/><path d="M0 ${fy + 1}H360" stroke="var(--edge)" stroke-width="3"/>`;
const pvA = (cls, inner, v) => `<g class="${cls}" style="${Object.entries(v || {}).map(([k, x]) => `--${k}:${x}`).join(';')}">${inner}</g>`;
const mvA = (inner, fx, fy, d, dl, e) => pvA('mv', inner, { fx: fx + 'px', fy: fy + 'px', d: d + 's', dl: dl + 's', e });
const fiA = (inner, dl, d = .4) => pvA('fi', inner, { d: d + 's', dl: dl + 's' });
const poA = (x, y, inner, dl, d = .35) => `<g transform="translate(${x} ${y})">${pvA('po', inner, { d: d + 's', dl: dl + 's' })}</g>`;
const byeA = (inner, dl, d = .3) => pvA('bye', inner, { d: d + 's', dl: dl + 's' });
const at = (x, y, inner) => `<g transform="translate(${x} ${y})">${inner}</g>`;
// a speech bubble with its tail at the lower left; (x, y) is the top left
function sbub(x, y, t, tone) {
  const w = Math.round(t.length * 8.3 + 20), fill = tone === 'bad' ? 'color-mix(in srgb, var(--alert) 30%, var(--edge))' : tone === 'hot' ? 'var(--glow)' : 'var(--edge)';
  return `<g transform="translate(${x} ${y})"><path d="M10 26l-3 9l13 -9z" fill="${fill}" stroke="var(--screen)" stroke-width="1.2" stroke-linejoin="round"/><rect width="${w}" height="28" rx="7" fill="${fill}" stroke="var(--screen)" stroke-width="1.2"/><path d="M11 26.6h8" stroke="${fill}" stroke-width="2.4"/><text x="${w / 2}" y="19.5" style="font:600 15px var(--font-body);fill:var(--screen);text-anchor:middle">${t}</text></g>`;
}
const star = (x, y, r, fill = 'var(--mustard)') => { let p = ''; for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5, rr = k % 2 ? r * .5 : r; p += `${r1(x + Math.sin(a) * rr)},${r1(y - Math.cos(a) * rr)} `; } return `<polygon points="${p}" fill="${fill}" stroke="var(--screen)" stroke-width="1.2" stroke-linejoin="round"/>`; };
const plateP = (x, y, t, w) => `<g transform="translate(${x} ${y})"><rect x="${-w / 2}" y="-12" width="${w}" height="24" rx="2" class="brass"/><text class="sg" x="0" y="5.4" style="font-size:15px">${t}</text></g>`;
// the small LOBBY sign over a door at (cx, top)
const lobby = (cx, top) => `<rect x="${cx - 32}" y="${top - 6}" width="64" height="19" rx="2" fill="var(--mustard)" stroke="var(--screen)" stroke-width="1"/>${txs(cx, top + 8, 'LOBBY', 'font-size:15px')}`;
const CONFETTI = ['var(--tangerine)', 'var(--mustard)', 'var(--alert)', 'var(--olive)', 'var(--glow)', 'var(--paper)'];

function pvPizza() {
  let s = pvBase(160) + pendant(70) + pendant(250);
  // the typewriter, and a loupe on its keys
  s += pbox({ x: 12, yb: 178, w: 104, h: 34, d: 10, c: 'walnut' });
  s += `<rect x="30" y="118" width="66" height="22" rx="3" fill="var(--concrete)" stroke="var(--screen)" stroke-width="1.6"/><rect x="40" y="100" width="46" height="20" fill="var(--paper)" stroke="var(--screen)" stroke-width="1.2"/><path d="M45 108h36M45 113h28" stroke="var(--concrete)" stroke-width="1"/>`;
  s += `<path d="M72 128L38 74M72 128L112 78" stroke="var(--screen)" stroke-width="1.2" stroke-dasharray="3 3" opacity=".7"/>`;
  s += `<clipPath id="pvlp"><circle cx="74" cy="46" r="40"/></clipPath><circle cx="74" cy="46" r="40" fill="var(--concrete)"/><g clip-path="url(#pvlp)">` +
    ['QWER', 'ASDF'].map((row, j) => [...row].map((ch, k) => `<g transform="translate(${38 + k * 21} ${j ? 52 : 26})"><rect width="18" height="20" rx="5" fill="var(--paper)" stroke="var(--screen)" stroke-width="1.6"/></g>`).join('')).join('') +
    `<circle cx="64" cy="42" r="6.6" fill="var(--alert)" stroke="var(--screen)" stroke-width="1"/><circle cx="62" cy="40" r="1.6" fill="var(--tangerine)"/>` +
    [[46, 24], [66, 30], [84, 28], [104, 24], [50, 56], [74, 62], [92, 58], [112, 66], [60, 70], [100, 74]].map(([x, y], k) => mvA(`<circle cx="${x}" cy="${y}" r="2.4" fill="color-mix(in srgb, var(--tangerine) 40%, var(--mustard))" stroke="var(--walnut)" stroke-width=".6"/>`, 0, -70 - (k % 3) * 18, .7, 2.5 + k * .12, 'ease-in')).join('') +
    `</g><circle cx="74" cy="46" r="40" fill="none" stroke="var(--mustard)" stroke-width="5"/><circle cx="74" cy="46" r="40" fill="none" stroke="var(--screen)" stroke-width="1.4"/>`;
  // the crowd (behind the table)
  const crowd = [[196, -240, 1.6, 4, 'pr'], [236, -250, 1.75, 1, 'pr'], [276, 150, 1.85, 6, 'pl'], [316, 120, 1.7, 3, 'pl']];
  crowd.forEach(([x, fx, dl, i, v]) => { s += mvA(standAt(x, 150, mkc(i, { view: v, gaze: [v === 'pr' ? 1 : -1, .6], mouth: 'smile', eyes: 'wide', H: 66 + (i % 3) * 4 }), { hl: [-6, -24], hr: [6, -24] }), fx, 0, 1.0, dl, 'ease-in-out'); });
  // the table, and the boxes
  s += pbox({ x: 176, yb: 178, w: 156, h: 32, d: 12, c: 'walnut' });
  s += mvA(pizzaBox(226, 144, 42) + pizzaBox(226, 137, 42) + pizzaBox(226, 130, 42), 0, -150, .5, 1.45, 'cubic-bezier(.5,0,.9,.6)');
  s += mvA(pizzaBox(296, 144, 46, true), 0, -150, .5, 1.75, 'cubic-bezier(.5,0,.9,.6)');
  s += mvA(pizzaBox(268, 144, 30), 0, -150, .5, 2.0, 'cubic-bezier(.5,0,.9,.6)');
  // the delivery monkey, with a stack in his arms that he sets down
  s += pvA('deliv', at(300, 214, stand(mkc(2, { view: 'pl', head: 'visor', H: 68, gaze: [-1, .4], shirt: 'sk-rust' }), { hl: [-16, -30], hr: [-12, -34], xl: byeA(pizzaBox(-22, -28, 40) + pizzaBox(-22, -35, 40) + pizzaBox(-22, -42, 40), 1.42, .1) })));
  s += poA(252, 40, sbub(0, 0, 'PIZZA!!', 'hot'), 1.9);
  return s;
}

function pvTeam() {
  let s = pvBase(166);
  s += `<rect x="12" y="62" width="40" height="104" fill="var(--screen)" stroke="var(--edge)" stroke-width="2.4"/><path d="M15 64L40 70V166H15Z" fill="var(--walnut)" stroke="var(--edge)" stroke-width="1.6"/>${lobby(36, 46)}`;
  s += plateP(210, 40, 'TEAM-BUILDING DAY', 176) + `<path d="M70 4Q210 22 350 4" stroke="var(--screen)" stroke-width="1.4" fill="none" opacity=".6"/>` + [0, 1, 2, 3, 4, 5, 6, 7, 8].map(k => `<polygon points="${84 + k * 28},${(7 + 8 * Math.sin(k * .45 + .1)).toFixed(1)} ${96 + k * 28},${(9 + 8 * Math.sin(k * .45 + .4)).toFixed(1)} ${90 + k * 28},${(22 + 8 * Math.sin(k * .45 + .3)).toFixed(1)}" fill="${CONFETTI[k % 5]}" stroke="var(--screen)" stroke-width=".8"/>`).join('');
  s += ficus(345, 166, .85);
  const sp = (i, o) => mkc(i, Object.assign({ H: 66, view: 'pr' }, o));
  // pair one: caught
  s += standAt(100, 166, sp(1, { gaze: [1, .3], mouth: 'smile' }), { hl: [16, -42], hr: [20, -36] });
  s += at(158, 166, pvA('fall1', stand(sp(4, { eyes: 'closed', mouth: 'o' }), { hl: [-8, -28], hr: [8, -28] })));
  // pair two: the catcher is reading a clipboard
  s += at(214, 166, pvA('catch2', stand(sp(2, { view: 'pl', gaze: [-1, .6], mouth: 'flat', head: 'glassesS' }), { hr: [8, -36], xr: clipboard(-4, -50) })));
  s += at(322, 166, pvA('fall2', stand(sp(6, { eyes: 'closed', mouth: 'o' }), { hl: [-8, -28], hr: [8, -28] })));
  s += fiA(byeA(poA(268, 98, sbub(0, 0, 'oof!', 'bad'), 0), 3.0), 1.95, .15);
  s += poA(246, 164, `<ellipse rx="22" ry="5" fill="var(--paper-shade)" stroke="var(--concrete)" stroke-width="1"/>`, 1.95, .3);
  s += fiA(byeA(poA(150, 84, sbub(0, 0, 'Again.', 'hot'), 0), 4.6), 3.6, .2);
  s += fiA(poA(176, 70, sbub(0, 0, 'Got you!', 'hot'), 0), 5.2, .2);
  return s;
}

function pvEscape() {
  let s = pvBase(166);
  s += `<rect x="10" y="30" width="242" height="136" fill="color-mix(in srgb, var(--wall-dk) 55%, var(--screen))" stroke="var(--edge)" stroke-width="3"/>`;
  s += plateP(131, 24, 'ESCAPE ROOM', 124);
  s += `<g transform="translate(131 52)">${byeA(`<rect x="-32" y="-13" width="64" height="26" rx="2" fill="var(--screen)" stroke="var(--alert)" stroke-width="1.6"/><text x="0" y="5.5" style="font:600 15.5px var(--font-mono);fill:var(--alert);text-anchor:middle">0:03</text>`, 1.85, .1)}${fiA(`<rect x="-32" y="-13" width="64" height="26" rx="2" fill="var(--screen)" stroke="var(--olive)" stroke-width="1.6"/><text x="0" y="5.5" style="font:600 15.5px var(--font-mono);fill:var(--screen-ink);text-anchor:middle">OUT!</text>`, 1.9, .1)}</g>`;
  // the puzzle: a padlocked chest and a clue wall
  s += pbox({ x: 150, yb: 164, w: 48, h: 28, d: 10, c: 'walnut' }) + `<g transform="translate(174 140)"><path d="M-6 0v-7a6 6 0 0 1 12 0v7" fill="none" stroke="var(--mustard)" stroke-width="3"/><rect x="-8" y="0" width="16" height="12" rx="2" class="brass"/></g>`;
  s += `<rect x="24" y="68" width="60" height="42" fill="var(--paper)" stroke="var(--walnut)" stroke-width="3"/><path d="M32 80h20M32 90h34M32 100h14" stroke="var(--olive)" stroke-width="2.4"/><text x="68" y="106" style="font:700 18px var(--font-mono);fill:var(--alert)">?</text>`;
  // the doorway and its door (hinged at the right, swings open toward us)
  s += `<rect x="206" y="58" width="42" height="108" fill="var(--screen)"/>`;
  // the staff
  s += mvA(standAt(288, 166, mkc(3, { view: 'pr', mouth: 'smile', eyes: 'wide', H: 66 }), { hl: [-14, -68], hr: [14, -68] }), -180, 0, 1.0, 2.0, 'ease-in-out');
  s += mvA(standAt(334, 166, mkc(5, { view: 'pl', mouth: 'teeth', eyes: 'wide', H: 62 }), { hl: [-14, -64], hr: [14, -64] }), -218, 0, 1.1, 2.15, 'ease-in-out');
  s += standAt(116, 166, mkc(0, { view: 'pr', head: 'glassesS', gaze: [1, .6], mouth: 'o', H: 62 }), { hr: [18, -30] });
  s += fiA(sbub(84, 68, 'nearly got it!', 'hot'), 3.0, .3);
  s += at(248, 58, `<g class="door"><rect x="-42" y="0" width="42" height="108" fill="var(--walnut)" stroke="var(--edge)" stroke-width="2.4"/><rect x="-34" y="8" width="26" height="40" fill="none" stroke="var(--edge)" stroke-width="1.4" opacity=".6"/><circle cx="-8" cy="58" r="3" class="brass"/><rect x="-30" y="66" width="22" height="9" fill="var(--alert)"/></g>`);
  s += poA(226, 40, star(0, 0, 24, 'var(--glow)'), 1.8, .3);
  // confetti: starts at the door, ends on the floor
  for (let k = 0; k < 22; k++) {
    const h = hash(k * 17 + 3), x = 200 + (h % 150), y = 150 + ((h >> 6) % 24), a = (h >> 3) % 80 - 40;
    s += mvA(`<rect x="${x}" y="${y}" width="${5 + h % 3}" height="${3 + (h >> 4) % 3}" fill="${CONFETTI[h % 6]}" stroke="var(--screen)" stroke-width=".6" transform="rotate(${a} ${x} ${y})"/>`, Math.round((227 - x) * .5), -(y - 20), 1.2 + (h % 4) * .12, 1.85 + (k % 8) * .05, 'cubic-bezier(.2,.7,.4,1)');
  }
  return s;
}

function pvAudit(info = {}) {
  let s = pvBase(160);
  s += fiA(`<rect x="40" y="6" width="280" height="56" rx="2" fill="color-mix(in srgb, var(--mustard) 38%, var(--paper))" stroke="var(--walnut)" stroke-width="3"/>${txs(180, 27, 'AUDITOR’S NOTE', 'font-size:15px')}${txs(180, 50, 'LIFETIME EARNINGS: −1/12 🍌', 'font-size:15px;fill:var(--alert)')}`, 4.3, .5);
  s += pbox({ x: 12, yb: 178, w: 108, h: 34, d: 10, c: 'walnut' });
  s += standAt(66, 176, CA, { hr: [20, -44] });
  s += at(66, 138, `<path d="M-26 0l26 -7l26 7v16l-26 -7l-26 7z" fill="var(--paper)" stroke="var(--screen)" stroke-width="1.4"/><path d="M0 -7v16" stroke="var(--screen)" stroke-width="1.2"/><path d="M-20 4l16 -3M-20 9l16 -3M6 1l16 3M6 6l16 3" stroke="var(--olive)" stroke-width="1"/>`);
  s += mvA(at(206, 154, `<rect x="-22" y="-12" width="44" height="26" fill="color-mix(in srgb, var(--mustard) 45%, var(--paper))" stroke="var(--screen)" stroke-width="1.4"/><path d="M-22 -12l22 14l22 -14" fill="none" stroke="var(--walnut)" stroke-width="1.2"/>` + banana(-6, -16, .8) + banana(8, -14, .7)), 54, 0, 1.0, 3.0, 'ease-out');
  s += pbox({ x: 236, yb: 164, w: 56, h: 100, d: 10, c: 'steel', extra: [0, 1, 2, 3].map(j => `<rect x="241" y="${164 - 94 + j * 24}" width="46" height="20" fill="none" stroke="var(--edge)" stroke-width="1.2"/><rect x="256" y="${164 - 86 + j * 24}" width="16" height="3.6" class="brass"/>`).join('') });
  s += poA(206, 112, `<rect x="-62" y="-12" width="124" height="24" rx="2" class="brass"/><text class="sg" x="0" y="5.4" style="font-size:15px">${info.amount || 'FUNDS'} FOUND</text>`, 3.9);
  // the magnifying glass, sweeping the room and ending at the cabinet's foot
  s += at(256, 150, pvA('lens', `<circle r="17" fill="color-mix(in srgb, var(--glow) 40%, transparent)" stroke="var(--mustard)" stroke-width="4"/><circle r="17" fill="none" stroke="var(--screen)" stroke-width="1"/><path d="M12 12l16 16" stroke="var(--walnut)" stroke-width="6" stroke-linecap="round"/><path d="M-9 -6a11 11 0 0 1 8 -6" stroke="var(--paper)" stroke-width="2" fill="none"/>`));
  s += poA(14, 72, sbub(0, 0, 'Hm. What’s this?'), 2.7);
  return s;
}

function pvStamp(info = {}) {
  let s = pvBase(160) + pendant(180);
  s += pbox({ x: 60, yb: 178, w: 190, h: 34, d: 12, c: 'walnut' });
  s += `<polygon points="106,134 196,134 202,146 100,146" fill="var(--paper)" stroke="var(--screen)" stroke-width="1.4"/><path d="M110 140h80M110 143.4h52" stroke="var(--concrete)" stroke-width="1"/>`;
  s += plateP(272, 24, 'EFFICIENCY REVIEW', 168);
  s += at(222, 134, `<rect x="-14" y="-3" width="28" height="7" rx="1" fill="var(--screen)" stroke="var(--edge)" stroke-width="1"/><rect x="-10" y="-10" width="20" height="8" rx="3" fill="var(--walnut)" stroke="var(--edge)" stroke-width="1"/>`);
  s += standAt(36, 176, CA, { hr: [20, -48] }) + standAt(300, 176, mkc(6, { view: 'pl', gaze: [-1, .2], mouth: 'smile', head: 'bow' }), { hl: [-12, -40] });
  s += at(150, 134, pvA('stampdn', `<rect x="-3" y="-140" width="6" height="128" fill="var(--concrete)" stroke="var(--screen)" stroke-width="1"/><rect x="-9" y="-16" width="18" height="6" rx="1" class="brass"/><rect x="-22" y="-10" width="44" height="11" rx="2" fill="var(--walnut)" stroke="var(--edge)" stroke-width="1.6"/><rect x="-18" y="1" width="36" height="3" fill="var(--alert)"/>`));
  s += poA(150, 138, `<g transform="rotate(-8)"><rect x="-64" y="-14" width="128" height="28" rx="2" fill="none" stroke="var(--alert)" stroke-width="2.4"/><text x="0" y="5.5" style="font:700 15px var(--font-display);letter-spacing:.1em;fill:var(--alert);text-anchor:middle">FINDING ${info.finding || 1}-B</text></g>`, 0.95, .25);
  s += fiA(sbub(112, 62, `Levels now cost ${info.pct || 10}% less.`, 'hot'), 1.7, .3);
  return s;
}

function pvMgr() {
  let s = pvBase(160) + chalkboard(20, 8, 150, 62, 'MANAGER', 'TRAINING 101');
  s += standAt(80, 176, TO, { hr: [24, -48] });
  const trainee = standAt(212, 176, mkc(4, { view: 'pl', gaze: [-1, .3], mouth: 'smile', eyes: 'wide', H: 62 }), { hl: [-18, -34] });
  s += trainee;
  s += mvA(at(212, 138, `<path d="M-4 0h8l-2 5l3 20l-5 6l-5 -6l3 -20z" fill="var(--alert)" stroke="var(--screen)" stroke-width="1.2" stroke-linejoin="round"/><path d="M-3 0h6l-1 5h-4z" fill="var(--alert)" stroke="var(--screen)" stroke-width="1.2"/>`), -126, -18, 1.0, .7, 'ease-in-out');
  s += mvA(clipboard(186, 128), -102, 14, 1.0, 1.3, 'ease-in-out');
  s += poA(212, 90, `<rect x="-44" y="-12" width="88" height="24" rx="2" class="brass"/><text class="sg" x="0" y="5.4" style="font-size:15px">MANAGER</text>`, 2.5, .4);
  s += poA(268, 100, star(0, 0, 9), 2.7, .3) + poA(160, 100, star(0, 0, 7), 2.85, .3);
  s += standAt(310, 176, mkc(7, { view: 'pl', mouth: 'teeth', eyes: 'wide', H: 60 }), { hl: [-14, -66], hr: [12, -64] });
  s += fiA(sbub(176, 26, 'Let’s circle back.', 'hot'), 3.1, .3);
  return s;
}

function pvComm() {
  let s = pvBase(160) + `<rect x="100" y="72" width="160" height="52" rx="2" fill="var(--paper)" stroke="var(--walnut)" stroke-width="4"/>${txs(180, 94, 'COMMUNICATION', 'font-size:15px')}${txs(180, 114, 'CLASS 101', 'font-size:15px;fill:var(--olive)')}`;
  s += standAt(80, 178, mkc(1, { view: 'pr', gaze: [1, 0], mouth: 'teeth', eyes: 'wide', H: 66 }), { hr: [20, -50] });
  s += standAt(280, 178, mkc(4, { view: 'pl', gaze: [-1, 0], mouth: 'frown', eyes: 'heavy', H: 64 }), { hl: [-20, -46] });
  s += fiA(byeA(sbub(10, 4, 'WHO DID THIS??', 'bad'), 2.3), .3, .25) + fiA(sbub(10, 4, 'Per my last memo…'), 2.5, .35);
  s += fiA(byeA(sbub(206, 34, 'NOT MY JOB!', 'bad'), 2.7), .8, .25) + fiA(sbub(206, 34, 'Noted, thanks.'), 2.9, .35);
  s += fiA(star(180, 148, 7), 3.4, .3) + fiA(star(168, 140, 5), 3.5, .3);
  return s;
}

function pvRead() {
  let s = pvBase(160) + plateP(180, 22, 'SPEED-READING 101', 170);
  s += seat(5, 130, 178, { beh: 'read', head: 'glassesR', shirt: 'sk-mustard' }, { dw: 104 });
  for (let k = 0; k < 6; k++) s += at(150, 112, pvA('flip', `<rect class="page" x="0" y="0" width="22" height="16"/><path d="M3 5h16M3 10h12" stroke="var(--concrete)" stroke-width="1"/>`, { dl: (.2 + k * .3) + 's' }));
  s += at(280, 100, `<circle r="30" fill="var(--paper)" stroke="var(--walnut)" stroke-width="4"/><circle r="30" fill="none" stroke="var(--screen)" stroke-width="1"/>` + [0, 1, 2, 3].map(k => `<path d="M0 -26v4" stroke="var(--screen)" stroke-width="2" transform="rotate(${k * 90})"/>`).join('') + `<rect x="-5" y="-40" width="10" height="9" class="brass"/><g class="sweep"><path d="M0 4V-22" stroke="var(--alert)" stroke-width="2.4" stroke-linecap="round"/></g><circle r="3" fill="var(--screen)"/>`);
  s += fiA(sbub(194, 138, 'Finished. Twice.', 'hot'), 2.6, .3);
  s += pbox({ x: 20, yb: 176, w: 50, h: 20, d: 8, c: 'walnut', tabs: false }) + pile(45, 156, 6, 30, 4);
  return s;
}

function pvBath() {
  let s = pvBase(166);
  s += `<rect x="12" y="62" width="40" height="104" fill="var(--screen)" stroke="var(--edge)" stroke-width="2.4"/><path d="M15 64L40 70V166H15Z" fill="var(--walnut)" stroke="var(--edge)" stroke-width="1.6"/>${lobby(36, 46)}`;
  s += at(114, 166, pvA('po', `<rect x="-20" y="-104" width="40" height="104" fill="var(--screen)" stroke="var(--edge)" stroke-width="2.4"/><path d="M-17 -102L10 -96V0h-27z" fill="var(--walnut)" stroke="var(--edge)" stroke-width="1.6"/><circle cx="4" cy="-48" r="2" class="brass"/><rect x="-26" y="-126" width="52" height="20" rx="2" class="brass"/><text class="sg" x="0" y="-111" style="font-size:15px">WC</text>`, { d: '.5s', dl: '.3s' }));
  s += poA(150, 90, star(0, 0, 13, 'var(--glow)'), .9, .3);
  s += pvA('enter', at(190, 166, stand(mkc(1, { view: 'pl', gaze: [-1, .3], mouth: 'o', eyes: 'wide', H: 62 }), { hl: [-8, -22], hr: [8, -22] })));
  s += fiA(byeA(sbub(176, 70, '…', 'bad'), 1.5), .2, .2);
  s += mvA(standAt(232, 166, mkc(3, { view: 'pl', gaze: [-1, .3], mouth: 'flat', H: 66 }), { hl: [-8, -22], hr: [8, -22] }), 42, 0, .7, 3.2, 'ease-in-out');
  s += mvA(standAt(274, 166, mkc(6, { view: 'pl', gaze: [-1, .3], mouth: 'o', H: 60 }), { hl: [-8, -22], hr: [8, -22] }), 42, 0, .7, 3.3, 'ease-in-out');
  s += mvA(standAt(316, 166, mkc(7, { view: 'pl', gaze: [-1, .3], mouth: 'smile', H: 64 }), { hl: [-8, -22], hr: [8, -22] }), 96, 0, 1.0, 3.4, 'ease-in-out');
  s += fiA(sbub(220, 80, 'Finally.', 'hot'), 3.9, .3);
  return s;
}

function pvBreak() {
  let s = pvBase(160) + pendant(70);
  [[3, 48], [5, 128]].forEach(([i, x]) => { s += seat(i, x, 178, { beh: i % 2 ? 'read' : 'type' }, { dw: 70 }); });
  s += `<rect x="206" y="40" width="146" height="120" fill="color-mix(in srgb, var(--olive) 30%, var(--wall-dk))" stroke="var(--edge)" stroke-width="2.4" stroke-dasharray="6 4"/>` + lamp(334, 160) + poA(279, 28, `<rect x="-62" y="-12" width="124" height="24" rx="2" class="brass"/><text class="sg" x="0" y="5.4" style="font-size:15px">BREAK ROOM</text>`, .25);
  s += mvA(standAt(274, 152, mkc(6, { view: 'pr', mouth: 'smile', eyes: 'heavy', H: 64 }), { hr: [18, -34], xr: `<rect x="14" y="-40" width="9" height="10" fill="var(--paper)" stroke="var(--screen)" stroke-width="1"/><path class="steam" d="M18 -42q-3 -5 0 -9t0 -8" fill="none" stroke="var(--edge)" stroke-width="1.6" stroke-linecap="round"/>` }), -190, 0, 1.4, 1.3, 'ease-in-out');
  s += mvA(`<g transform="translate(236 124)"><rect x="0" y="0" width="86" height="30" rx="10" fill="color-mix(in srgb, var(--alert) 65%, var(--walnut))" stroke="var(--edge)" stroke-width="2"/><rect x="-6" y="14" width="98" height="26" rx="8" fill="color-mix(in srgb, var(--alert) 55%, var(--walnut))" stroke="var(--edge)" stroke-width="2"/><rect x="-10" y="10" width="16" height="30" rx="6" fill="color-mix(in srgb, var(--alert) 75%, var(--walnut))" stroke="var(--edge)" stroke-width="1.6"/><rect x="82" y="10" width="16" height="30" rx="6" fill="color-mix(in srgb, var(--alert) 75%, var(--walnut))" stroke="var(--edge)" stroke-width="1.6"/><path d="M0 40v6M86 40v6" stroke="var(--edge)" stroke-width="3"/></g>`, 150, 0, 1.0, .2, 'cubic-bezier(.3,.8,.3,1)');
  s += fiA(`<text x="298" y="106" style="font:700 16px var(--font-display);fill:var(--ink)">z</text><text x="310" y="90" style="font:700 22px var(--font-display);fill:var(--ink)">Z</text>`, 3.2, .5);
  return s;
}

function pvSnack() {
  let s = pvBase(160) + pendant(180);
  s += standAt(60, 178, mkc(0, { view: 'pr', gaze: [1, .3], mouth: 'frown', H: 64 }), { hr: [12, -30] });
  s += fiA(sbub(6, 60, 'Ate my coin.'), .4, .3);
  const rows = [0, 1, 2].map(r => [0, 1, 2].map(c => banana(140 + c * 20, 78 + r * 24, .46)).join('')).join('');
  s += pvA('hum', pvA('shk', pbox({ x: 130, yb: 172, w: 74, h: 124, d: 12, c: 'steel', extra: `<rect x="138" y="${172 - 112}" width="58" height="76" fill="var(--screen)" opacity=".85"/>${rows}<rect x="140" y="${172 - 28}" width="54" height="14" fill="var(--screen)" stroke="var(--edge)" stroke-width="1.2"/><rect x="176" y="${172 - 70}" width="14" height="22" fill="var(--concrete)" stroke="var(--edge)" stroke-width="1"/>` }) + `<g transform="translate(167 54)"><rect x="-34" y="-14" width="68" height="22" rx="2" class="brass"/><text class="sg" x="0" y="2" style="font-size:15px">SNACKS</text></g>`));
  s += pvA('shk', standAt(236, 178, mkc(2, { view: 'pl', gaze: [-1, .4], mouth: 'teeth', eyes: 'wide', H: 66, head: 'pencil' }), { hl: [-18, -52], hr: [-14, -40] }));
  s += mvA(`<g transform="translate(166 152)"><rect x="-12" y="-5" width="24" height="9" rx="2" fill="var(--mustard)" stroke="var(--screen)" stroke-width="1.2"/><path d="M-8 -1h16" stroke="var(--screen)" stroke-width=".8" opacity=".6"/></g>`, 0, -64, .45, 1.8, 'cubic-bezier(.5,0,.9,.6)');
  s += fiA(byeA(poA(214, 70, sbub(0, 0, 'BONK', 'hot'), 0, .2), 3.0), 1.8, .15);
  s += fiA(sbub(252, 96, 'Worth it.', 'hot'), 3.2, .3);
  return s;
}

/** Registry: the room that hosts each scene when it is open (otherwise it plays as an inset), and how long the action runs (ms). */
export const PAYOFF_META = {
  pizza: { room: 'pool', ms: 4200, cap: 'Pizza boxes arrive on the Typing Pool floor. The monkeys crowd round. Crumbs on the keys.' },
  team: { room: null, ms: 6400, cap: 'Trust falls in the lobby. One monkey is not caught. Then is.' },
  escape: { room: null, ms: 4200, cap: 'The door bursts open to confetti. One monkey is still inside.' },
  bath: { room: null, ms: 4600, cap: 'A new door by the lobby. The queue shuffles forward.' },
  brk: { room: 'pool', ms: 3800, cap: 'A nook off the Typing Pool. A couch arrives. Somebody is on it.' },
  snack: { room: 'pool', ms: 3800, cap: 'It hums. A monkey shakes it. It gives.' },
  audit: { room: null, ms: 5000, cap: 'A magnifying glass, then an envelope of bananas under the filing cabinet.' },
  stamp: { room: null, ms: 2800, cap: 'Rubber stamp. The finding is filed.' },
  mgr: { room: null, ms: 3800, cap: 'A monkey receives a tie and a clipboard.' },
  comm: { room: null, ms: 3800, cap: 'The speech bubbles turn polite.' },
  read: { room: null, ms: 3600, cap: 'Pages turn faster. The stopwatch finishes first.' },
};
const PV = { pizza: pvPizza, team: pvTeam, escape: pvEscape, bath: pvBath, brk: pvBreak, snack: pvSnack, audit: pvAudit, stamp: pvStamp, mgr: pvMgr, comm: pvComm, read: pvRead };
/** One payoff scene's markup for a 0 0 360 220 viewBox. `info` carries real figures: { amount, finding, pct }. */
export function payoffSVG(id, info = {}) {
  const f = PV[id];
  return f ? f(info) : '';
}
