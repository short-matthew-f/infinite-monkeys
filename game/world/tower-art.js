// The Bureau as a building of floors: one small live scene per floor, drawn
// from the parts kit in floor-art.js (monkeys, desks, cabinets, volumes).
// Ported in spirit from design/explorations/tower (layout A, "fit").
//
// buildTower(props) is pure: same props, same markup, no DOM. tower.ts compares
// `key` with the last one and rebuilds only when the picture can change; the
// small live numbers (counts, meters) are patched in place by patchLive().
//
// Every floor is drawn for a 400 x 96 box (the lobby floor 400 x 134, with the
// street under it). The left 120 units are kept calm for the floor's plate and
// status tag, which the page lays over the art.
/* eslint-disable */
import { CAST, CANDIDATE, EDITOR, T, f1, hash, pbox, lamp, ficus, snake, seatSVG, stand, deskMark, shelfBooks, volume, drawers } from './floor-art.js';

const W = 400, H = 96, YB = 86;
const TIER_IDS = ['letters', 'words', 'phrases', 'sentences'];
const DEPT_IDS = ['recruiting', 'construction', 'editing'];
export const FLOOR_BOX = { personnel: [W, 134], pool: [W, H], departments: [W, H], research: [W, H], director: [W, H] };
export const FLOOR_NAMES = { personnel: 'Personnel', pool: 'Typing Pool', departments: 'Departments', research: 'Records Library', director: "Director's Office" };
const DEPT_NAMES = { recruiting: 'Recruiting', construction: 'Construction', editing: 'Editing' };

const count = (n) => Math.max(0, Math.floor(n)).toLocaleString('en-US');

/** What the building draws, with every cap applied once. The key is this object. */
function norm(p) {
  const seated = Math.max(0, Math.floor(p.seated || 0));
  const desks = Math.max(seated, Math.floor(p.desks || 0));
  const free = desks - seated;
  const drawn = Math.min(seated, free > 0 ? 3 : 4);
  const vac = Math.min(free, 4 - drawn);
  const tierState = (id) => { const t = (p.tiers || []).find((x) => x.id === id); return t && ['researching', 'discovered'].includes(t.state) ? t.state : 'locked'; };
  const dept = (id) => { const d = (p.depts || {})[id] || {}; return [Math.min(5, Math.max(0, Math.floor(d.level || 0))), Math.min(4, Math.max(1, Math.floor(d.stage || 1)))]; };
  const e = Math.max(0, Math.floor(p.editors || 0));
  return {
    pool: [drawn, vac], candidate: p.candidate ? 1 : 0,
    tiers: TIER_IDS.map(tierState), depts: DEPT_IDS.map(dept),
    editors: e < 1 ? 0 : 1, permit: p.permit ? 1 : 0,
    pile: p.bottleneck === 'editing' ? 1 : 0,
  };
}
export const towerKey = (p) => JSON.stringify(norm(p));

/** One line of status for a floor: the same words on the plate, the aria-label and the Directory. */
export function floorHint(id, p) {
  const seated = Math.max(0, Math.floor(p.seated || 0)), desks = Math.max(seated, Math.floor(p.desks || 0)), free = desks - seated;
  switch (id) {
    case 'personnel': return free > 0 ? `${count(free)} desk${free === 1 ? '' : 's'} free` : 'Every desk is taken';
    case 'pool': return `${count(seated)} seated${free > 0 ? ` · ${count(free)} free` : ''}`;
    case 'departments': return 'Recruiting, Construction, Editing';
    case 'research': { const d = (p.tiers || []).filter((t) => t.state === 'discovered').length; return `${d} of ${(p.tiers || []).length} tiers discovered`; }
    case 'director': { if (p.permit) return 'Permit stamped'; const m = p.meters || {}; const full = DEPT_IDS.filter((k) => (m[k] || 0) >= 1 - 1e-9).length; return `${full} of 3 meters full`; }
    default: return '';
  }
}
/** The short form for the plate's status tag. */
export function floorTag(id, p) {
  const seated = Math.max(0, Math.floor(p.seated || 0)), desks = Math.max(seated, Math.floor(p.desks || 0)), free = desks - seated;
  switch (id) {
    case 'personnel': return free > 0 ? `${count(free)} desk${free === 1 ? '' : 's'} free` : 'Desks full';
    case 'research': { const d = (p.tiers || []).filter((t) => t.state === 'discovered').length; return `${d} of ${(p.tiers || []).length} tiers`; }
    case 'director': { if (p.permit) return 'Permit stamped'; const m = p.meters || {}; return `${DEPT_IDS.filter((k) => (m[k] || 0) >= 1 - 1e-9).length} of 3 meters`; }
    default: return floorHint(id, p);
  }
}
export function deptHint(id, p) {
  const d = (p.depts || {})[id] || { level: 0, stage: 1 };
  return `Level ${count(d.level)}, stage ${d.stage} of 4`;
}

/** Patches the live numbers in place: [data-live] text, [data-bar] meter fills. */
export function patchLive(root, p) {
  for (const el of root.querySelectorAll('[data-live]')) {
    const k = el.dataset.live;
    const v = DEPT_IDS.includes(k) ? `${DEPT_NAMES[k]} Lv ${count((p.depts[k] || {}).level || 0)}` : k === 'free-board' ? String(Math.max(0, Math.floor(p.desks) - Math.floor(p.seated))) : floorTag(k, p);
    if (el.textContent !== v) el.textContent = v;
  }
  for (const el of root.querySelectorAll('[data-bar]')) {
    const v = `scaleY(${Math.max(0.03, Math.min(1, (p.meters || {})[el.dataset.bar] || 0)).toFixed(2)})`;
    if (el.style.transform !== v) el.style.transform = v;
  }
}

/* ===== backdrops ===== */
const back = (cls, h = H, yb = YB) =>
  `<rect class="tw-wall ${cls}" x="-260" y="-120" width="920" height="${yb + 120}"/><rect class="tw-wain ${cls}" x="-260" y="${yb - 13}" width="920" height="13"/>` +
  `<path class="tw-wain-rim" d="M-260 ${yb - 13}H660"/><rect class="tw-floor" x="-260" y="${yb}" width="920" height="${h - yb}"/><path class="tw-edge" d="M-260 ${yb}H660"/>` +
  ``;
const hanging = (x, len = 8) => `<g><path d="M${x} -120V${len}" stroke="var(--screen)" stroke-width="1"/><ellipse class="halo" cx="${x}" cy="${len + 8}" rx="30" ry="16" style="opacity:.55"/><path class="fr" style="--c:var(--tangerine)" d="M${x - 8} ${len + 5}L${x - 4} ${len - 2}H${x + 4}L${x + 8} ${len + 5}Z"/></g>`;
const clock = (x, y, r = 9) => `<g><circle cx="${x}" cy="${y}" r="${r}" fill="var(--edge)" stroke="var(--screen)" stroke-width="1.2"/><path d="M${x} ${y}V${y - r * .62}M${x} ${y}l${r * .45} ${r * .2}" stroke="var(--screen)" stroke-width="1.2" stroke-linecap="round"/></g>`;
// a monkey seated at a desk, scaled to fit the band
const seat = (i, cx, yb, k, o) => `<g transform="translate(${cx} ${yb}) scale(${k})">${seatSVG(i, 0, 0, o || {})}</g>`;
const mark = (cx, yb, k, faint) => `<g transform="translate(${cx} ${yb}) scale(${k})">${deskMark(0, 0, 64, faint, '')}</g>`;
const standing = (x, y, k, s, pose) => `<g transform="translate(${x} ${y}) scale(${k})">${stand(s, pose)}</g>`;

/* ===== floor 1: street, lobby and Personnel ===== */
const CLERK = { fur: 3, H: 56, bw: 30, tw: 1.1, hr: 12.5, ears: 'round', lean: 0, view: 'f', gaze: [.5, .6], eyes: 'open', mouth: 'smile', head: 'glassesR', body: 'bowtie', tail: 'curl', prop: 4, ps: 1, beh: 'slam', shirt: 'sk-paper', chair: 'round' };
function personnelFloor(n) {
  const yb = 88, FH = 134;
  let s = back('tw-pe', FH, yb) + hanging(190) + hanging(330);
  // the lobby door, with its sign, and a welcome mat
  s += pbox({ x: 126, yb, w: 34, h: 56, d: 7, c: 'concrete', tabs: false, extra: `<rect x="130" y="${yb - 51}" width="26" height="51" fill="var(--glow)" stroke="var(--edge)" stroke-width="1.2"/><polygon points="130,${yb - 51} 130,${yb} 119,${yb + 4} 119,${yb - 55}" fill="var(--olive)" stroke="var(--edge)" stroke-width="1.1"/><circle cx="122" cy="${yb - 26}" r="1.6" class="brass"/>` });
  s += `<rect class="fr c-mustard" x="124" y="${yb - 70}" width="38" height="9" rx="1.5"/><text class="sg sm" x="143" y="${yb - 62.6}" style="font-size:7.4px;letter-spacing:.1em">LOBBY</text>`;
  s += ficus(182, yb, .55);
  // the clerk's desk and the filing cabinet
  s += seat(41, 236, yb, .74, { over: CLERK });
  s += pbox({ x: 288, yb, w: 28, h: 46, d: 7, c: 'steel', extra: drawers(288, yb - 40, 28, 2, 18, false) });
  // a board that counts the free desks
  s += `<g class="up" style="transform-origin:352px ${yb}px"><rect class="fr c-mustard" x="326" y="22" width="52" height="34" rx="2"/><rect x="330" y="26" width="44" height="26" fill="var(--screen)" stroke="var(--edge)" stroke-width=".8"/>` +
    `<text x="352" y="34.4" style="font:700 6.6px var(--font-display);letter-spacing:.14em;fill:var(--screen-muted);text-anchor:middle;text-transform:uppercase">Free desks</text><text data-live="free-board" x="352" y="48" style="font:600 13px var(--font-mono);fill:var(--screen-ink);text-anchor:middle"></text></g>`;
  // the street: kerb, road, the applicants' bus
  s += `<rect class="tw-walk" x="-260" y="${yb + 10}" width="920" height="7"/><path class="tw-edge" d="M-260 ${yb + 10}H660"/><rect class="tw-road" x="-260" y="${yb + 17}" width="920" height="${FH - yb - 17}"/><path d="M-260 ${yb + 30}H660" stroke="var(--mustard)" stroke-width="1.6" stroke-dasharray="10 9" opacity=".8"/>`;
  s += `<g><rect x="262" y="${yb + 2}" width="104" height="24" rx="5" fill="var(--mustard)" stroke="var(--edge)" stroke-width="1.6"/><rect x="270" y="${yb + 6}" width="78" height="8" fill="color-mix(in srgb, var(--glow) 60%, var(--edge))" stroke="var(--screen)" stroke-width=".6"/><rect x="268" y="${yb + 17}" width="70" height="6" fill="var(--screen)"/><text x="303" y="${yb + 22.4}" style="font:700 5.2px var(--font-display);letter-spacing:.12em;fill:var(--screen-ink);text-anchor:middle">APPLICANTS</text><circle cx="284" cy="${yb + 27}" r="5" fill="var(--screen)" stroke="var(--edge)"/><circle cx="346" cy="${yb + 27}" r="5" fill="var(--screen)" stroke="var(--edge)"/></g>`;
  if (n.candidate) s += `<g transform="translate(238 ${yb + 22}) scale(.6)"><g id="t-cand" class="cand">${stand(Object.assign({}, CANDIDATE, { H: 58, bw: 24 }), { hl: [-9, -26], hr: [12, -22], front: `<rect x="10" y="-26" width="22" height="16" rx="2" fill="var(--walnut)" stroke="var(--edge)" stroke-width="1.2"/><path d="M16 -26v-4h10v4" fill="none" stroke="var(--edge)" stroke-width="1.6"/><rect x="19" y="-20" width="4" height="4" class="brass"/>` })}</g></g>`;
  s += `<g class="tw-fx"></g>`;
  return s;
}

/* ===== floor 2: the Typing Pool ===== */
function poolFloor(n) {
  const xs = [178, 236, 294, 352], k = .66;
  let s = back('tw-pl') + hanging(150) + hanging(300) + clock(62, 34) + ficus(104, YB, .6);
  const [drawn, vac] = n.pool;
  for (let i = 0; i < 4; i++) {
    if (i < drawn) s += seat(i, xs[i], YB, k);
    else if (i < drawn + vac) s += seat(i, xs[i], YB, k, { vacant: true });
    else s += mark(xs[i], YB, k, i > drawn + vac);
  }
  // the pneumatic tube up the right wall, with its capsule
  s += `<g><rect class="fr c-steel" x="388" y="2" width="8" height="${YB - 2}" rx="2"/><rect x="386" y="${YB - 8}" width="12" height="7" rx="2" class="brass"/><g class="cap"><rect x="389.5" y="${YB - 26}" width="5" height="11" rx="2.4" fill="var(--edge)" stroke="var(--screen)" stroke-width=".8"/></g></g>`;
  return s;
}

/* ===== floor 3: Departments, three wings ===== */
const wing = (x0, cls) => `<rect class="tw-wing ${cls}" x="${x0}" y="3" width="133" height="${YB - 3}"/><path d="M${x0 + 133} 3V${YB}" stroke="var(--edge)" stroke-width="2.4"/>`;
const hardhat = (H) => `<g><path d="M-11 ${-H + 3}a11 10 0 0 1 22 0z" fill="var(--mustard)" stroke="var(--edge)" stroke-width="1.2"/><rect x="-13" y="${-H + 2}" width="26" height="3.2" rx="1.4" fill="var(--mustard)" stroke="var(--edge)" stroke-width="1.1"/></g>`;
const stageLamps = (x, y, st) => Array.from({ length: 4 }, (_, k) => `<circle cx="${x}" cy="${y - k * 8}" r="2.9" fill="${k < st ? 'var(--tangerine)' : 'var(--paper-shade)'}" stroke="var(--screen)" stroke-width=".9"/>`).join('');
function departmentsFloor(n) {
  const [[lr, sr], [lc, sc], [le, se]] = n.depts;
  let s = back('tw-dp') + wing(0, 'w-r') + wing(133, 'w-c') + wing(266, 'w-e') + hanging(66) + hanging(200) + hanging(332);
  // Recruiting: a filing cabinet that gains drawers, a headset and a telephone
  const rA = 2 + Math.min(lr, 1), hA = 12 + rA * 12;   // kept low so the floor's nameplate never hides the top drawer
  s += pbox({ x: 10, yb: YB, w: 34, h: hA, d: 7, c: 'steel', extra: drawers(10, YB - hA + 5, 34, rA, 12, false) });
  s += standing(88, YB - 6, .66, { fur: 1, H: 62, bw: 26, tw: 1.1, hr: 12, ears: 'big', view: 'pl', gaze: [-1, .3], eyes: 'open', mouth: 'smile', head: 'phones', tail: true, shirt: 'sk-rust' }, { hr: [-13, -50], hl: [-6, -22], xr: `<path d="M-10 -52l-5 3v8l5 -3z" fill="var(--screen)" stroke="var(--edge)" stroke-width="1"/>` });
  s += `<g><rect class="fr c-concrete" x="104" y="${YB - 11}" width="22" height="11" rx="1.5"/><path d="M108 ${YB - 11}q0 -7 6 -6t6 6" fill="none" stroke="var(--screen)" stroke-width="2.4" stroke-linecap="round"/></g>`;
  s += stageLamps(124, 68, sr);
  // Construction: a desk frame going up, planks, the Foreman with a hammer
  const plank = Math.min(1 + lc, 4);
  s += Array.from({ length: plank }, (_, k) => `<rect class="fr c-walnut" x="${140 + (k % 2) * 3}" y="${YB - 5 - k * 5}" width="34" height="4.6" rx="1"/>`).join('');
  s += pbox({ x: 182, yb: YB, w: 40, h: 24, d: 7, c: 'walnut', extra: `<path d="M184 ${YB - 24}v-22M220 ${YB - 24}v-22M184 ${YB - 46}h36" stroke="var(--edge)" stroke-width="2" stroke-dasharray="4 3" fill="none"/>` });
  s += standing(246, YB - 6, .66, { fur: 4, H: 64, bw: 28, tw: 1.1, hr: 12, ears: 'tuft', view: 'pl', gaze: [-1, .4], eyes: 'open', mouth: 'smirk', head: 'none', tail: true, shirt: 'sk-mustard', beh: 'slam' },
    { hl: [-8, -24], hr: [-14, -40], front: hardhat(64) + `<g class="hammer" style="transform-origin:-14px -40px"><rect x="-17" y="-50" width="3" height="16" fill="var(--walnut)" stroke="var(--edge)" stroke-width=".8"/><rect x="-23" y="-54" width="14" height="7" rx="1.4" fill="var(--concrete)" stroke="var(--edge)" stroke-width=".9"/></g>` });
  s += stageLamps(257, 68, sc);
  // Editing: the Chief Editor seated at the in-tray, a second desk once Editors are hired
  s += seat(40, 322, YB, .72, { over: EDITOR, dw: 84 });
  if (n.editors) s += seat(42, 288, YB, .5, { over: Object.assign({}, EDITOR, { fur: 2, H: 54, bw: 40, hr: 13, view: 'pr', gaze: [1, .3], head: 'none', body: 'cardigan', shirt: 'sk-paper', chair: 'short', flange: false, ears: 'tuft', lean: -5 }), dw: 64 });
  // the in-tray: two sheets, or a pile to the ceiling when finds are going unreviewed
  const sheets = n.pile ? 11 : 2;
  s += `<g class="${n.pile ? 'pile' : ''}">` + pbox({ x: 358, yb: YB, w: 30, h: 12, d: 6, c: 'walnut', tabs: false, extra: '' }) +
    Array.from({ length: sheets }, (_, k) => `<rect class="page" x="${360 + (k % 3) * 2 - (k > 6 ? 3 : 0)}" y="${YB - 16 - k * 4.4}" width="${27 - (k % 2) * 2}" height="4" rx=".8" transform="rotate(${((k * 37) % 9) - 4} 372 ${YB - 14 - k * 4.4})"/>`).join('') + `</g>`;
  if (n.pile) s += `<g><path d="M392 ${YB - 62}l9 15h-18z" fill="var(--alert)" stroke="var(--edge)" stroke-width="1.4" stroke-linejoin="round"/><path d="M392 ${YB - 58}v7" stroke="var(--edge)" stroke-width="2" stroke-linecap="round"/><circle cx="392" cy="${YB - 48.5}" r="1.2" fill="var(--edge)"/></g>`;
  s += stageLamps(390, 68, se);
  return s;
}

/* ===== floor 4: the Records Library ===== */
function researchFloor(n) {
  let s = back('tw-lb') + hanging(160) + hanging(310);
  // bookcase
  const bx = 128, bw = 80, bh = 74;
  let shelves = '';
  for (let r = 0; r < 3; r++) { const sy = YB - 4 - (2 - r) * 22; shelves += shelfBooks(bx + 3, sy, bw - 6, 11 + r * 5, 18) + `<rect x="${bx + 3}" y="${sy}" width="${bw - 6}" height="3" fill="var(--walnut)" stroke="var(--edge)" stroke-width=".8"/>`; }
  s += pbox({ x: bx, yb: YB, w: bw, h: bh, d: 8, c: 'walnut', extra: `<rect x="${bx + 3}" y="${YB - bh + 4}" width="${bw - 6}" height="${bh - 8}" fill="var(--screen)" opacity=".6"/>${shelves}<rect x="${bx + 3}" y="${YB - bh + 4}" width="${bw - 6}" height="${bh - 8}" fill="none" stroke="var(--edge)" stroke-width=".9"/>` });
  // the librarian, with an armful of volumes
  s += standing(232, YB - 4, .64, { fur: 3, H: 60, bw: 24, tw: 1.1, hr: 11.5, ears: 'round', view: 'pr', gaze: [1, .5], eyes: 'open', mouth: 'smile', head: 'none', tail: true, shirt: 'sk-shade' },
    { hl: [-8, -26], hr: [12, -30], front: `<g><rect x="3" y="-40" width="24" height="5" fill="var(--alert)" stroke="var(--edge)" stroke-width=".8"/><rect x="2" y="-35" width="24" height="5" fill="var(--mustard)" stroke="var(--edge)" stroke-width=".8"/><rect x="4" y="-30" width="22" height="4.6" fill="var(--olive)" stroke="var(--edge)" stroke-width=".8"/></g>` });
  // the volume rack: one volume per tier
  s += pbox({ x: 262, yb: YB, w: 134, h: 14, d: 6, c: 'walnut', tabs: false });
  s += n.tiers.map((st, i) => volume(265 + i * 33, YB - 14, st, TIER_IDS[i], 30, 26)).join('');
  if (n.tiers.includes('researching')) s += `<g class="spark" style="--d:0s"><path d="M${265 + n.tiers.indexOf('researching') * 33 + 15} 30l2 5l5 2l-5 2l-2 5l-2 -5l-5 -2l5 -2z" fill="var(--mustard)" stroke="var(--edge)" stroke-width=".6"/></g>`;
  return s;
}

/* ===== floor 5: the Director's Office, the executive suite ===== */
function directorFloor(n) {
  let s = back('tw-dr') + hanging(160) + hanging(330);
  s += `<rect class="tw-rug" x="118" y="${YB - 5}" width="270" height="9" rx="2"/>`;
  // three readiness meters, filled live
  [['recruiting', 'R'], ['construction', 'C'], ['editing', 'E']].forEach(([id, ch], i) => {
    const x = 138 + i * 22;
    s += `<g><rect x="${x}" y="22" width="16" height="54" rx="2" fill="var(--screen)" stroke="var(--edge)" stroke-width="1.2"/><rect class="mbar" data-bar="${id}" x="${x + 2}" y="24" width="12" height="50" rx="1" fill="${['var(--tangerine)', 'var(--mustard)', 'var(--phosphor-green)'][i]}"/><text x="${x + 8}" y="${YB - 3.5}" style="font:700 8.6px var(--font-display);fill:var(--ink);text-anchor:middle">${ch}</text></g>`;
  });
  // the Permit panel on the wall: glowing and blank, or stamped
  const px = 318, py = 12;
  s += n.permit
    ? `<rect x="${px}" y="${py}" width="50" height="44" fill="var(--mustard)" stroke="var(--edge)" stroke-width="1.6"/><rect x="${px + 4}" y="${py + 4}" width="42" height="36" fill="var(--edge)" stroke="var(--screen)" stroke-width="1"/><path d="M${px + 8} ${py + 10}h30M${px + 8} ${py + 15}h30" stroke="var(--concrete)" stroke-width="1.2"/><g transform="rotate(-9 ${px + 25} ${py + 28})"><rect class="stampd" x="${px + 9}" y="${py + 21}" width="32" height="13" style="stroke-width:1.7"/><text class="stampt" x="${px + 25}" y="${py + 31}" style="font-size:8.4px">PERMIT</text></g><circle cx="${px + 25}" cy="${py + 47}" r="5" class="brass"/>`
    : `<polygon points="${px},${py} ${px + 50},${py} ${px + 46},${py + 44} ${px + 4},${py + 44}" fill="var(--glow)" stroke="var(--edge)" stroke-width="1.4"/><text x="${px + 25}" y="${py + 26}" style="font:700 7px var(--font-display);letter-spacing:.14em;fill:var(--screen);text-anchor:middle">PERMIT</text>`;
  // the Director behind the desk: a silhouette, a lamp and the waiting stamp
  s += `<g class="dsil" style="transform-origin:262px ${YB - 20}px"><rect class="sil" x="248" y="${YB - 58}" width="28" height="40" rx="11"/><circle class="sil" cx="262" cy="${YB - 58}" r="12"/><circle class="sil" cx="248" cy="${YB - 59}" r="5"/><circle class="sil" cx="276" cy="${YB - 59}" r="5"/></g>`;
  s += pbox({ x: 214, yb: YB, w: 106, h: 22, d: 7, c: 'walnut', extra: `<rect x="258" y="${YB - 16}" width="18" height="3.2" rx="1.2" class="brass"/><rect x="220" y="${YB - 20}" width="24" height="8" fill="var(--edge)" stroke="var(--concrete)" stroke-width=".7"/>` });
  s += `<rect x="292" y="${YB - 31}" width="20" height="9" fill="var(--mustard)" stroke="var(--edge)" stroke-width="1"/>` + (n.permit ? `<rect class="stampd" x="295" y="${YB - 30}" width="14" height="6" style="stroke-width:1.2"/>` : `<g class="dst"><rect x="299" y="${YB - 44}" width="3" height="13" fill="var(--walnut)" stroke="var(--edge)" stroke-width=".7"/><rect x="293" y="${YB - 34}" width="15" height="6" rx="1.4" class="ink"/></g>`);
  s += lamp(392, YB, 0).replace(/ry="26"/, 'ry="20"');
  return s;
}

/** The whole building as a function of state. */
export function buildTower(props) {
  const n = norm(props), key = JSON.stringify(n);
  const make = {
    director: directorFloor, research: researchFloor, departments: departmentsFloor, pool: poolFloor, personnel: personnelFloor,
  };
  const floors = ['director', 'research', 'departments', 'pool', 'personnel'].map((id) => ({ id, svg: make[id](n), viewBox: FLOOR_BOX[id] }));
  return { floors, key };
}

/** The roof (static): a water tank, a vent, an aerial and a flag. */
export function roofSVG() {
  return `<rect class="tw-roof" x="-260" y="14" width="920" height="12"/><path class="tw-edge" d="M-260 14H660"/>` +
    pbox({ x: 40, yb: 14, w: 26, h: 12, d: 5, c: 'concrete', tabs: false }) +
    `<path d="M48 2h10v12M53 14V2" stroke="var(--edge)" stroke-width="1.6" fill="none"/>` +
    `<g><rect class="fr c-steel" x="300" y="1" width="28" height="13" rx="2"/><path d="M304 14v6M324 14v6" stroke="var(--edge)" stroke-width="2"/><path d="M300 5h28" stroke="var(--screen)" stroke-width="1" opacity=".5"/></g>` +
    `<g><path d="M200 14V-6M192 -2l8 -4l8 4M194 2l6 -3l6 3" stroke="var(--edge)" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M360 14V-4" stroke="var(--screen)" stroke-width="1.4"/><path d="M360 -4l14 4l-14 4z" fill="var(--alert)" stroke="var(--edge)" stroke-width=".8"/></g>`;
}
