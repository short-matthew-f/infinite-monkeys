// The Bureau's parts kit and room scenes. Ported from the art exploration
// (design/explorations/floor-r4), kept as art so art agents can keep editing it;
// the typed boundary is floor-art.d.ts.
//
// buildRoom(id, props) is pure: same props, same markup, no DOM. The room view
// calls it, compares `key` with the last one, and replaces the scene only when
// the picture can change. tower-art.js draws the building's small per-floor
// scenes from the same kit.
/* eslint-disable */
export const f1 = n => Math.round(n * 10) / 10;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ===== the cast: every typist is authored, so no two share a silhouette, view, gaze or headwear ===== */
export function hash(i) { let h = Math.imul(i + 1, 0x9E3779B1); h ^= h >>> 15; h = Math.imul(h, 0x85EBCA77); h ^= h >>> 13; h = Math.imul(h, 0xC2B2AE3D); h ^= h >>> 16; return h >>> 0; }
const BEH_LABEL = { type: 'touch-typing', peck: 'hunt-and-peck', slam: 'carriage-return slam', sip: 'sipping from a mug', stretch: 'stretching', read: 'reading a page', doze: 'dozing', sharpen: 'sharpening a pencil', stamp: 'stamping' };
// H = visible height above the desk, bw = shoulder width, tw = hip/shoulder ratio, hr = head radius
export const CAST = [
  { fur: 3, H: 62, bw: 38, tw: 1.0, hr: 13, ears: 'round', lean: -6, view: 'f', gaze: [0, .9], eyes: 'open', mouth: 'flat', head: 'phones', body: 'tie', tail: 'up', prop: 0, ps: 1, beh: 'type', shirt: 'sk-paper', chair: 'tall' },
  { fur: 1, H: 47, bw: 25, tw: 1.2, hr: 12.5, ears: 'big', lean: 8, view: 'pr', gaze: [1, .6], eyes: 'wide', mouth: 'tongue', head: 'swirl', body: 'none', tail: 'curl', prop: 1, ps: -1, beh: 'peck', shirt: 'sk-mustard', chair: 'short', fwd: 4 },
  { fur: 2, H: 64, bw: 26, tw: .95, hr: 11, ears: 'tuft', lean: 4, view: 'f', gaze: [0, -.9], eyes: 'wide', mouth: 'teeth', head: 'glassesS', body: 'bowtie', tail: 'hang', prop: 5, ps: 1, beh: 'slam', shirt: 'sk-olive', chair: 'round' },
  { fur: 4, H: 52, bw: 30, tw: 1.35, hr: 12.5, ears: 'big', lean: 0, view: 'l', gaze: [-1, .1], eyes: 'heavy', mouth: 'smirk', head: 'pencil', body: 'cardigan', tail: 'curl', prop: 3, ps: 1, beh: 'sip', shirt: 'sk-shade', chair: 'tall', fwd: 2 },
  { fur: 0, H: 58, bw: 40, tw: .88, hr: 14.5, ears: 'small', lean: 0, view: 'f', gaze: [0, 0], eyes: 'closed', mouth: 'o', head: 'none', body: 'lanyard', tail: 'none', prop: 4, ps: -1, beh: 'stretch', shirt: 'sk-rust', chair: 'short' },
  { fur: 5, H: 55, bw: 24, tw: 1.0, hr: 11.5, ears: 'round', lean: -5, view: 'pl', gaze: [-1, .3], eyes: 'open', mouth: 'frown', head: 'glassesR', body: 'bowtie', tail: 'up', prop: 2, ps: 1, beh: 'read', shirt: 'sk-paper', chair: 'round', fwd: 3 },
  { fur: 3, H: 50, bw: 32, tw: 1.25, hr: 13, ears: 'big', lean: 0, view: 'r', gaze: [.6, .3], eyes: 'heavy', mouth: 'o', head: 'none', body: 'cardigan', tail: 'hang', prop: 0, ps: -1, beh: 'doze', shirt: 'sk-mustard', chair: 'tall', fwd: 3 },
  { fur: 2, H: 54, bw: 30, tw: 1.0, hr: 12, ears: 'tuft', lean: 7, view: 'l', gaze: [-1, .5], eyes: 'wide', mouth: 'smile', head: 'bow', body: 'none', tail: 'curl', prop: 4, ps: 1, beh: 'sharpen', shirt: 'sk-olive', chair: 'short' },
  // beyond the first eight desks: generated from the desk index
];
const EARS = ['round', 'big', 'small', 'tuft'], VIEWS = ['f', 'l', 'r', 'pl', 'pr'], MOUTHS = ['smile', 'flat', 'o', 'tongue', 'teeth', 'frown', 'smirk'];
const BEHS = ['type', 'peck', 'slam', 'sip', 'stretch', 'read', 'doze', 'sharpen'];
function gen(i) {
  const r = (k, n) => hash(i * 31 + k * 977) % n;
  return { fur: r(1, 6), H: 46 + r(2, 18), bw: 24 + r(3, 16), tw: .9 + r(4, 45) / 100, hr: 11 + r(5, 4), ears: EARS[r(6, 4)], lean: r(7, 15) - 7, view: VIEWS[r(8, 5)], gaze: [r(9, 3) - 1, r(10, 3) - 1], eyes: ['open', 'wide', 'heavy'][r(11, 3)], mouth: MOUTHS[r(12, 7)], head: 'none', body: ['none', 'tie', 'cardigan', 'lanyard'][r(14, 4)], tail: ['curl', 'up', 'hang', 'none'][r(15, 4)], prop: r(16, 6), ps: r(17, 2) ? 1 : -1, beh: BEHS[r(18, 8)], shirt: ['sk-paper', 'sk-mustard', 'sk-olive', 'sk-shade', 'sk-rust'][r(19, 5)], chair: ['tall', 'short', 'round'][r(20, 3)] };
}
const rot = (p, a, o) => { const r = a * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), x = p[0] - o[0], y = p[1] - o[1]; return [o[0] + x * c - y * s, o[1] + x * s + y * c]; };

/* ===== svg helpers ===== */
// standing piece: contact + long shadow, fold tabs, front face, cut rim, lighter top face
export function pbox({ x, yb, w, h, d = 8, c = 'walnut', extra = '', before = '', cls = '', tabs = true, shadow = true, glass = false, sk = 1 }) {
  const i = d * .2, cx = x + w / 2;
  const sh = shadow ? `<polygon class="shl" points="${x},${yb} ${x + w},${yb} ${f1(x + w + h * .5 * sk)},${f1(yb + h * .2 * sk + 4)} ${f1(x + h * .5 * sk)},${f1(yb + h * .2 * sk + 4)}"/><polygon class="shc" points="${x},${yb} ${x + w},${yb} ${x + w + 3},${yb + 4} ${x + 3},${yb + 4}"/>` : '';
  const tb = tabs ? `<polygon class="tb" points="${f1(x + w * .1)},${yb - 1} ${f1(x + w * .3)},${yb - 1} ${f1(x + w * .3 + 3)},${yb + 6} ${f1(x + w * .1 - 3)},${yb + 6}"/><polygon class="tb" points="${f1(x + w * .7)},${yb - 1} ${f1(x + w * .9)},${yb - 1} ${f1(x + w * .9 + 3)},${yb + 6} ${f1(x + w * .7 - 3)},${yb + 6}"/>` : '';
  const fr = glass ? `<rect class="glass-f" x="${x}" y="${yb - h}" width="${w}" height="${h}"/>` : `<rect class="fr" x="${x}" y="${yb - h}" width="${w}" height="${h}" rx="1.5"/><path class="rim" d="M${x + 1.5} ${yb - 1}V${yb - h + 1.5}H${x + w - 1.5}"/>`;
  const tp = `<polygon class="${glass ? 'glass-t' : 'tp'}" points="${f1(x + i)},${yb - h - d} ${f1(x + w - i)},${yb - h - d} ${x + w},${yb - h} ${x},${yb - h}"/>`;
  return `<g class="up c-${c} ${cls}" style="transform-origin:${cx}px ${yb}px">${sh}${before}${tb}${fr}${tp}${extra}</g>`;
}
// hanging sign: two posts and a brass rail, the plate hangs from cords and swings; shadow falls on the pad
export function sign(cx, top, w, h, text, nd = 0) {
  const x = cx - w / 2, rod = top - 13, base = top + h + 22;
  const post = px => `<rect class="tb" x="${px - 3}" y="${rod}" width="6" height="${base - rod}" rx="1"/><rect class="tb" x="${px - 7}" y="${base - 2}" width="14" height="5" rx="1.5"/>`;
  return `<g class="up" style="transform-origin:${cx}px ${base}px">` +
    `<polygon class="shl" points="${x + 2},${base + 3} ${x + w - 2},${base + 3} ${x + w + 18},${base + 12} ${x + 20},${base + 12}"/>` +
    `<polygon class="shc" points="${x + 8},${base - 3} ${x + w - 8},${base - 3} ${x + w - 4},${base + 2} ${x + 4},${base + 2}" style="opacity:.16"/>` +
    post(x - 6) + post(x + w + 6) +
    `<line x1="${x - 9}" y1="${rod}" x2="${x + w + 9}" y2="${rod}" stroke="var(--screen)" stroke-width="5" stroke-linecap="round"/><line x1="${x - 9}" y1="${rod}" x2="${x + w + 9}" y2="${rod}" stroke="var(--mustard)" stroke-width="3" stroke-linecap="round"/>` +
    `<circle class="brass" cx="${x - 9}" cy="${rod}" r="3.4"/><circle class="brass" cx="${x + w + 9}" cy="${rod}" r="3.4"/>` +
    `<g class="swing" style="transform-origin:${cx}px ${rod}px;--nd:${nd}s">` +
    `<path d="M${x + 14} ${rod}L${x + 14} ${top}M${x + w - 14} ${rod}L${x + w - 14} ${top}" stroke="var(--edge)" stroke-width="1.8"/><path d="M${x + 14} ${rod}L${x + 14} ${top}M${x + w - 14} ${rod}L${x + w - 14} ${top}" stroke="var(--screen)" stroke-width=".8"/>` +
    `<rect class="shc" x="${x + 3}" y="${top + 4}" width="${w}" height="${h}" rx="2" style="opacity:.3"/>` +
    `<rect class="fr c-mustard" x="${x}" y="${top}" width="${w}" height="${h}" rx="2"/><path class="rim" d="M${x + 1.5} ${top + h - 1}V${top + 1.5}H${x + w - 1.5}"/>` +
    `<circle class="brass" cx="${x + 14}" cy="${top + 1}" r="2.6"/><circle class="brass" cx="${x + w - 14}" cy="${top + 1}" r="2.6"/>` +
    `<text class="sg" x="${cx}" y="${top + h / 2 + 4.6}">${text}</text></g></g>`;
}
// floor lamp, fully lit: pool of light on the pad, glowing bulb under the shade, rays; only an outer ring breathes
export function lamp(x, yb, dl = 0, breathe = false) {
  const sy = yb - 34;
  return `<g><polygon class="shl" points="${x - 7},${yb} ${x + 7},${yb} ${x + 24},${yb + 6} ${x + 8},${yb + 6}"/>` +
    `<ellipse class="halo${breathe ? ' pulse' : ''}" cx="${x}" cy="${yb - 6}" rx="42" ry="26" style="${breathe ? `animation-delay:${dl}s` : 'opacity:.4'}"/><ellipse class="halo" cx="${x}" cy="${yb - 8}" rx="28" ry="17"/>` +
    `<ellipse class="fr" style="--c:var(--walnut)" cx="${x}" cy="${yb - 1}" rx="9" ry="3.4"/><rect x="${x - 1.6}" y="${sy}" width="3.2" height="${yb - sy - 1}" fill="var(--mustard)" stroke="var(--screen)" stroke-width=".6"/>` +
    `<path class="rays" d="M${x - 14} ${sy + 10}l-6 5M${x - 9} ${sy + 14}l-4 7M${x} ${sy + 15}v8M${x + 9} ${sy + 14}l4 7M${x + 14} ${sy + 10}l6 5"/>` +
    `<ellipse class="lampc" cx="${x}" cy="${sy + 2}" rx="11" ry="4.4"/><path class="fr" style="--c:var(--tangerine)" d="M${x - 13} ${sy}L${x - 7} ${sy - 15}H${x + 7}L${x + 13} ${sy}Z"/><path class="rim" d="M${x - 11} ${sy - 1}L${x - 6} ${sy - 13}H${x + 6}"/></g>`;
}
// paper hand pointing down at the next thing to tap; it bobs, and its shadow shrinks as it lifts
export function nextCue(x, y) {
  const L = 'stroke="var(--screen)" stroke-width="1.5" stroke-linejoin="round"';
  const hand = `<rect x="-11" y="-44" width="22" height="11" rx="2" fill="var(--tangerine)" stroke="var(--edge)" stroke-width="1.8"/><path d="M-6 -44v11M0 -44v11M6 -44v11" stroke="var(--edge)" stroke-width="1" opacity=".7"/>` +
    `<path d="M-10 -33H10q4 0 4 5V-6q0 4-4 4H-10q-4 0-4-4V-28q0-5 4-5z" fill="var(--edge)" ${L}/>` +
    `<path d="M-13 -26q-9 -1 -9 7t9 9z" fill="var(--edge)" ${L}/>` +
    `<path d="M2 -26h10M2 -19h10M2 -12h10" stroke="var(--screen)" stroke-width="1.5" stroke-linecap="round" opacity=".75"/>` +
    `<rect x="-6.5" y="-4" width="11" height="30" rx="5.5" fill="var(--edge)" ${L}/><path d="M-3 18h5" stroke="var(--screen)" stroke-width="1.2" stroke-linecap="round" opacity=".6"/>`;
  return `<g class="nextcue" transform="translate(${x} ${y})"><ellipse class="shl cuesh" cx="6" cy="34" rx="14" ry="4" style="opacity:.34"/><g class="cue">${hand}</g></g>`;
}
/* plants: three distinct kinds */
export function ficus(cx, yb, s = 1) {
  const blobs = [[0, -50, 15], [-13, -40, 11], [13, -42, 12], [-6, -62, 10], [9, -60, 9], [0, -36, 10]].map(([dx, dy, r], k) => `<circle class="${k % 2 ? 'leaf2' : 'leaf'}" cx="${cx + dx * s}" cy="${yb + dy * s}" r="${r * s}"/>`).join('');
  return `<g class="up" style="transform-origin:${cx}px ${yb}px"><polygon class="shl" points="${cx - 9 * s},${yb} ${cx + 9 * s},${yb} ${cx + 34 * s},${yb + 8 * s} ${cx + 10 * s},${yb + 8 * s}"/><polygon class="shc" points="${cx - 9 * s},${yb} ${cx + 9 * s},${yb} ${cx + 12 * s},${yb + 3} ${cx - 6 * s},${yb + 3}"/>` +
    `<path d="M${cx} ${yb - 12 * s}V${yb - 38 * s}M${cx} ${yb - 28 * s}l-8 -8M${cx} ${yb - 32 * s}l8 -8" stroke="var(--walnut)" stroke-width="${3 * s}" stroke-linecap="round" fill="none"/>${blobs}` +
    `<path class="fr" style="--c:var(--tangerine)" d="M${cx - 10 * s} ${yb - 14 * s}H${cx + 10 * s}L${cx + 7 * s} ${yb}H${cx - 7 * s}Z"/><path class="rim" d="M${cx - 9 * s} ${yb - 13 * s}h${18 * s}"/></g>`;
}
export function snake(cx, yb, s = 1) {
  const blade = (dx, h, lean, w = 5) => `<path d="M${cx + dx * s - w * s} ${yb - 12 * s}Q${cx + (dx + lean * .4) * s} ${yb - h * .5 * s} ${cx + (dx + lean) * s} ${yb - h * s}Q${cx + (dx + lean * .5 + w) * s} ${yb - h * .45 * s} ${cx + dx * s + w * s} ${yb - 12 * s}Z" class="leaf" style="fill:color-mix(in srgb, var(--olive) 78%, var(--screen))"/><path d="M${cx + dx * s} ${yb - 14 * s}Q${cx + (dx + lean * .4) * s} ${yb - h * .5 * s} ${cx + (dx + lean) * s} ${yb - (h - 3) * s}" stroke="var(--mustard)" stroke-width="${1.6 * s}" fill="none" stroke-linecap="round"/>`;
  return `<g class="up" style="transform-origin:${cx}px ${yb}px"><polygon class="shl" points="${cx - 11 * s},${yb} ${cx + 11 * s},${yb} ${cx + 36 * s},${yb + 8 * s} ${cx + 12 * s},${yb + 8 * s}"/><polygon class="shc" points="${cx - 11 * s},${yb} ${cx + 11 * s},${yb} ${cx + 14 * s},${yb + 3} ${cx - 8 * s},${yb + 3}"/>` +
    blade(-9, 52, -6) + blade(8, 58, 7) + blade(0, 70, 1, 5.4) + blade(-3, 40, -9, 4.4) + blade(5, 44, 10, 4.4) +
    `<rect class="fr c-concrete" x="${cx - 11 * s}" y="${yb - 16 * s}" width="${22 * s}" height="${16 * s}" rx="1.5"/><path class="rim" d="M${cx - 10 * s} ${yb - 1}V${yb - 15 * s}H${cx + 10 * s}"/><rect x="${cx - 11 * s}" y="${yb - 16 * s}" width="${22 * s}" height="${3.4 * s}" fill="var(--mustard)" stroke="var(--edge)" stroke-width="1"/></g>`;
}
export function cactus(cx, yb, s = 1) {
  return `<g class="up" style="transform-origin:${cx}px ${yb}px"><polygon class="shl" points="${cx - 8 * s},${yb} ${cx + 8 * s},${yb} ${cx + 28 * s},${yb + 6 * s} ${cx + 8 * s},${yb + 6 * s}"/><polygon class="shc" points="${cx - 8 * s},${yb} ${cx + 8 * s},${yb} ${cx + 10 * s},${yb + 3} ${cx - 6 * s},${yb + 3}"/>` +
    `<rect class="leaf2" x="${cx - 6 * s}" y="${yb - 44 * s}" width="${12 * s}" height="${34 * s}" rx="${6 * s}"/><path class="leaf2" d="M${cx - 6 * s} ${yb - 26 * s}h${-6 * s}q${-5 * s} 0 ${-5 * s} ${-6 * s}v${-8 * s}" stroke-width="${1 * s}" style="fill:none;stroke:var(--edge);stroke-width:${6 * s}px;stroke-linecap:round"/><path d="M${cx - 6 * s} ${yb - 26 * s}h${-6 * s}q${-5 * s} 0 ${-5 * s} ${-6 * s}v${-8 * s}" fill="none" stroke="var(--olive)" stroke-width="${4 * s}" stroke-linecap="round" style="stroke:color-mix(in srgb, var(--olive) 70%, var(--phosphor-green))"/>` +
    `<path d="M${cx} ${yb - 40 * s}v${28 * s}" stroke="var(--edge)" stroke-width="1" opacity=".6"/><circle cx="${cx}" cy="${yb - 46 * s}" r="${3.4 * s}" fill="var(--alert)" stroke="var(--edge)" stroke-width="1"/>` +
    `<path class="fr" style="--c:var(--tangerine)" d="M${cx - 9 * s} ${yb - 12 * s}H${cx + 9 * s}L${cx + 7 * s} ${yb}H${cx - 7 * s}Z"/></g>`;
}
/* small story props */
export function umbrellaStand(cx, yb) {
  return `<g class="up" style="transform-origin:${cx}px ${yb}px"><polygon class="shl" points="${cx - 10},${yb} ${cx + 10},${yb} ${cx + 32},${yb + 7} ${cx + 10},${yb + 7}"/><polygon class="shc" points="${cx - 10},${yb} ${cx + 10},${yb} ${cx + 13},${yb + 3} ${cx - 7},${yb + 3}"/>` +
    `<path d="M${cx - 4} ${yb - 28}l-6 -34" stroke="var(--screen)" stroke-width="2.4" stroke-linecap="round"/><path d="M${cx - 10} ${yb - 62}q-3 -9 5 -12q9 3 5 12z" class="fr" style="--c:var(--alert)"/><path d="M${cx + 4} ${yb - 28}l7 -30" stroke="var(--screen)" stroke-width="2.4" stroke-linecap="round"/><path d="M${cx + 11} ${yb - 58}q-1 -9 7 -10q7 4 3 10z" class="fr" style="--c:var(--mustard)"/><path d="M${cx + 8} ${yb - 28}l12 -22q4 -6 8 -2" fill="none" stroke="var(--walnut)" stroke-width="3" stroke-linecap="round"/>` +
    `<path class="fr c-steel" d="M${cx - 11} ${yb - 28}H${cx + 11}L${cx + 9} ${yb}H${cx - 9}Z"/><path class="rim" d="M${cx - 10} ${yb - 27}H${cx + 10}"/><ellipse cx="${cx}" cy="${yb - 28}" rx="11" ry="3" fill="var(--screen)" stroke="var(--edge)" stroke-width="1.2"/><path d="M${cx - 8} ${yb - 12}h16" stroke="var(--mustard)" stroke-width="2"/></g>`;
}
function stepLadder(cx, yb) {
  const rail = (x1, x2) => `<path d="M${x1} ${yb}L${x2} ${yb - 64}" stroke="var(--edge)" stroke-width="7" stroke-linecap="square"/><path d="M${x1} ${yb}L${x2} ${yb - 64}" stroke="var(--walnut)" stroke-width="4"/>`;
  return `<g class="up" style="transform-origin:${cx}px ${yb}px"><polygon class="shl" points="${cx - 22},${yb} ${cx + 22},${yb} ${cx + 48},${yb + 8} ${cx - 4},${yb + 8}"/><polygon class="shc" points="${cx - 22},${yb} ${cx + 22},${yb} ${cx + 25},${yb + 3} ${cx - 19},${yb + 3}"/>` +
    `<path d="M${cx + 14} ${yb - 60}L${cx + 30} ${yb}" stroke="var(--edge)" stroke-width="5"/><path d="M${cx + 14} ${yb - 60}L${cx + 30} ${yb}" stroke="color-mix(in srgb, var(--walnut) 70%, var(--screen))" stroke-width="2.6"/>` +
    rail(cx - 20, cx - 8) + rail(cx + 20, cx + 8) +
    [14, 28, 42].map(h => `<rect class="fr c-mustard" x="${cx - 19 + h * .19}" y="${yb - h - 3}" width="${38 - h * .38}" height="5" rx="1"/>`).join('') +
    `<rect class="fr c-paper" x="${cx - 12}" y="${yb - 70}" width="24" height="7" rx="1.5"/><rect x="${cx - 6}" y="${yb - 82}" width="12" height="12" fill="var(--tangerine)" stroke="var(--edge)" stroke-width="1.2"/><rect x="${cx - 6}" y="${yb - 82}" width="12" height="3" fill="var(--screen)" opacity=".5"/></g>`;
}
export function wasteBin(cx, yb) {
  return `<g class="up" style="transform-origin:${cx}px ${yb}px"><polygon class="shl" points="${cx - 12},${yb} ${cx + 12},${yb} ${cx + 32},${yb + 6} ${cx + 10},${yb + 6}"/><polygon class="shc" points="${cx - 11},${yb} ${cx + 11},${yb} ${cx + 14},${yb + 3} ${cx - 8},${yb + 3}"/>` +
    `<circle cx="${cx - 4}" cy="${yb - 30}" r="7" fill="var(--edge)" stroke="var(--concrete)" stroke-width="1.2"/><path d="M${cx - 8} ${yb - 31}l5 3M${cx - 5} ${yb - 35}l2 6" stroke="var(--concrete)" stroke-width="1"/><circle cx="${cx + 6}" cy="${yb - 29}" r="5.4" fill="var(--paper-shade)" stroke="var(--concrete)" stroke-width="1.2"/>` +
    `<path class="fr c-concrete" d="M${cx - 12} ${yb - 28}H${cx + 12}L${cx + 9} ${yb}H${cx - 9}Z"/><path class="rim" d="M${cx - 11} ${yb - 27}H${cx + 11}"/><path d="M${cx - 5} ${yb - 22}V${yb - 5}M${cx} ${yb - 22}V${yb - 5}M${cx + 5} ${yb - 22}V${yb - 5}" stroke="var(--edge)" stroke-width="1.3" opacity=".6"/><circle cx="${cx + 21}" cy="${yb - 3}" r="4.4" fill="var(--edge)" stroke="var(--concrete)" stroke-width="1"/></g>`;
}
export function noticeBoard(cx, yb) {
  const w = 70, h = 48, x = cx - w / 2, y = yb - 30 - h;
  return `<g class="up" style="transform-origin:${cx}px ${yb}px"><polygon class="shl" points="${x},${yb} ${x + w},${yb} ${x + w + 26},${yb + 8} ${x + 22},${yb + 8}"/><polygon class="shc" points="${x + 6},${yb} ${x + w - 6},${yb} ${x + w - 3},${yb + 3} ${x + 9},${yb + 3}"/>` +
    `<path d="M${x + 10} ${y + h}L${x + 4} ${yb}M${x + w - 10} ${y + h}L${x + w - 4} ${yb}" stroke="var(--edge)" stroke-width="6"/><path d="M${x + 10} ${y + h}L${x + 4} ${yb}M${x + w - 10} ${y + h}L${x + w - 4} ${yb}" stroke="var(--walnut)" stroke-width="3.4"/>` +
    `<rect class="fr c-walnut" x="${x}" y="${y}" width="${w}" height="${h}" rx="2"/><rect x="${x + 4}" y="${y + 4}" width="${w - 8}" height="${h - 8}" fill="color-mix(in srgb, var(--tangerine) 40%, var(--paper-shade))" stroke="var(--screen)" stroke-width=".8"/><path class="rim" d="M${x + 1.5} ${y + h - 1}V${y + 1.5}H${x + w - 1.5}"/>` +
    `<rect class="page" x="${x + 9}" y="${y + 8}" width="20" height="16" transform="rotate(-3 ${x + 19} ${y + 16})"/><path d="M${x + 12} ${y + 13}h14M${x + 12} ${y + 17}h14M${x + 12} ${y + 21}h8" stroke="var(--concrete)" stroke-width="1" transform="rotate(-3 ${x + 19} ${y + 16})"/>` +
    `<rect class="page" x="${x + 33}" y="${y + 6}" width="14" height="22" transform="rotate(4 ${x + 40} ${y + 17})"/><rect x="${x + 36}" y="${y + 10}" width="8" height="6" fill="none" stroke="var(--alert)" stroke-width="1.4" transform="rotate(4 ${x + 40} ${y + 17})"/>` +
    `<rect x="${x + 50}" y="${y + 12}" width="14" height="14" fill="var(--mustard)" stroke="var(--edge)" stroke-width="1" transform="rotate(-5 ${x + 57} ${y + 19})"/><path d="M${x + 12} ${y + 31}h26l-2 8h-24z" fill="var(--edge)" stroke="var(--concrete)" stroke-width=".8"/>` +
    `<circle cx="${x + 19}" cy="${y + 9}" r="1.8" fill="var(--alert)"/><circle cx="${x + 40}" cy="${y + 8}" r="1.8" fill="var(--alert)"/><circle cx="${x + 57}" cy="${y + 13}" r="1.8" fill="var(--alert)"/><circle cx="${x + 25}" cy="${y + 33}" r="1.8" fill="var(--olive)"/></g>`;
}
// a zone pad: shadow tiers, a visible paper edge underneath, and a lifted dog-ear corner
function padSVG(x, y, w, h, tint) {
  const r = 4, k = 28;
  return `<rect class="apron" x="${x - 14}" y="${y - 12}" width="${w + 28}" height="${h + 30}" rx="9"/><rect class="apron-dots" x="${x - 8}" y="${y - 6}" width="${w + 16}" height="${h + 18}" rx="6"/><rect class="pad-sh2" x="${x + 12}" y="${y + 18}" width="${w}" height="${h}" rx="${r}"/><rect class="pad-sh" x="${x + 5}" y="${y + 9}" width="${w}" height="${h}" rx="${r}"/>` +
    `<rect class="pad-th ${tint}" x="${x}" y="${y + 6}" width="${w}" height="${h}" rx="${r}"/><rect class="pad ${tint}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>` +
    `<path class="curl-sh" d="M${x + w - k + 4} ${y + h - 2}L${x + w - 3} ${y + h - k + 6}L${x + w + 3} ${y + h + 6}Z"/><path class="curl ${tint}" d="M${x + w - k} ${y + h}L${x + w} ${y + h - k}L${x + w - 3} ${y + h - 3}Z"/><path d="M${x + w - k} ${y + h}L${x + w} ${y + h - k}" stroke="var(--concrete)" stroke-width="1" opacity=".7"/>`;
}
export const T = (x, y, inner, cls = '', st = '') => `<g transform="translate(${x} ${y})"${cls ? ` class="${cls}"` : ''}${st ? ` style="${st}"` : ''}>${inner}</g>`;

/* ===== monkey parts (local coords: 0,0 = base of desk, y up is negative) ===== */
function wedge(x, y, r, a1, a2) { const p = a => [f1(x + r * Math.cos(a * Math.PI / 180)), f1(y + r * Math.sin(a * Math.PI / 180))]; const [x1, y1] = p(a1), [x2, y2] = p(a2); return `M${x} ${y}L${x1} ${y1}A${r} ${r} 0 0 1 ${x2} ${y2}Z`; }
function eyeSVG(x, y, r, g, kind) {
  if (kind === 'closed') return `<path d="M${f1(x - r)} ${f1(y + r * .2)}Q${x} ${f1(y - r * 1.3)} ${f1(x + r)} ${f1(y + r * .2)}" class="inkl" stroke-width="1.5"/>`;
  const px = f1(x + g[0] * r * .42), py = f1(y + g[1] * r * .36);
  const lid = kind === 'heavy' ? `<path d="M${f1(x - r - .4)} ${f1(y + r * .1)}a${f1(r + .4)} ${f1(r + .4)} 0 0 1 ${f1(2 * r + .8)} 0z" class="fur" stroke="var(--screen)" stroke-width=".7"/>` : '';
  return `<circle cx="${x}" cy="${y}" r="${r}" class="glowf" stroke="var(--screen)" stroke-width=".8"/><circle cx="${px}" cy="${py}" r="${f1(r * .66)}" class="ink"/><path d="${wedge(px, py, r * .66, -70, -10)}" class="glowf"/>${lid}`;
}
export function headSVG(s, hx, hy, hr) {
  const v = { f: 0, l: -1, r: 1, pl: -1, pr: 1 }[s.view], prof = s.view[0] === 'p', vv = v || 1;
  const er = hr * ({ big: .66, round: .5, small: .33, tuft: .42 }[s.ears]);
  const ear = (x, y, r) => `<circle class="fur" cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}"/><circle class="face" cx="${f1(x)}" cy="${f1(y)}" r="${f1(r * .55)}"/>` + (s.ears === 'tuft' ? `<path d="M${f1(x - r * .6)} ${f1(y - r * .8)}l-1 -4M${f1(x)} ${f1(y - r)}l0 -5M${f1(x + r * .6)} ${f1(y - r * .8)}l1 -4" class="furl" stroke-width="1.8"/>` : '');
  let o = '';
  if (!prof) o += v === 0 ? ear(hx - hr * .98, hy, er) + ear(hx + hr * .98, hy, er) : ear(hx - v * hr * .9, hy + 1, er) + ear(hx + v * hr * .78, hy, er * .62);
  if (s.flange) o += `<ellipse class="fur" cx="${f1(hx - hr * .92)}" cy="${f1(hy + hr * .25)}" rx="${f1(hr * .42)}" ry="${f1(hr * .6)}"/><ellipse class="fur" cx="${f1(hx + hr * .92)}" cy="${f1(hy + hr * .25)}" rx="${f1(hr * .42)}" ry="${f1(hr * .6)}"/>`;
  o += `<circle class="fur" cx="${hx}" cy="${hy}" r="${hr}"/>`;
  const ey = hy - hr * .06;
  let eyes = '', mx, my = hy + hr * .62, mw = hr * .28;
  const er0 = hr * (s.eyes === 'wide' ? .31 : .27);
  if (prof) {
    o += `<ellipse class="face" cx="${f1(hx + v * hr * .34)}" cy="${f1(hy + hr * .1)}" rx="${f1(hr * .56)}" ry="${f1(hr * .62)}"/><ellipse class="fur" cx="${f1(hx + v * hr * .86)}" cy="${f1(hy + hr * .42)}" rx="${f1(hr * .44)}" ry="${f1(hr * .34)}" style="fill:color-mix(in srgb, var(--fur) 40%, var(--glow))"/><circle cx="${f1(hx + v * hr * 1.18)}" cy="${f1(hy + hr * .3)}" r="1.5" class="ink"/>`;
    o += ear(hx - v * hr * .22, hy + hr * .08, er);
    eyes = eyeSVG(f1(hx + v * hr * .5), f1(ey), er0, [v * Math.abs(s.gaze[0] || 1), s.gaze[1]], s.eyes);
    mx = hx + v * hr * .86; my = hy + hr * .62; mw = hr * .2;
  } else if (v === 0) {
    o += `<ellipse class="face" cx="${hx}" cy="${f1(hy + hr * .2)}" rx="${f1(hr * .74)}" ry="${f1(hr * .66)}"/>`;
    const e = hr * .36; eyes = eyeSVG(f1(hx - e), f1(ey), er0, s.gaze, s.eyes) + eyeSVG(f1(hx + e), f1(ey), er0, s.gaze, s.eyes); mx = hx;
  } else {
    o += `<ellipse class="face" cx="${f1(hx + v * hr * .3)}" cy="${f1(hy + hr * .2)}" rx="${f1(hr * .64)}" ry="${f1(hr * .66)}"/>`;
    const c = hx + v * hr * .3, e = hr * .3; eyes = eyeSVG(f1(c - v * e), f1(ey), er0 * 1.05, s.gaze, s.eyes) + eyeSVG(f1(c + v * e * 1.05), f1(ey), er0 * .85, s.gaze, s.eyes); mx = hx + v * hr * .34;
  }
  mx = f1(mx); my = f1(my); mw = f1(mw);
  const mouth = {
    smile: `<path d="M${mx - mw} ${my}Q${mx} ${f1(my + mw * .9)} ${mx + mw} ${my}" class="inkl" stroke-width="1.3"/>`,
    flat: `<path d="M${f1(mx - mw * .8)} ${my}h${f1(mw * 1.6)}" class="inkl" stroke-width="1.4"/>`,
    o: `<ellipse cx="${mx}" cy="${f1(my + .6)}" rx="${f1(mw * .5)}" ry="${f1(mw * .62)}" class="ink"/>`,
    tongue: `<path d="M${mx - mw} ${my}Q${mx} ${f1(my + mw * .8)} ${mx + mw} ${my}" class="inkl" stroke-width="1.3"/><path d="M${f1(mx + mw * .1)} ${f1(my + mw * .35)}q${f1(mw * .1)} ${f1(mw * 1.1)} ${f1(mw * .8)} ${f1(mw * .9)}q${f1(mw * .6)} -${f1(mw * .4)} ${f1(mw * .2)} -${f1(mw * 1.2)}z" class="tongue"/>`,
    teeth: `<rect x="${f1(mx - mw)}" y="${f1(my - 1.8)}" width="${f1(mw * 2)}" height="4" rx="1" class="page" stroke="var(--screen)" stroke-width=".8"/><path d="M${mx} ${f1(my - 1.8)}v4" stroke="var(--screen)" stroke-width=".7"/>`,
    frown: `<path d="M${mx - mw} ${f1(my + 1.6)}Q${mx} ${f1(my - mw * .7)} ${mx + mw} ${f1(my + 1.6)}" class="inkl" stroke-width="1.3"/>`,
    smirk: `<path d="M${f1(mx - mw)} ${my}Q${f1(mx + mw * .3)} ${f1(my + mw)} ${f1(mx + mw)} ${f1(my - mw * .5)}" class="inkl" stroke-width="1.3"/>`
  }[s.mouth];
  let acc = '';
  const nearX = hx + vv * hr * .72;
  switch (s.head) {
    case 'glassesR': case 'glassesS': {
      const rr = er0 + 2.1, one = prof;
      const pts = prof ? [[hx + v * hr * .5, ey]] : v === 0 ? [[hx - hr * .36, ey], [hx + hr * .36, ey]] : [[hx + v * hr * .3 - v * hr * .3, ey], [hx + v * hr * .3 + v * hr * .315, ey]];
      const sh = p => s.head === 'glassesR' ? `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${f1(rr)}"/>` : `<rect x="${f1(p[0] - rr - .4)}" y="${f1(p[1] - rr)}" width="${f1(2 * rr + .8)}" height="${f1(2 * rr - .6)}" rx="1.6"/>`;
      acc = `<g class="inkl" stroke-width="1.3">${pts.map(sh).join('')}${pts.length > 1 ? `<path d="M${f1(pts[0][0] + rr)} ${f1(ey - .5)}H${f1(pts[1][0] - rr)}"/>` : `<path d="M${f1(pts[0][0] - v * rr)} ${f1(ey - .5)}L${f1(hx - v * hr * .2)} ${f1(ey - 1)}"/>`}</g>`; break;
    }
    case 'bow': acc = `<path d="M${f1(nearX - 1)} ${f1(hy - hr * .92)}l-8 -5v11z M${f1(nearX - 1)} ${f1(hy - hr * .92)}l8 -5v11z" fill="var(--alert)" stroke="var(--edge)" stroke-width="1" stroke-linejoin="round"/><circle cx="${f1(nearX - 1)}" cy="${f1(hy - hr * .92)}" r="2" class="brass"/>`; break;
    case 'phones': acc = `<path d="M${f1(hx - hr - 1)} ${hy}a${hr + 1} ${hr + 3} 0 0 1 ${2 * hr + 2} 0" fill="none" stroke="var(--screen)" stroke-width="2.6"/>` + (prof ? `<rect x="${f1(hx - v * hr * .22 - 3.5)}" y="${f1(hy - 3)}" width="7" height="10" rx="3" fill="var(--concrete)" stroke="var(--edge)" stroke-width=".9"/>` : `<rect x="${f1(hx - hr - 4.5)}" y="${hy - 4}" width="6" height="10" rx="2.6" fill="var(--concrete)" stroke="var(--edge)" stroke-width=".9"/><rect x="${f1(hx + hr - 1.5)}" y="${hy - 4}" width="6" height="10" rx="2.6" fill="var(--concrete)" stroke="var(--edge)" stroke-width=".9"/>`); break;
    case 'visor': acc = `<path d="M${f1(hx - hr - 2)} ${f1(hy - hr * .18)}C${f1(hx - hr * .8)} ${f1(hy - hr * 1.32)} ${f1(hx + hr * .8)} ${f1(hy - hr * 1.32)} ${f1(hx + hr + 2)} ${f1(hy - hr * .18)}L${f1(hx + hr * .84)} ${f1(hy + hr * .04)}Q${hx} ${f1(hy - hr * .56)} ${f1(hx - hr * .84)} ${f1(hy + hr * .04)}Z" fill="color-mix(in srgb, var(--phosphor-green) 52%, var(--screen))" stroke="var(--edge)" stroke-width="1.2" stroke-linejoin="round"/><path d="M${f1(hx - hr * .6)} ${f1(hy - hr * .5)}Q${hx} ${f1(hy - hr * .95)} ${f1(hx + hr * .6)} ${f1(hy - hr * .5)}" fill="none" stroke="var(--glow)" stroke-width="1.1" opacity=".5"/>`; break;
    case 'pencil': acc = `<path d="M${f1(hx - vv * hr * .78)} ${f1(hy - hr * .35)}l${f1(-vv * 4)} -11" stroke="var(--mustard)" stroke-width="3" stroke-linecap="round"/><path d="M${f1(hx - vv * hr * .78 - vv * 4)} ${f1(hy - hr * .35 - 11)}l${f1(-vv * .7)} -2" stroke="var(--screen)" stroke-width="3" stroke-linecap="round"/>`; break;
    case 'swirl': acc = `<path d="M${f1(hx - 3)} ${f1(hy - hr + .5)}q-2 -9 6 -9q6 0 3 5q-2.5 3 -5.4 1" class="furl" style="stroke:var(--edge)" stroke-width="5"/><path d="M${f1(hx - 3)} ${f1(hy - hr + .5)}q-2 -9 6 -9q6 0 3 5q-2.5 3 -5.4 1" class="furl" stroke-width="3"/>`; break;
  }
  return `<g class="eyes" style="transform-origin:${f1(hx)}px ${f1(ey)}px">${eyes}</g>${mouth}${acc}`.replace(/^/, o);
}
const prop = (kind, px, y) => {
  switch (kind) {
    case 0: return `<g><rect x="${px - 4}" y="${y - 8}" width="8" height="8" rx="1" class="page" style="fill:var(--paper-shade)"/><path d="M${px + 4} ${y - 6}h2.6a2.2 2.2 0 0 1 0 4.4h-2.6" class="inkl" stroke-width="1.1"/><path d="M${px - 1} ${y - 10}q1 -2 0 -3.4" class="inkl" stroke-width=".9" opacity=".6"/></g>`;
    case 1: return `<g><polygon points="${px - 4.5},${y - 6} ${px + 4.5},${y - 6} ${px + 3.4},${y} ${px - 3.4},${y}" fill="var(--concrete)" stroke="var(--edge)" stroke-width=".9"/><ellipse class="leaf" cx="${px - 3}" cy="${y - 10}" rx="2.2" ry="5" transform="rotate(-25 ${px - 3} ${y - 7})"/><ellipse class="leaf" cx="${px + 3}" cy="${y - 10}" rx="2.2" ry="5" transform="rotate(25 ${px + 3} ${y - 7})"/><ellipse class="leaf" cx="${px}" cy="${y - 12}" rx="2.2" ry="5"/></g>`;
    case 2: return `<g><rect class="page" x="${px - 7}" y="${y - 2.6}" width="14" height="2.6"/><rect class="page" x="${px - 6}" y="${y - 5.4}" width="14" height="2.6"/><rect class="page" x="${px - 7.5}" y="${y - 8.2}" width="14" height="2.6"/></g>`;
    case 3: return `<g><rect x="${px - 5}" y="${y - 11}" width="10" height="11" fill="var(--walnut)" stroke="var(--edge)" stroke-width=".9"/><rect x="${px - 3.4}" y="${y - 9.4}" width="6.8" height="7.6" fill="var(--mustard)"/><circle cx="${px}" cy="${y - 6.6}" r="1.5" class="ink"/><path d="M${px - 2.6} ${y - 2.6}q2.6 -2.6 5.2 0z" class="ink"/></g>`;
    case 4: return `<g><path d="M${px - 4} ${y}h8M${px} ${y}V${y - 6}L${px + 4} ${y - 11}" class="inkl" stroke-width="1.3"/><path d="M${px + 1} ${y - 10}h8l-2 4.4h-3.6z" fill="var(--mustard)" stroke="var(--edge)" stroke-width=".9"/><circle class="halo" cx="${px + 5}" cy="${y - 4}" r="11"/></g>`;
    default: return `<g><path d="M${px} ${y}V${y - 15}" stroke="var(--screen)" stroke-width="1.1"/><path d="M${px} ${y - 15}l9 3l-9 3z" fill="var(--alert)" stroke="var(--edge)" stroke-width=".8"/></g>`;
  }
};
function torsoPath(sw, hw, ys, yb) {
  const a = sw / 2, b = hw / 2, k = 9;
  return `M${-b} ${yb}C${-b * 1.12} ${f1(yb - 16)} ${-a * 1.12} ${f1(ys + 18)} ${-a} ${ys + k}Q${-a} ${ys} ${f1(-a + k)} ${ys}H${f1(a - k)}Q${a} ${ys} ${a} ${ys + k}C${f1(a * 1.12)} ${f1(ys + 18)} ${f1(b * 1.12)} ${f1(yb - 16)} ${b} ${yb}Z`;
}
function chairSVG(kind, bw) {
  const w = bw + 12;
  if (kind === 'round') return `<ellipse class="chair" cx="0" cy="-56" rx="${w / 2}" ry="19"/>`;
  if (kind === 'short') return `<rect class="chair" x="${-w / 2}" y="-52" width="${w}" height="26" rx="8"/>`;
  return `<rect class="chair" x="${-w / 2}" y="-78" width="${w}" height="52" rx="7"/><rect x="${-w / 2 + 4}" y="-74" width="${w - 8}" height="5" rx="2.4" fill="var(--edge)" opacity=".35"/>`;
}
function tailSVG(kind, bw, lean) {
  const x = bw / 2 + 5;
  const d = { curl: `M${x} -34c13 2 17 -10 10 -20c-5 -7 -12 -3 -9 3`, up: `M${x} -34c16 -4 20 -22 14 -36`, hang: `M${x} -34c12 6 16 14 12 24`, none: '' }[kind];
  return d ? `<path class="furl tail-o" d="${d}" style="stroke:var(--edge);stroke-width:6"/><path class="furl" d="${d}" stroke-width="3.6"/>` : '';
}

/* seated monkey + desk. all authored in local coords, then placed with one translate */
export function seatSVG(i, cx, yb, o = {}) {
  const s = Object.assign({}, CAST[i] || gen(i), o.over || {});
  const hr = s.hr, ys0 = -37 - s.H + hr * 1.9, dw = o.dw || 64, hw2 = dw / 2;
  const v = { f: 0, l: -1, r: 1, pl: -1, pr: 1 }[s.view];
  const lean = s.lean || 0, fwd = s.fwd || 0;
  const pivot = [0, -30];
  const hx = (v ? v * fwd : 0) + 0, hy = -37 - s.H + hr + fwd * .7;
  const ys = hy + hr * .92;
  const sw = s.bw, hwid = s.bw * s.tw;
  const sh0 = [[-(sw / 2 - 2), ys + 8], [sw / 2 - 2, ys + 8]].map(p => rot(p, lean, pivot));
  const hxL = -8, hxR = 8, hyH = -31;
  const L = sh0[0], R = sh0[1];
  let hL = [hxL, hyH], hRt = [hxR, hyH];
  const mouthPt = rot([hx + (v ? v * hr * .5 : 0), hy + hr * .7], lean, pivot);
  const armLen = Math.hypot(mouthPt[0] - R[0], mouthPt[1] - R[1]);
  let sa = 0;
  if (s.beh === 'sip') {
    const ang = Math.atan2(hyH - R[1] - 1, 18 - R[0]);
    hRt = [R[0] + armLen * Math.cos(ang) * 1, R[1] + armLen * Math.sin(ang)];
    // rotate the arm so the mug reaches the mouth
    const a1 = Math.atan2(hRt[1] - R[1], hRt[0] - R[0]), a2 = Math.atan2(mouthPt[1] - R[1], mouthPt[0] - R[0]);
    sa = Math.round(((a2 - a1) * 180 / Math.PI + 540) % 360 - 180);
  }
  if (s.beh === 'sharpen') hL = [-19, -32];
  let page = '';
  if (s.beh === 'read') {
    const px = hx + (v || s.ps) * (hr * 1.3 + 6), py = hy + hr * .35, ph = 24;
    hL = [px - 6, py + ph - 1]; hRt = [px + 6, py + ph - 1];
    page = `<g class="rpage" style="transform-origin:${f1(px)}px ${f1(py + 12)}px"><rect class="page" x="${f1(px - 11)}" y="${f1(py)}" width="22" height="${ph}" rx="1"/><path d="M${f1(px - 7)} ${f1(py + 5)}h14M${f1(px - 7)} ${f1(py + 9)}h14M${f1(px - 7)} ${f1(py + 13)}h14M${f1(px - 7)} ${f1(py + 17)}h9" stroke="var(--concrete)" stroke-width="1"/></g>`;
  }
  if (s.beh === 'stamp') { hRt = [hxR + 14, -32]; hL = [-10, -30]; }
  const bodyAcc = {
    cardigan: `<path d="M${-hwid / 2} ${f1(ys + 18)}L${f1(-sw * .28)} ${f1(ys + 4)}L${f1(-sw * .06)} ${f1(ys + 18)}V${f1(ys + 52)}H${-hwid / 2 - 2}z M${hwid / 2} ${f1(ys + 18)}L${f1(sw * .28)} ${f1(ys + 4)}L${f1(sw * .06)} ${f1(ys + 18)}V${f1(ys + 52)}H${hwid / 2 + 2}z" fill="var(--olive)" stroke="var(--edge)" stroke-width="1" stroke-linejoin="round"/><circle cx="${f1(-sw * .02)}" cy="${f1(ys + 22)}" r="1.4" class="brass"/><circle cx="${f1(-sw * .02)}" cy="${f1(ys + 30)}" r="1.4" class="brass"/>`,
    braces: `<path d="M${f1(-sw * .2)} ${ys + 1}V${f1(ys + 40)}M${f1(sw * .2)} ${ys + 1}V${f1(ys + 40)}" stroke="var(--edge)" stroke-width="6.2"/><path d="M${f1(-sw * .2)} ${ys + 1}V${f1(ys + 40)}M${f1(sw * .2)} ${ys + 1}V${f1(ys + 40)}" stroke="var(--mustard)" stroke-width="3.6"/><circle cx="${f1(-sw * .2)}" cy="${f1(ys + 30)}" r="1.5" class="brass"/><circle cx="${f1(sw * .2)}" cy="${f1(ys + 30)}" r="1.5" class="brass"/><path d="M-6 ${ys + 5}h12" stroke="var(--alert)" stroke-width="1.6"/>`,
    tie: `<path d="M-2.4 ${ys + 3}h4.8l2 20l-4.4 5l-4.4 -5z" fill="var(--alert)" stroke="var(--edge)" stroke-width=".9" stroke-linejoin="round"/>`,
    bowtie: `<path d="M0 ${ys + 5}l-7 -3.4v7z M0 ${ys + 5}l7 -3.4v7z" fill="var(--mustard)" stroke="var(--screen)" stroke-width=".9" stroke-linejoin="round"/>`,
    lanyard: `<path d="M${f1(-sw * .26)} ${ys + 1}L0 ${f1(ys + 22)}L${f1(sw * .26)} ${ys + 1}" fill="none" stroke="var(--alert)" stroke-width="1.6"/><rect x="-5" y="${f1(ys + 20)}" width="10" height="13" rx="1.4" class="page"/><circle cx="0" cy="${f1(ys + 25)}" r="2.2" class="ink"/>`, none: ''
  }[s.body];
  const sleeveC = s.body === 'cardigan' ? 'style="stroke:var(--olive)"' : '';
  const arm = (cls, S, H2, extra = '') => `<g class="${cls}" style="transform-origin:${f1(S[0])}px ${f1(S[1])}px">${s.shirt === 'sk-paper' && s.body !== 'cardigan' ? `<line class="sleeve-o" x1="${f1(S[0])}" y1="${f1(S[1])}" x2="${f1(H2[0])}" y2="${f1(H2[1] - 1)}"/>` : ''}<line class="sleeve" ${sleeveC} x1="${f1(S[0])}" y1="${f1(S[1])}" x2="${f1(H2[0])}" y2="${f1(H2[1] - 1)}"/>${extra}<circle class="hand" cx="${f1(H2[0])}" cy="${f1(H2[1])}" r="3.6"/></g>`;
  const mug = s.beh === 'sip' ? `<g class="mug" style="transform-origin:${f1(hRt[0])}px ${f1(hRt[1])}px"><rect x="${f1(hRt[0] - 4)}" y="${f1(hRt[1] - 9)}" width="8" height="9" rx="1" fill="var(--edge)" stroke="var(--screen)" stroke-width=".9"/><path d="M${f1(hRt[0] + 4)} ${f1(hRt[1] - 7)}h2.4a2.2 2.2 0 0 1 0 4.4h-2.4" class="inkl" stroke-width="1.1"/></g>` : '';
  const stamper = s.beh === 'stamp' ? `<g class="stampT"><rect x="${f1(hRt[0] - 1.6)}" y="${f1(hRt[1] - 20)}" width="3.2" height="13" fill="var(--walnut)" stroke="var(--edge)" stroke-width=".8"/><rect x="${f1(hRt[0] - 8)}" y="${f1(hRt[1] - 9)}" width="16" height="8" rx="1.5" fill="var(--screen)" stroke="var(--edge)" stroke-width=".9"/></g>` : '';
  const armR = arm('armR', R, hRt, mug), armL = arm('armL', L, hL);
  const pside = (s.beh === 'sip' || s.beh === 'slam') ? -1 : s.beh === 'sharpen' ? 1 : s.ps;
  const propX = pside * (hw2 - 9);
  const writing = s.beh === 'sharpen' ? `<g><rect x="-30" y="-37" width="12" height="9" rx="1" fill="var(--concrete)" stroke="var(--edge)" stroke-width=".9"/><g class="cr" style="transform-origin:-24px -33px"><circle cx="-24" cy="-33" r="2.6" class="brass"/><path d="M-24 -33h4.4" class="inkl" stroke-width="1.1"/></g></g>` : '';
  const tw = s.beh === 'stamp'
    ? `<rect class="page" x="-${hw2 - 8}" y="-36" width="24" height="11"/><rect class="mark" x="-${hw2 - 11}" y="-34" width="18" height="7" fill="none" stroke="var(--alert)" stroke-width="1.6"/>`
    : `<rect class="tsheet page" x="-6.5" y="-46" width="13" height="10"/><rect x="-11" y="-37" width="22" height="9" rx="1.5" fill="var(--concrete)" stroke="var(--edge)" stroke-width="1"/><path d="M-8 -32h16" stroke="var(--screen)" stroke-width="1.3" stroke-dasharray="1.7 1.3"/>`;
  // ready desk: blotter, pen stand, a real empty chair with a cushion, and a mustard VACANT tent card
  const vchair = `<g class="vx"><rect x="${-(sw + 12) / 2 - 5}" y="-68" width="7" height="24" rx="3" fill="var(--olive)" stroke="var(--edge)" stroke-width="1.3"/><rect x="${(sw + 12) / 2 - 2}" y="-68" width="7" height="24" rx="3" fill="var(--olive)" stroke="var(--edge)" stroke-width="1.3"/>` +
    `<rect x="${-(sw + 12) / 2 + 1}" y="-96" width="${sw + 10}" height="52" rx="9" fill="color-mix(in srgb, var(--olive) 80%, var(--edge))" stroke="var(--edge)" stroke-width="1.5"/><rect x="${-(sw + 12) / 2 + 6}" y="-90" width="${sw}" height="12" rx="5" fill="color-mix(in srgb, var(--olive) 55%, var(--edge))" opacity=".7"/>` +
    `<circle cx="-8" cy="-77" r="1.6" class="brass"/><circle cx="8" cy="-77" r="1.6" class="brass"/><circle cx="0" cy="-67" r="1.6" class="brass"/>` +
    `<rect x="${-(sw + 12) / 2 - 2}" y="-60" width="${sw + 16}" height="21" rx="9" fill="color-mix(in srgb, var(--tangerine) 62%, var(--edge))" stroke="var(--edge)" stroke-width="1.5"/><path d="M${-(sw + 12) / 2 + 5} -55H${(sw + 12) / 2 + 7}" stroke="var(--edge)" stroke-width="1.6" stroke-linecap="round" opacity=".8"/><circle cx="3" cy="-49" r="1.8" fill="var(--walnut)" stroke="var(--edge)" stroke-width=".8"/></g>`;
  const vdesk = `<g class="vx"><rect x="-27" y="-35" width="54" height="9" rx="1" fill="color-mix(in srgb, var(--olive) 70%, var(--screen))" stroke="var(--edge)" stroke-width="1"/><path d="M-27 -30h6l-6 4zM27 -30h-6l6 4z" fill="var(--mustard)" opacity=".9"/>` +
    `<rect x="-21" y="-36" width="16" height="8" rx="1" class="page"/><path d="M-19 -34h10M-19 -31.5h7" stroke="var(--concrete)" stroke-width=".7"/>` +
    `<rect x="-24" y="-42" width="5" height="7" rx="1" fill="var(--concrete)" stroke="var(--edge)" stroke-width=".8"/><path d="M-22.5 -42l.6 -5M-20.8 -42l-.6 -4" stroke="var(--alert)" stroke-width="1" stroke-linecap="round"/>` +
    `<path d="M-8 -27L-5 -41H29L32 -27Z" fill="var(--mustard)" stroke="var(--edge)" stroke-width="1.4" stroke-linejoin="round"/><path d="M-5 -41H29L27 -44H-3Z" fill="color-mix(in srgb, var(--mustard) 62%, var(--edge))" stroke="var(--edge)" stroke-width="1.2" stroke-linejoin="round"/><text x="12" y="-31.4" class="sg sm" style="font-size:8px;letter-spacing:.06em">Vacant</text></g>`;
  const zzx = hx + hr + 4;
  const mk = `<g class="mk"><g transform="rotate(${lean} 0 -30)"><path class="shirt" d="${torsoPath(sw, hwid, ys, -28)}"/>${bodyAcc}<g class="head" style="transform-origin:${f1(hx)}px ${f1(ys + 2)}px">${headSVG(s, hx, hy, hr)}<text class="zz" x="${f1(zzx)}" y="${f1(hy - hr + 2)}" aria-hidden="true">z</text></g></g></g>`;
  // desk
  const d = 11, dh = 26;
  const desk = `<polygon class="shl" points="${-hw2},0 ${hw2},0 ${hw2 + 30},12 ${-hw2 + 6},12"/><polygon class="shc" points="${-hw2},0 ${hw2},0 ${hw2 + 3},4 ${-hw2 + 3},4"/>` +
    `<polygon class="tb" points="${-hw2 + 6},-1 ${-hw2 + 18},-1 ${-hw2 + 21},6 ${-hw2 + 3},6"/><polygon class="tb" points="${hw2 - 18},-1 ${hw2 - 6},-1 ${hw2 - 3},6 ${hw2 - 21},6"/>` +
    `<rect class="fr c-walnut" x="${-hw2}" y="${-dh}" width="${dw}" height="${dh}" rx="1.5"/><path class="rim" d="M${-hw2 + 1.5} -1V${-dh + 1.5}H${hw2 - 1.5}"/>` +
    `<polygon class="tp c-walnut" points="${-hw2 + 3},${-dh - d} ${hw2 - 3},${-dh - d} ${hw2},${-dh} ${-hw2},${-dh}"/><rect x="-5" y="-15" width="10" height="3" rx="1.2" class="brass"/>`;
  const aa = o.arrive ? ' arrive' : '';
  const flags = `${s.beh === 'sip' ? `--sa:${sa}deg;` : ''}`;
  const cls = `up seat b-${s.beh} f${s.fur} ${s.shirt}${s.gaze && s.beh !== 'read' && s.beh !== 'doze' && (hash(i) % 2) ? ' g-glance' : ''}${o.vacant ? ' vacant' : ''}${aa}`;
  const bpx = mouthPt;
  return `<g transform="translate(${cx} ${yb})"><g class="${cls}" data-i="${i}" style="transform-origin:0px 0px;--t:${(.85 + (hash(i + 5) % 30) / 100).toFixed(2)};--d:-${((hash(i + 9) % 40) / 10).toFixed(1)}s;${flags}">` +
    `<g class="tail">${tailSVG(s.tail, sw, lean)}</g><g class="chr">${chairSVG(s.chair, sw)}</g>${o.vacant ? vchair : ''}${mk}${desk}<g class="tw">${tw}${writing}</g>${o.vacant ? vdesk : ''}<g class="prp">${prop(s.prop, propX, -30)}</g>${page}<g class="hands">${armL}${armR}${stamper}</g></g></g>`;
}

/* standing monkey (aisle life): ground at 0,0 */
export function stand(s, pose = {}) {
  const hr = s.hr || 11, H = s.H || 66, legH = 22;
  const hy = -(H - hr), ys = hy + hr * .92, sw = s.bw || 22, hwid = sw * (s.tw || 1);
  const v = { f: 0, l: -1, r: 1, pl: -1, pr: 1 }[s.view || 'pr'];
  const L = [-(sw / 2 - 2), ys + 8], R = [sw / 2 - 2, ys + 8];
  const hl = pose.hl || [-7, -legH - 6], hrt = pose.hr || [7, -legH - 6];
  const arm = (cls, S, Hd, ex = '') => `<g class="${cls}" style="transform-origin:${f1(S[0])}px ${f1(S[1])}px">${s.shirt === 'sk-paper' ? `<line class="sleeve-o" x1="${f1(S[0])}" y1="${f1(S[1])}" x2="${f1(Hd[0])}" y2="${f1(Hd[1] - 1)}"/>` : ''}<line class="sleeve" x1="${f1(S[0])}" y1="${f1(S[1])}" x2="${f1(Hd[0])}" y2="${f1(Hd[1] - 1)}"/>${ex}<circle class="hand" cx="${f1(Hd[0])}" cy="${f1(Hd[1])}" r="3.6"/></g>`;
  const legs = `<rect class="fur" x="${-hwid / 2 + 2}" y="${-legH}" width="8" height="${legH}" rx="3"/><rect class="fur" x="${hwid / 2 - 10}" y="${-legH}" width="8" height="${legH}" rx="3"/><ellipse class="fur" cx="${-hwid / 2 + 8}" cy="-1" rx="7" ry="3.6"/><ellipse class="fur" cx="${hwid / 2 - 4}" cy="-1" rx="7" ry="3.6"/>`;
  const tail = s.tail ? `<path class="furl" d="M${-v * (sw / 2) || -sw / 2} ${-legH - 6}c${-v * 14 || -14} 4 ${-v * 18 || -18} -8 ${-v * 12 || -12} -18" style="stroke:var(--edge);stroke-width:6"/><path class="furl" d="M${-v * (sw / 2) || -sw / 2} ${-legH - 6}c${-v * 14 || -14} 4 ${-v * 18 || -18} -8 ${-v * 12 || -12} -18" stroke-width="3.6"/>` : '';
  return `<g class="f${s.fur} ${s.shirt || 'sk-paper'}"><polygon class="shl" points="${-12},0 12,0 40,9 14,9"/><polygon class="shc" points="-12,0 12,0 14,3 -10,3"/>${tail}${legs}<path class="shirt" d="${torsoPath(sw, hwid, ys, -legH + 4)}"/>${pose.body || ''}${arm('armL', L, hl, pose.xl || '')}${headBlock(s, hy, hr)}${arm('armR', R, hrt, pose.xr || '')}${pose.front || ''}</g>`;
}
const headBlock = (s, hy, hr) => `<g class="head">${headSVG(Object.assign({ eyes: 'open', mouth: 'smile', gaze: [0, 0], ears: 'round', head: 'none', view: 'pr' }, s), 0, hy, hr)}</g>`;

/* ===== editor, candidate ===== */
export const EDITOR = { fur: 5, H: 58, bw: 52, tw: 1.02, hr: 16, ears: 'small', lean: 3, fwd: 5, view: 'f', gaze: [0, .9], eyes: 'open', mouth: 'flat', head: 'visor', body: 'braces', tail: 'none', prop: 2, ps: 1, beh: 'stamp', shirt: 'sk-ink', chair: 'round', flange: true };
export const CANDIDATE = { fur: 4, H: 56, bw: 24, tw: 1.1, hr: 12, ears: 'big', view: 'pl', gaze: [-1, -.7], eyes: 'wide', mouth: 'o', head: 'none', tail: true, shirt: 'sk-rust' };


/* =====================================================================================
   THE FLOOR AS A FUNCTION OF STATE
   buildFloor(props) is pure: same props, same markup. It touches no DOM and no globals
   except the parts kit above. The game calls it, compares `key` with the last one, and only
   when it differs replaces the world's innerHTML.
   ===================================================================================== */
export const CAP = 12;                      // desks drawn in the Typing Pool (4 x 3); past this a brass placard carries the true count
const ED_CAP = 2;                    // editors drawn besides the Editor-in-Chief
const POOL_DY = 264;                 // the pool's group is translated down by this
const PERS_DY = 234;                 // Personnel, the entrance and the shredder station are translated down by this
const POOL_G = { xs: [273, 351, 429, 507], rows: [610, 715, 820], edRow: 925, edXs: [506, 388, 270], edDw: 84 };
const TIER_IDS = ['letters', 'words', 'phrases', 'sentences'];
const TIER_NAMES = { letters: 'Letters', words: 'Words', phrases: 'Phrases', sentences: 'Sentences' };
const DEPT_IDS = ['recruiting', 'construction', 'editing'];
// What each room's full-width scene shows: [x, y, w, h] in the room art's own coordinates.
const ROOM_VIEWS = {
  personnel: [204, 1342, 400, 308],
  pool: [214, 706, 352, 282],
  departments: [60, 140, 260, 184],
  research: [246, 424, 288, 208],
  director: [462, 140, 260, 184]
};

// every drawing cap is applied here, once; the renderer reads only this, and `key` is this object
export function normalize(p) {
  const seated = Math.max(0, Math.floor(p.seated || 0)), desks = Math.max(seated, Math.floor(p.desks || 0));
  const tierState = id => { const t = (p.tiers || []).find(x => x.id === id); return t && ['researching', 'discovered'].includes(t.state) ? t.state : 'locked'; };
  const dept = id => { const d = (p.depts || {})[id] || {}; return [Math.min(5, Math.max(0, Math.floor(d.level || 0))), Math.min(4, Math.max(1, Math.floor(d.stage || 1)))]; };
  const ms = new Set(p.milestones || []);
  const e = Math.max(0, Math.floor(p.editors || 0));
  return {
    seated: Math.min(seated, CAP), desks: Math.min(desks, CAP), crowd: seated > CAP ? 1 : 0,
    candidate: p.candidate ? 1 : 0, editors: Math.min(ED_CAP, e < 1 ? 0 : e < 4 ? 1 : 2),
    tiers: TIER_IDS.map(id => tierState(id)),
    depts: DEPT_IDS.map(dept),
    office: ms.has('office') ? 1 : 0, building: ms.has('building') ? 1 : 0, tall: ms.has('tall') ? 1 : 0,
    permit: p.permit ? 1 : 0, tutorial: p.tutorial ? 1 : 0
  };
}
const headcountText = n => `${Math.max(0, Math.floor(n)).toLocaleString('en-US')} seated`;

/* ----- small pieces ----- */
// where a desk will go: chalk outline plus corner tape
export function deskMark(cx, yb, dw, faint, label) {
  const x0 = cx - dw / 2 - 2, x1 = cx + dw / 2 + 2, y0 = yb - 30, y1 = yb + 8, k = 9;
  const c = [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]].map(([x, y, a, b]) => `M${x + a * k} ${y}H${x}V${y + b * k}`).join('');
  return `<g class="dmark${faint ? ' faint' : ''}"><rect class="chalk" x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" rx="3"/><path class="tapec" d="${c}"/>` +
    (label ? `<rect x="${cx - 20}" y="${yb - 20}" width="40" height="12" rx="1.5" class="tape"/><text class="dtag" x="${cx}" y="${yb - 11}">${label}</text>` : `<path d="M${cx - 4} ${yb - 12}h8M${cx} ${yb - 16}v8" stroke="var(--edge)" stroke-width="1.6" opacity=".5"/>`) + `</g>`;
}
export const stagePlate = (cx, y, stage) => {
  let lamps = '';
  for (let k = 0; k < 4; k++) lamps += `<circle cx="${cx - 15 + k * 10}" cy="${y - 5}" r="3.1" fill="${k < stage ? 'var(--tangerine)' : 'var(--paper-shade)'}" stroke="var(--screen)" stroke-width=".9"/>`;
  return `<g>${lamps}<rect class="brass" x="${cx - 33}" y="${y}" width="66" height="13" rx="2"/><text class="sg sm" x="${cx}" y="${y + 9.6}" style="font-size:8.2px;letter-spacing:.05em">Stage ${stage} of 4</text></g>`;
};
export const drawers = (x, y0, w, n, rh, hasLabel = true) => Array.from({ length: n }, (_, k) => {
  const y = y0 + k * rh;
  return `<rect x="${x + 5}" y="${y}" width="${w - 10}" height="${rh - 3}" rx="1.2" fill="none" stroke="var(--edge)" stroke-width="1"/><rect x="${x + w / 2 - 9}" y="${y + 4}" width="18" height="6" rx="1.6" class="brass"/>` + (hasLabel ? `<rect x="${x + w / 2 - 5}" y="${y + 12}" width="10" height="2.4" rx="1.2" class="ink" opacity=".4"/>` : '');
}).join('');

/* ----- the back wall: windows (closed until 'office'), elevator (barrier until 'building'), sky (changes at 'tall') ----- */
/* ----- Departments: cabinets grow with level, a plate and four lamps show the stage ----- */
function departmentsSVG(n) {
  const [[lr, sr], [lc, sc], [le, se]] = n.depts, yb = 314;
  // Recruiting: a filing cabinet that gains drawers, with a pile of applications on top
  const rA = 2 + Math.min(lr, 3), hA = 14 + rA * 20;
  const pile = Array.from({ length: Math.min(lr + 1, 6) }, (_, k) => `<rect class="page" x="${52 + (k % 2) * 3}" y="${yb - hA - 9 - k * 3.4}" width="32" height="4" rx=".8"/>`).join('');
  const flag = lr > 0 ? `<path d="M88 ${yb - hA - 12}v-18" stroke="var(--screen)" stroke-width="1.4"/><path d="M88 ${yb - hA - 30}l11 4l-11 4z" fill="var(--alert)" stroke="var(--edge)" stroke-width=".8"/>` : '';
  let s = pbox({ x: 40, yb, w: 60, h: hA, d: 11, c: 'steel', extra: drawers(40, yb - hA + 8, 60, rA, 20) + pile + flag });
  // Construction: a wide plan chest with rolled blueprints and a hard hat
  const rB = 1 + Math.min(lc, 2), hB = 12 + rB * 19;
  const rolls = Array.from({ length: Math.min(lc + 1, 5) }, (_, k) => `<rect x="${128 + (k % 2) * 7}" y="${yb - hB - 10 - k * 6.4}" width="38" height="7" rx="3.5" fill="var(--edge)" stroke="var(--concrete)" stroke-width="1"/><rect x="${146 + (k % 2) * 7}" y="${yb - hB - 10 - k * 6.4}" width="4" height="7" fill="var(--tangerine)"/>`).join('');
  const hat = lc > 0 ? `<path d="M176 ${yb - hB - 9}a15 13 0 0 1 30 0z" fill="var(--mustard)" stroke="var(--edge)" stroke-width="1.3"/><rect x="173" y="${yb - hB - 10}" width="36" height="3.6" rx="1.6" fill="var(--mustard)" stroke="var(--edge)" stroke-width="1.2"/>` : '';
  s += pbox({ x: 116, yb, w: 92, h: hB, d: 11, c: 'steel', extra: Array.from({ length: rB }, (_, k) => `<rect x="122" y="${yb - hB + 7 + k * 19}" width="38" height="16" rx="1.2" fill="none" stroke="var(--edge)" stroke-width="1"/><rect x="164" y="${yb - hB + 7 + k * 19}" width="38" height="16" rx="1.2" fill="none" stroke="var(--edge)" stroke-width="1"/><rect x="132" y="${yb - hB + 12 + k * 19}" width="18" height="5.6" rx="1.6" class="brass"/><rect x="174" y="${yb - hB + 12 + k * 19}" width="18" height="5.6" rx="1.6" class="brass"/>`).join('') + rolls + hat });
  // Editing: a tall cabinet with a cup of red pens, and a stack of marked proofs
  const rC = 2 + Math.min(le, 3), hC = 14 + rC * 20;
  const proofs = Array.from({ length: Math.min(le + 1, 5) }, (_, k) => `<rect class="page" x="${252 + (k % 2) * 2}" y="${yb - hC - 9 - k * 3.6}" width="26" height="4" rx=".8"/><path d="M${256 + (k % 2) * 2} ${yb - hC - 7 - k * 3.6}h10" stroke="var(--alert)" stroke-width="1.2"/>`).join('');
  s += pbox({ x: 222, yb, w: 62, h: hC, d: 11, c: 'steel', extra: drawers(222, yb - hC + 8, 62, rC, 20) +
    `<rect x="230" y="${yb - hC - 22}" width="20" height="18" rx="2" fill="var(--edge)" stroke="var(--screen)" stroke-width="1"/><path d="M235 ${yb - hC - 22}l-3 -13M241 ${yb - hC - 22}l1 -16M247 ${yb - hC - 22}l5 -12" stroke="var(--alert)" stroke-width="2.4" stroke-linecap="round"/><path d="M234 ${yb - hC - 13}h12" stroke="var(--alert)" stroke-width="1.4"/>` + proofs });
  s += stagePlate(70, 320, sr) + stagePlate(162, 320, sc) + stagePlate(253, 320, se);
  return `<g class="zone area" id="z-departments" transform="translate(43.6 18) scale(.88)">` + padSVG(30, 150, 270, 185, 't-dp') + sign(165, 160, 112, 20, 'Departments', 0) + lamp(40, 208, 0) + lamp(292, 200, -1.7) + s + `<rect class="ring" x="28" y="148" width="274" height="189" rx="8"/></g>`;
}

/* ----- Director's Office: a folder waits for the stamp; once the Permit is stamped it stands on the desk ----- */
function directorSVG(n) {
  const ox = 520, ow = 196, oyb = 322, oh = 82;
  let s = `<g class="zone area" id="z-director" transform="translate(49.6 18) scale(.88)">` + padSVG(480, 150, 270, 185, 't-dr');
  s += sign(615, 160, 112, 20, 'Director', 1.3) + lamp(500, 224, -.9) + lamp(738, 224, -2.4);
  // before the Permit: a glowing wall panel and a blank folder under a waiting stamp. After: a framed Permit on the wall (red double-ruled stamp, ribbon, brass seal) and the folder is stamped
  const panel = n.permit
    ? `<rect x="${ox + 136}" y="${oyb - 80}" width="46" height="40" fill="var(--mustard)" stroke="var(--edge)" stroke-width="1.6"/><rect x="${ox + 140}" y="${oyb - 76}" width="38" height="32" fill="var(--edge)" stroke="var(--screen)" stroke-width="1"/>` +
      `<path d="M${ox + 144} ${oyb - 71}h30M${ox + 144} ${oyb - 67}h30" stroke="var(--concrete)" stroke-width="1.2"/><g transform="rotate(-9 ${ox + 159} ${oyb - 57})"><rect class="stampd" x="${ox + 145}" y="${oyb - 63}" width="28" height="12" style="stroke-width:1.7"/><text class="stampt" x="${ox + 159}" y="${oyb - 54}" style="font-size:8px">PERMIT</text></g>` +
      `<path d="M${ox + 164} ${oyb - 42}l-5 10l5 -3l5 3z" fill="var(--alert)" stroke="var(--edge)" stroke-width=".8"/><circle cx="${ox + 164}" cy="${oyb - 45}" r="5" class="brass"/>`
    : `<polygon points="${ox + 136},${oyb - 74} ${ox + 184},${oyb - 74} ${ox + 180},${oyb - 40} ${ox + 140},${oyb - 40}" fill="var(--glow)" stroke="var(--edge)" stroke-width="1.2"/>`;
  const permit = `<rect x="${ox + 126}" y="${oyb - 44}" width="26" height="9" fill="var(--mustard)" stroke="var(--edge)" stroke-width="1"/>` + (n.permit
    ? `<rect class="stampd" x="${ox + 130}" y="${oyb - 43}" width="18" height="6.4" style="stroke-width:1.3"/><g><rect x="${ox + 108}" y="${oyb - 44}" width="3" height="10" fill="var(--walnut)" stroke="var(--edge)" stroke-width=".7"/><rect x="${ox + 101}" y="${oyb - 36}" width="16" height="5" rx="1.4" class="ink"/></g>`
    : `<path d="M${ox + 132} ${oyb - 40}h14" stroke="var(--screen)" stroke-width="1" stroke-dasharray="2 2" opacity=".6"/><g><rect x="${ox + 137}" y="${oyb - 58}" width="3" height="12" fill="var(--walnut)" stroke="var(--edge)" stroke-width=".7"/><rect x="${ox + 130}" y="${oyb - 48}" width="16" height="7" rx="1.4" class="ink"/></g>`);
  s += `<g class="up" style="transform-origin:${ox + ow / 2}px ${oyb}px"><polygon class="shl" points="${ox},${oyb} ${ox + ow},${oyb} ${ox + ow + 30},${oyb + 16} ${ox + 28},${oyb + 16}"/><polygon class="shc" points="${ox},${oyb} ${ox + ow},${oyb} ${ox + ow + 3},${oyb + 4} ${ox + 3},${oyb + 4}"/>` +
    `<rect x="${ox}" y="${oyb - oh}" width="${ow}" height="${oh}" fill="color-mix(in srgb, var(--walnut) 20%, var(--glow))" stroke="var(--edge)" stroke-width="1.7"/>` +
    panel +
    `<rect x="${ox + 10}" y="${oyb - 72}" width="38" height="30" fill="var(--edge)" stroke="var(--edge)" stroke-width="1.2"/><path d="M${ox + 15} ${oyb - 64}h28M${ox + 15} ${oyb - 59}h28M${ox + 15} ${oyb - 54}h14" stroke="var(--concrete)" stroke-width="1.1"/><rect x="${ox + 34}" y="${oyb - 52}" width="10" height="6" fill="none" stroke="var(--alert)" stroke-width="1.4"/>` +
    `<g class="dsil" style="transform-origin:${ox + 96}px ${oyb - 22}px"><rect class="sil" x="${ox + 82}" y="${oyb - 62}" width="30" height="44" rx="12"/><circle class="sil" cx="${ox + 97}" cy="${oyb - 62}" r="13"/><circle class="sil" cx="${ox + 82}" cy="${oyb - 63}" r="5.4"/><circle class="sil" cx="${ox + 112}" cy="${oyb - 63}" r="5.4"/><path d="M${ox + 108} ${oyb - 40}L${ox + 124} ${oyb - 32}" stroke="var(--screen)" stroke-width="7" stroke-linecap="round" opacity=".78"/></g>` +
    `<rect class="fr c-walnut" x="${ox + 30}" y="${oyb - 26}" width="132" height="22" rx="1.5"/><polygon class="tp c-walnut" points="${ox + 34},${oyb - 38} ${ox + 158},${oyb - 38} ${ox + 162},${oyb - 26} ${ox + 30},${oyb - 26}"/><rect x="${ox + 86}" y="${oyb - 20}" width="20" height="3.4" rx="1.2" class="brass"/><rect x="${ox + 38}" y="${oyb - 20}" width="30" height="12" fill="none" stroke="var(--edge)" stroke-width="1"/>` +
    permit +
    `<path d="M${ox + 48} ${oyb - 38}l8 -14l10 -4" class="inkl" stroke-width="1.8"/><path d="M${ox + 62} ${oyb - 58}h13l-3 7h-8z" fill="var(--mustard)" stroke="var(--edge)" stroke-width="1"/><circle class="halo" cx="${ox + 70}" cy="${oyb - 50}" r="22"/><rect x="${ox + 96}" y="${oyb - 42}" width="22" height="4" fill="var(--edge)" stroke="var(--screen)" stroke-width=".7"/></g>`;
  s += `<g class="up" style="transform-origin:${ox + ow / 2}px ${oyb}px">` +
    `<rect class="glass-f" x="${ox}" y="${oyb - oh}" width="30" height="${oh + 3}"/><rect class="glass-f" x="${ox + 134}" y="${oyb - oh}" width="${ow - 134}" height="${oh + 3}"/>` +
    `<path d="M${ox + 6} ${oyb - 6}l18 -50M${ox + 144} ${oyb - 6}l18 -50" stroke="var(--edge)" stroke-width="3" opacity=".5"/>` +
    `<path d="M${ox + 134} ${oyb + 3}V${oyb - oh}" stroke="var(--mustard)" stroke-width="2.2"/>` +
    `<polygon class="glass-t" points="${ox + 8},${oyb - oh - 8} ${ox + ow - 8},${oyb - oh - 8} ${ox + ow},${oyb - oh} ${ox},${oyb - oh}"/>` +
    `<polygon class="glass-f" points="${ox + 30},${oyb + 3} ${ox + 48},${oyb + 11} ${ox + 48},${oyb + 11 - oh + 6} ${ox + 30},${oyb - oh}" style="fill:color-mix(in srgb, var(--glow) 18%, transparent)"/><circle cx="${ox + 42}" cy="${oyb - 34}" r="2.2" class="brass"/></g>`;
  return s + `<rect class="ring" x="478" y="148" width="274" height="189" rx="8"/></g>`;
}

/* ----- Records Library: shelves of bound volumes, a card catalogue, a reading lamp, a librarian, and the lectern where tiers are researched ----- */
const SPINES = ['var(--alert)', 'var(--mustard)', 'var(--olive)', 'var(--tangerine)', 'var(--edge)', 'var(--concrete)', 'color-mix(in srgb, var(--walnut) 55%, var(--screen))', 'color-mix(in srgb, var(--olive) 50%, var(--alert))'];
export function shelfBooks(x, yb, w, seed, hmax) {
  let o = '', cx = x + 5, k = 0;
  while (cx < x + w - 10) {
    const bw = 5 + hash(seed + k * 7) % 4, bh = hmax - 3 - hash(seed + k * 13) % 9, lean = k % 6 === 4;
    o += `<rect x="${cx}" y="${yb - bh}" width="${bw}" height="${bh}" fill="${SPINES[hash(seed + k * 3) % SPINES.length]}" stroke="var(--screen)" stroke-width=".7"${lean ? ` transform="rotate(7 ${cx + bw} ${yb})"` : ''}/>`;
    cx += bw + (lean ? 5 : .6); k++;
  }
  return o;
}
export function volume(x, yb, state, id, w = 42, h = 27) {
  const nm = TIER_NAMES[id].toUpperCase(), y = yb - h;
  if (state === 'researching') return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="none" stroke="var(--edge)" stroke-width="1.4" stroke-dasharray="4 3" opacity=".8"/><path d="M${x + w / 2} ${y + h - 6}v-12m-5 5l5 -6l5 6" fill="none" stroke="var(--edge)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (state === 'discovered') return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="color-mix(in srgb, var(--olive) 78%, var(--screen))" stroke="var(--edge)" stroke-width="1.3"/><rect x="${x}" y="${y}" width="5" height="${h}" fill="var(--mustard)" stroke="var(--edge)" stroke-width="1"/>` +
    `<text class="spine-t" x="${x + w / 2 + 2}" y="${y + 8}" style="font-size:6.4px;letter-spacing:.05em">${nm}</text><g transform="rotate(-7 ${x + w / 2 + 2} ${y + 18})"><rect class="stampd" x="${x + 8}" y="${y + 12}" width="${w - 11}" height="10"/><text class="stampt" x="${x + w / 2 + 2.5}" y="${y + 19.6}" style="font-size:5.6px;letter-spacing:.04em;fill:color-mix(in srgb, var(--alert) 55%, var(--edge))">DISCOVERED</text></g>`;
  // locked: a closed volume wrapped in chain with a brass padlock
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="color-mix(in srgb, var(--concrete) 78%, var(--screen))" stroke="var(--edge)" stroke-width="1.3"/><rect x="${x}" y="${y}" width="5" height="${h}" fill="var(--concrete)" stroke="var(--edge)" stroke-width="1"/>` +
    `<text class="spine-t" x="${x + w / 2 + 2}" y="${y + 8}" style="font-size:6.4px;letter-spacing:.05em">${nm}</text><path d="M${x + 4} ${y + h - 4}L${x + w - 2} ${y + 10}M${x + 4} ${y + 10}L${x + w - 2} ${y + h - 4}" stroke="var(--edge)" stroke-width="2.4" stroke-dasharray="3 2"/>` +
    `<path d="M${x + w / 2 - 2} ${y + 14}v-3a3.6 3.6 0 0 1 7.2 0v3" fill="none" stroke="var(--screen)" stroke-width="1.6"/><rect class="brass" x="${x + w / 2 - 4.6}" y="${y + 13.6}" width="11" height="8" rx="1.4"/>`;
}
function librarySVG(n) {
  const yb = 308, researching = n.tiers.findIndex(t => t === 'researching'), anyDone = n.tiers.includes('discovered');
  let s = `<g class="zone area" id="z-research" transform="translate(244.6 308) scale(.88)">` + padSVG(30, 150, 270, 205, 't-lb');
  s += sign(165, 160, 136, 20, 'Records Library', .6) + lamp(40, 218, -.4) + lamp(292, 222, -2.1);
  // bookcase: three shelves of spines
  const bw = 76, bh = 108, bx = 44;
  let shelves = '';
  for (let r = 0; r < 3; r++) { const sy = yb - 6 - (2 - r) * 33; shelves += shelfBooks(bx + 3, sy, bw - 6, 11 + r * 5, 29) + `<rect x="${bx + 3}" y="${sy}" width="${bw - 6}" height="4" fill="var(--walnut)" stroke="var(--edge)" stroke-width="1"/>`; }
  s += pbox({ x: bx, yb, w: bw, h: bh, d: 11, c: 'walnut', extra: `<rect x="${bx + 3}" y="${yb - bh + 4}" width="${bw - 6}" height="${bh - 10}" fill="var(--screen)" opacity=".62"/>${shelves}<rect x="${bx + 3}" y="${yb - bh + 4}" width="${bw - 6}" height="${bh - 10}" fill="none" stroke="var(--edge)" stroke-width="1"/><rect x="${bx + 20}" y="${yb - bh - 10}" width="30" height="8" rx="1" class="page"/><rect x="${bx + 24}" y="${yb - bh - 17}" width="30" height="7" rx="1" fill="var(--alert)" stroke="var(--edge)" stroke-width=".8"/>` });
  // card catalogue
  const cx0 = 240, cw = 54, ch = 76;
  let dr = '';
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { const x = cx0 + 4 + c * 15.4, y = yb - ch + 6 + r * 17; dr += `<rect x="${x}" y="${y}" width="13.4" height="15" rx="1" fill="none" stroke="var(--edge)" stroke-width=".9"/><rect x="${x + 3}" y="${y + 3}" width="7.4" height="3.6" fill="var(--edge)" stroke="var(--concrete)" stroke-width=".5"/><rect x="${x + 3.4}" y="${y + 9}" width="6.6" height="2.4" rx="1.1" class="brass"/>`; }
  s += pbox({ x: cx0, yb, w: cw, h: ch, d: 9, c: 'walnut', extra: dr + `<g transform="rotate(-6 ${cx0 + 36} ${yb - ch - 6})"><rect class="page" x="${cx0 + 8}" y="${yb - ch - 11}" width="16" height="9"/><rect class="page" x="${cx0 + 12}" y="${yb - ch - 13}" width="16" height="9"/></g><rect x="${cx0 + 34}" y="${yb - ch - 14}" width="14" height="6" rx="1" fill="var(--alert)" stroke="var(--edge)" stroke-width=".8"/>` });
  // lectern with an open volume and the reading lamp
  const lx = 162;
  const flip = researching >= 0 ? ' b-read' : '';
  s += `<g class="up" style="transform-origin:${lx + 28}px ${yb}px"><polygon class="shl" points="${lx + 6},${yb} ${lx + 50},${yb} ${lx + 76},${yb + 9} ${lx + 24},${yb + 9}"/><polygon class="shc" points="${lx + 6},${yb} ${lx + 50},${yb} ${lx + 53},${yb + 4} ${lx + 9},${yb + 4}"/>` +
    `<rect class="fr c-walnut" x="${lx + 12}" y="${yb - 36}" width="32" height="36" rx="1.5"/><path class="rim" d="M${lx + 13.5} ${yb - 1}V${yb - 34.5}H${lx + 42}"/>` +
    `<polygon class="fr c-walnut" points="${lx},${yb - 36} ${lx + 56},${yb - 36} ${lx + 52},${yb - 56} ${lx + 4},${yb - 56}" style="stroke-linejoin:round"/>` +
    `<polygon class="tp c-walnut" points="${lx + 6},${yb - 78} ${lx + 50},${yb - 78} ${lx + 52},${yb - 56} ${lx + 4},${yb - 56}"/>` +
    `<circle class="halo" cx="${lx + 28}" cy="${yb - 66}" r="34"/>` +
    // the open volume
    `<g class="${flip.trim()}" style="--t:1;--d:0s"><polygon points="${lx + 8},${yb - 74} ${lx + 28},${yb - 74} ${lx + 28},${yb - 58} ${lx + 6},${yb - 58}" fill="var(--edge)" stroke="var(--concrete)" stroke-width="1"/><g class="rpage" style="transform-origin:${lx + 28}px ${yb - 66}px"><polygon points="${lx + 28},${yb - 74} ${lx + 48},${yb - 74} ${lx + 50},${yb - 58} ${lx + 28},${yb - 58}" fill="var(--edge)" stroke="var(--concrete)" stroke-width="1"/></g>` +
    `<path d="M${lx + 11} ${yb - 70}h14M${lx + 10} ${yb - 66}h15M${lx + 9} ${yb - 62}h10M${lx + 32} ${yb - 70}h13M${lx + 32} ${yb - 66}h14M${lx + 32} ${yb - 62}h8" stroke="var(--concrete)" stroke-width="1"/><path d="M${lx + 28} ${yb - 75}V${yb - 57}" stroke="var(--screen)" stroke-width="1.4"/><path d="M${lx + 38} ${yb - 74}v22l3 -3l3 3v-22" fill="var(--alert)" stroke="var(--edge)" stroke-width=".7"/></g>` +
    (researching >= 0 ? `<g class="spark" style="--d:0s"><path d="M${lx + 14} ${yb - 84}l1.6 4l4 1.6l-4 1.6l-1.6 4l-1.6 -4l-4 -1.6l4 -1.6z" fill="var(--mustard)" stroke="var(--edge)" stroke-width=".6"/></g><g class="spark" style="--d:-1.1s"><path d="M${lx + 42} ${yb - 88}l1.2 3l3 1.2l-3 1.2l-1.2 3l-1.2 -3l-3 -1.2l3 -1.2z" fill="var(--mustard)" stroke="var(--edge)" stroke-width=".6"/></g>` : '') +
    // reading lamp on an arm, ink pad and stamp
    `<path d="M${lx + 58} ${yb - 40}V${yb - 94}Q${lx + 58} ${yb - 106} ${lx + 46} ${yb - 106}" fill="none" stroke="var(--edge)" stroke-width="5" stroke-linecap="round"/><path d="M${lx + 58} ${yb - 40}V${yb - 94}Q${lx + 58} ${yb - 106} ${lx + 46} ${yb - 106}" fill="none" stroke="var(--mustard)" stroke-width="2.6" stroke-linecap="round"/>` +
    `<ellipse class="fr" style="--c:var(--walnut)" cx="${lx + 58}" cy="${yb - 38}" rx="7" ry="3"/><path class="fr" style="--c:var(--olive)" d="M${lx + 35} ${yb - 100}L${lx + 41} ${yb - 112}H${lx + 54}L${lx + 58} ${yb - 100}Z"/><ellipse class="lampc" cx="${lx + 46}" cy="${yb - 99}" rx="9" ry="3.2"/>` +
    `<rect x="${lx - 2}" y="${yb - 62}" width="12" height="6" rx="1.4" class="ink"/><rect x="${lx + 1}" y="${yb - 72}" width="6" height="11" rx="1" fill="var(--walnut)" stroke="var(--edge)" stroke-width=".8"/></g>`;
  // librarian
  s += T(142, 316, stand({ fur: 3, H: 60, bw: 24, tw: 1.1, hr: 11.5, ears: 'round', view: 'pr', gaze: [1, .5], eyes: 'open', mouth: 'smile', head: 'none', tail: true, shirt: 'sk-shade' },
    { hl: [-8, -26], hr: [12, -30], front: `<g><rect x="3" y="-40" width="24" height="5" fill="var(--alert)" stroke="var(--edge)" stroke-width=".8"/><rect x="2" y="-35" width="24" height="5" fill="var(--mustard)" stroke="var(--edge)" stroke-width=".8"/><rect x="4" y="-30" width="22" height="4.6" fill="var(--olive)" stroke="var(--edge)" stroke-width=".8"/></g>` }));
  // the volume rack: one volume per tier
  const slots = n.tiers.map((st, i) => volume(70 + i * 50, 347, st, TIER_IDS[i])).join('');
  s += pbox({ x: 62, yb: 351, w: 208, h: 36, d: 8, c: 'walnut', tabs: false, extra: `<rect x="66" y="${351 - 33}" width="200" height="30" fill="var(--screen)" opacity=".5"/>` });
  s += `<g>${slots}</g>`;
  return s + `<rect class="ring" x="28" y="148" width="274" height="209" rx="8"/></g>`;
}

/* ----- Typing Pool: up to CAP drawn desks in a 4 x 3 grid, an editing row (Editor-in-Chief always, up to ED_CAP more), the pneumatic tube, a brass headcount placard past the cap ----- */
const ED_OVER = [
  Object.assign({}, EDITOR),
  Object.assign({}, EDITOR, { fur: 1, H: 54, bw: 46, hr: 14.5, view: 'pl', gaze: [-1, .5], head: 'none', body: 'tie', shirt: 'sk-mustard', chair: 'tall', flange: false, ears: 'big' }),
  Object.assign({}, EDITOR, { fur: 2, H: 60, bw: 40, hr: 13, view: 'pr', gaze: [1, .3], head: 'none', body: 'cardigan', shirt: 'sk-paper', chair: 'short', flange: false, ears: 'tuft', lean: -5 })
];
function poolSVG(n, count) {
  const { xs, rows, edRow, edXs, edDw } = POOL_G;
  let s = `<g class="zone area" id="z-pool" transform="translate(0 ${POOL_DY})">` + padSVG(220, 450, 340, 525, 't-pl');
  s += sign(390, 460, 124, 21, 'Typing Pool', 2.2) + lamp(238, 506, 0) + lamp(542, 506, -1.7);
  const marks = [], front = [], vac = [];
  for (let i = 0; i < CAP; i++) {
    const cx = xs[i % 4], yb = rows[i >> 2];
    if (i < n.seated) front.push(seatSVG(i, cx, yb, {}));
    else if (i < n.desks) vac.push(seatSVG(i, cx, yb, { vacant: true }));
    else marks.push(deskMark(cx, yb, 64, i > n.desks + 2, i === n.desks ? `Desk ${i + 1}` : ''));
  }
  if (n.desks <= 2) {                       // the first days: bunting strung between the lamps, taken down once the pool fills
    const B = t => [f1((1 - t) * (1 - t) * 250 + 2 * t * (1 - t) * 390 + t * t * 530), f1((1 - t) * (1 - t) * 500 + 2 * t * (1 - t) * 548 + t * t * 500)];
    const cols = ['var(--tangerine)', 'var(--mustard)', 'var(--olive)', 'var(--alert)'];
    s += `<path d="M250 500Q390 596 530 500" fill="none" stroke="var(--screen)" stroke-width="1.4"/>` + Array.from({ length: 11 }, (_, k) => { const [x, y] = B((k + .6) / 11.8); return `<path d="M${f1(x - 8)} ${y}h16l-8 17z" fill="${cols[k % 4]}" stroke="var(--edge)" stroke-width="1.2" stroke-linejoin="round"/>`; }).join('');
  }
  s += marks.join('') + front.join('') + vac.join('');
  // editing row: the chief at the tube end, more stamping desks as Editing grows
  for (let k = 0; k < 1 + ED_CAP; k++) {
    if (k <= n.editors) s += seatSVG(40 + k, edXs[k], edRow, { over: ED_OVER[k], dw: edDw, vacant: false }).replace(`data-i="${40 + k}"`, `data-editor="${k}"`);
    else s += deskMark(edXs[k], edRow, edDw, k > n.editors + 1, '');
  }
  s += `<g class="up" style="transform-origin:556px ${edRow}px"><polygon class="shl" points="551,${edRow} 561,${edRow} 596,${edRow + 14} 585,${edRow + 14}"/><polygon class="shc" points="551,${edRow} 561,${edRow} 564,${edRow + 4} 554,${edRow + 4}"/><rect class="fr c-steel" x="551" y="${edRow - 222}" width="10" height="222" rx="2"/><rect x="549" y="${edRow - 228}" width="14" height="8" rx="2" class="brass"/><rect x="549" y="${edRow - 8}" width="14" height="8" rx="2" class="brass"/><rect x="549" y="${edRow - 120}" width="14" height="4" rx="1.5" class="brass"/><g class="cap"><rect x="553" y="${edRow - 26}" width="6" height="12" rx="2.6" fill="var(--edge)" stroke="var(--screen)" stroke-width=".8"/></g></g>`;
  s += cactus(236, 862, .9);
  if (n.crowd) s += `<g class="up" style="transform-origin:390px 962px"><polygon class="shl" points="318,968 462,968 478,978 334,978"/><rect class="fr c-mustard" x="318" y="944" width="144" height="24" rx="3"/><path class="rim" d="M320 966V946H460"/><circle cx="326" cy="956" r="2.2" fill="var(--screen)"/><circle cx="454" cy="956" r="2.2" fill="var(--screen)"/><text class="hc" x="390" y="961" data-hc="1">${headcountText(count)}</text></g>`;
  return s + `<rect class="ring" x="218" y="448" width="344" height="529" rx="8"/></g>`;
}

/* ----- Personnel, the entrance, the shredder station ----- */
function personnelSVG(n) {
  let s = `<g class="zone area" id="z-personnel" transform="translate(155 160)">` + padSVG(110, 965, 250, 170, 't-pe');
  s += sign(235, 975, 112, 20, 'Personnel', 3.1) + lamp(128, 1040, -.6, true);
  s += seatSVG(41, 235, 1100, { over: { fur: 3, H: 56, bw: 30, tw: 1.1, hr: 12.5, ears: 'round', lean: 0, view: 'f', gaze: [.5, .6], eyes: 'open', mouth: 'smile', head: 'glassesR', body: 'bowtie', tail: 'curl', prop: 4, ps: 1, beh: 'slam', shirt: 'sk-paper', chair: 'round' } });
  const fy = 1112 - 54;
  s += pbox({ x: 290, yb: 1112, w: 40, h: 54, d: 8, c: 'steel', extra: `<rect x="295" y="${fy + 8}" width="30" height="20" rx="1.2" fill="none" stroke="var(--edge)" stroke-width="1"/><rect x="295" y="${fy + 32}" width="30" height="16" rx="1.2" fill="none" stroke="var(--edge)" stroke-width="1"/><rect x="303" y="${fy + 15}" width="14" height="6" rx="1.4" class="brass"/><rect x="303" y="${fy + 37}" width="14" height="6" rx="1.4" class="brass"/>` });
  s += `<g transform="translate(0 -34)"><g class="up" style="transform-origin:146px 1146px"><polygon class="shc" points="130,1146 164,1146 167,1150 133,1150"/><rect class="fr c-paper" x="132" y="1128" width="32" height="18" rx="1.5"/><rect class="fr c-paper" x="135" y="1118" width="32" height="18" rx="1.5"/><path d="M139 1124h20M139 1128h14" stroke="var(--concrete)" stroke-width="1"/></g></g>`;
  // the tutorial hand points at the clerk's desk while nobody waits at the door
  if (n.tutorial && !n.candidate) s += nextCue(190, 1070);
  s += `<rect class="ring" x="108" y="963" width="254" height="174" rx="8"/></g>`;
  // entrance: door, mat, umbrella stand, plant, and the candidate waiting when a desk is free
  s += `<g class="area" id="a-entrance" transform="translate(62 260)">`;
  s += T(-25, -110, pbox({ x: 205, yb: 1300, w: 60, h: 96, d: 9, c: 'concrete', extra: `<rect x="212" y="1212" width="46" height="88" fill="var(--glow)" stroke="var(--edge)" stroke-width="1.2"/><polygon points="212,1212 212,1300 192,1307 192,1206" fill="var(--olive)" stroke="var(--edge)" stroke-width="1.2"/><circle cx="196" cy="1256" r="2" class="brass"/><path d="M222 1226h26M222 1232h20" stroke="var(--concrete)" stroke-width="1.2"/>` }));
  s += `<text class="sg sm" x="210" y="1215">Entrance</text>`;
  s += umbrellaStand(282, 1190) + ficus(30, 1204, 1.15);
  if (n.tutorial && n.candidate) s += nextCue(300, 1090);
  if (n.candidate) s += `<g id="candpos" style="transform:translate(300px,1210px)"><g id="cand" class="cand">${stand(Object.assign({}, CANDIDATE, { H: 58, bw: 24 }), { hl: [-9, -26], hr: [12, -22], xr: '', front: `<rect x="10" y="-26" width="22" height="16" rx="2" fill="var(--walnut)" stroke="var(--edge)" stroke-width="1.2"/><path d="M16 -26v-4h10v4" fill="none" stroke="var(--edge)" stroke-width="1.6"/><rect x="19" y="-20" width="4" height="4" class="brass"/>` })}</g></g>`;
  s += T(-100, -98, T(556, 1288, stand({ fur: 0, H: 58, bw: 28, tw: 1.15, hr: 12.5, ears: 'round', view: 'l', gaze: [-1, .7], eyes: 'heavy', mouth: 'flat', head: 'glassesR', tail: true, shirt: 'sk-shade' }, { hl: [-14, -34], hr: [-4, -34], front: `<g class="rpage" style="transform-origin:-18px -44px"><rect class="page" x="-28" y="-52" width="20" height="24" rx="1" transform="rotate(-6 -18 -40)"/><path d="M-24 -46h12M-24 -42h12M-24 -38h8" stroke="var(--concrete)" stroke-width="1" transform="rotate(-6 -18 -40)"/></g>` })) +
    pbox({ x: 500, yb: 1296, w: 112, h: 16, d: 10, c: 'walnut', extra: `<rect x="504" y="1268" width="104" height="8" fill="var(--paper-shade)" stroke="var(--edge)" stroke-width="1"/>` }) +
    pbox({ x: 664, yb: 1296, w: 46, h: 62, d: 9, c: 'mustard', extra: `<rect x="676" y="1246" width="22" height="4" rx="2" class="ink"/><rect class="page" x="684" y="1238" width="14" height="12" transform="rotate(12 690 1244)"/><rect x="672" y="1262" width="30" height="20" fill="var(--edge)" stroke="var(--screen)" stroke-width=".9"/><path d="M676 1268h22M676 1273h14" stroke="var(--concrete)" stroke-width="1"/>` }));
  s += snake(650, 1204, 1.1) + `</g>`;
  s += `<g class="area" id="a-shred" transform="translate(150 225)"><g transform="translate(-128 -80)">` +
    pbox({ x: 628, yb: 1120, w: 70, h: 52, d: 12, c: 'steel', extra: `<rect x="640" y="1076" width="46" height="4" rx="2" class="ink"/><rect x="636" y="1092" width="54" height="22" rx="1.2" fill="none" stroke="var(--edge)" stroke-width="1"/><rect x="654" y="1098" width="18" height="6" rx="1.6" class="brass"/><g class="shred"><rect class="page" x="654" y="1070" width="14" height="12"/></g><path d="M646 1114v6M652 1114v6M658 1114v6M664 1114v6M670 1114v6M676 1114v6" stroke="var(--edge)" stroke-width="1.6"/>` }) +
    T(604, 1126, stand({ fur: 3, H: 62, bw: 26, tw: 1.1, hr: 12, ears: 'tuft', view: 'pr', gaze: [1, .5], eyes: 'open', mouth: 'flat', head: 'swirl', tail: true, shirt: 'sk-mustard' }, { hr: [22, -52], hl: [-6, -24] })) + `</g>` + snake(594, 1070, .9) + `</g>`;
  return s;
}


const DEFS = `<defs><radialGradient id="halo"><stop offset="0" style="stop-color:var(--glow);stop-opacity:.95"/><stop offset=".55" style="stop-color:var(--glow);stop-opacity:.45"/><stop offset="1" style="stop-color:var(--glow);stop-opacity:0"/></radialGradient></defs>`;

/** One room's scene as a function of state: markup for an <svg> whose viewBox is `viewBox`. */
export function buildRoom(id, props) {
  const n = normalize(props), key = id + JSON.stringify(n);
  let body = '';
  switch (id) {
    case 'personnel': {
      // the entrance and the shredder station sit a little closer to the office, so the room fits one wide scene
      const p = personnelSVG(n), at = p.indexOf('<g class="area" id="a-entrance"');
      body = `<g transform="translate(0 ${PERS_DY})">${p.slice(0, at)}<g transform="translate(0 -30)">${p.slice(at)}</g></g>`;
      break;
    }
    case 'pool': body = poolSVG(n, props.seated); break;
    case 'departments': body = departmentsSVG(n); break;
    case 'research': body = librarySVG(n); break;
    case 'director': body = directorSVG(n); break;
    default: body = '';
  }
  // ids are dropped: the building draws the same kit on the same page, and nothing here needs them
  return { svg: body.replace(/ id="[^"]*"/g, ''), viewBox: ROOM_VIEWS[id] || [0, 0, 100, 100], key };
}
/** Shared <defs> (the lamp-glow gradient the kit refers to). Put once in the document. */
export const roomDefs = () => DEFS;

// the headcount placard changes more often than the picture does: patch its text in place instead of rebuilding
export const updateHeadcount = (root, seated) => root.querySelectorAll('[data-hc]').forEach(t => { t.textContent = headcountText(seated); });
