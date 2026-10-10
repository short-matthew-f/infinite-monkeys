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
import { banana } from './ceremony-art.js';

const W = 400, H = 96, YB = 86;
const TIER_IDS = ['letters', 'words', 'phrases', 'sentences'];
const DEPT_IDS = ['recruiting', 'construction', 'editing'];
export const FLOOR_BOX = { personnel: [W, 134], pool: [W, H], departments: [W, H], research: [W, H], director: [W, H] };
export const FLOOR_NAMES = { personnel: 'Personnel', pool: 'Typing Pool', departments: 'Departments', research: 'Records Library', director: "Director's Office" };
const DEPT_NAMES = { recruiting: 'Recruiting', construction: 'Construction', editing: 'Editing' };
/** After Infinity the same five floors keep their numbers and change their names (DESIGN.md section 4). */
export const HOTEL_NAMES = { personnel: 'Front Desk', pool: 'Typing Pool', departments: 'Staff', research: 'Records Library', director: "Director's Office" };
/** The three Departments wings become the hotel's crews. */
export const HOTEL_WINGS = { recruiting: 'Bus Wranglers', construction: 'Shift Crews', editing: 'Editors' };
/** Each market's bus is painted with its alphabet. */
export const MARKET_LOOK = {
  home: { name: 'Home', glyphs: 'Aa', short: 'Aa', paint: 'var(--mustard)' },
  cyrillic: { name: 'Cyrillic', glyphs: '\u042F\u0416\u0429', short: '\u042F', paint: 'var(--tangerine)' },
  greek: { name: 'Greek', glyphs: '\u03A9\u03A3\u039B', short: '\u03A9', paint: 'var(--olive)' },
};
export const marketLook = (id) => MARKET_LOOK[id] || { name: id.charAt(0).toUpperCase() + id.slice(1), glyphs: id.charAt(0).toUpperCase(), short: id.charAt(0).toUpperCase(), paint: 'var(--concrete)' };
export const KIND_NAMES = { immediate: 'Immediate', permanent: 'Permanent', expansion: 'Expansion' };
/** m:ss for a time left. */
export const mmss = (s) => { if (!Number.isFinite(s)) return '\u2013:\u2013\u2013'; const t = Math.max(0, Math.ceil(s)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
export const floorName = (id, p) => (p && p.hotel ? HOTEL_NAMES[id] : FLOOR_NAMES[id]);
export const wingName = (d, p) => (p && p.hotel ? HOTEL_WINGS[d] : DEPT_NAMES[d]);

/** The market whose bus is nearest: a bus on the road first, then one being seated. */
export function nextArrival(h) {
  const ms = (h && h.markets) || [];
  const by = (st) => ms.filter((m) => m.status === st).sort((a, b) => a.secondsLeft - b.secondsLeft)[0];
  return by('inTransit') || by('onboarding') || null;
}
/** The market split as words: only markets that are online and carry a share. */
export function splitParts(h) {
  return ((h && h.markets) || []).filter((m) => m.status === 'online' && m.share > 0.005).map((m) => ({ id: m.id, glyph: marketLook(m.id).short, name: marketLook(m.id).name, pct: Math.round(m.share * 100), share: m.share }));
}
const plural = (n, one, many) => `${count(n)} ${n === 1 ? one : many}`;

const count = (n) => Math.max(0, Math.floor(n)).toLocaleString('en-US');

/** What the building draws, with every cap applied once. The key is this object. */
function norm(p) {
  const seated = Math.max(0, Math.floor(p.seated || 0));
  const desks = Math.max(seated, Math.floor(p.desks || 0));
  const free = desks - seated;
  // Late game the desks and the monkeys sit within one of each other, so a free desk comes and goes.
  // With four seated the fourth desk is always drawn; it swaps seat for vacancy in place (patchLive), never a redraw.
  const drawn = seated >= 4 ? 4 : seated;
  const vac = seated >= 4 ? 0 : Math.min(free, 4 - drawn);
  const tierState = (id) => { const t = (p.tiers || []).find((x) => x.id === id); return t && ['researching', 'discovered'].includes(t.state) ? t.state : 'locked'; };
  const dept = (id) => { const d = (p.depts || {})[id] || {}; return [Math.min(5, Math.max(0, Math.floor(d.level || 0))), Math.min(4, Math.max(1, Math.floor(d.stage || 1)))]; };
  const e = Math.max(0, Math.floor(p.editors || 0));
  return {
    pool: [drawn, vac],
    tiers: TIER_IDS.map(tierState), depts: DEPT_IDS.map(dept),
    editors: e < 1 ? 0 : 1, permit: p.permit ? 1 : 0,
    // the amenities the Foreman has built
    amen: p.office && p.office.on ? [!!p.office.built.bathrooms, !!p.office.built.breakRoom, !!p.office.built.snackMachine].map(Number) : [0, 0, 0],
    // the hotel picture: which buses are parked or due, how many offers hang on the wall, how many Golden Bananas sit in the vault.
    // Times, shares and percentages are live text (patchLive) and never part of the key.
    hotel: p.hotel ? {
      buses: (p.hotel.markets || []).filter((m) => m.id !== 'home').map((m) => `${m.id}:${m.status}`),
      offers: Math.min(3, Math.max(0, Math.floor(p.hotel.offers || 0))), pinned: p.hotel.pinned ? 1 : 0,
      gold: Math.min(6, Math.max(0, Math.floor(p.hotel.golden || 0))),
    } : 0,
  };
}
export const towerKey = (p) => JSON.stringify(norm(p));

/** One line of status for a floor: the same words on the plate, the aria-label and the Directory. */
export function floorHint(id, p) {
  if (p.hotel) return hotelHint(id, p);
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
  if (p.hotel) return hotelTag(id, p);
  const seated = Math.max(0, Math.floor(p.seated || 0)), desks = Math.max(seated, Math.floor(p.desks || 0)), free = desks - seated;
  switch (id) {
    case 'personnel': return free > 0 ? `${count(free)} desk${free === 1 ? '' : 's'} free` : 'Desks full';
    case 'pool': return `${count(seated)} seated`;
    case 'research': { const d = (p.tiers || []).filter((t) => t.state === 'discovered').length; return `${d} of ${(p.tiers || []).length} tiers`; }
    case 'director': { if (p.permit) return 'Permit stamped'; const m = p.meters || {}; return `${DEPT_IDS.filter((k) => (m[k] || 0) >= 1 - 1e-9).length} of 3 meters`; }
    default: return floorHint(id, p);
  }
}
export function deptHint(id, p) {
  if (p.hotel) { const w = (p.hotel.staff || {})[id] || { level: 0, affordable: false }; return `Level ${count(w.level)}${w.affordable ? '. An upgrade is affordable' : ''}`; }
  const d = (p.depts || {})[id] || { level: 0, stage: 1 };
  return `Level ${count(d.level)}, stage ${d.stage} of 4`;
}

/** The short status on a hotel floor's rail. */
function hotelTag(id, p) {
  const h = p.hotel;
  switch (id) {
    case 'personnel': {
      const a = nextArrival(h);
      if (a) return `${marketLook(a.id).name} ${a.status === 'inTransit' ? 'bus' : 'seating'} ${mmss(a.secondsLeft)}`;
      return h.markets.some((m) => m.status === 'locked') ? 'No bus due' : 'All markets online';
    }
    case 'pool': { const parts = splitParts(h); return parts.length ? parts.map((x) => `${x.glyph} ${x.pct}`).join(' \u00B7 ') : 'No market online'; }
    case 'departments': return 'Editors, Bus Wranglers, Shift Crews';
    case 'research': return h.golden > 0 ? plural(h.golden, 'Golden Banana', 'Golden Bananas') : 'No Golden Bananas';
    case 'director': {
      if (h.pinned) return `${KIND_NAMES[h.pinned.kind] || 'Commission'} ${Math.round(h.pinned.frac * 100)}% \u00B7 ${mmss(h.pinned.secondsLeft)}`;
      if (h.reward) return 'Reward to use';
      return h.offers > 0 ? plural(h.offers, 'offer waiting', 'offers waiting') : 'No offers yet';
    }
    default: return '';
  }
}
/** The fuller sentence for the aria-label and the Directory. */
function hotelHint(id, p) {
  const h = p.hotel;
  switch (id) {
    case 'personnel': {
      const a = nextArrival(h), on = h.markets.filter((m) => m.status === 'online').length;
      const lead = a ? (a.status === 'inTransit' ? `${marketLook(a.id).name} bus arrives in ${mmss(a.secondsLeft)}` : `${marketLook(a.id).name} guests are being seated, ${mmss(a.secondsLeft)} left`) : 'No bus due';
      return `${lead}. ${on} of ${h.markets.length} markets online`;
    }
    case 'pool': { const parts = splitParts(h); return parts.length ? `Editors split: ${parts.map((x) => `${x.name} ${x.pct} percent`).join(', ')}` : 'No market online'; }
    case 'departments': { const up = ['recruiting', 'construction', 'editing'].filter((d) => ((h.staff || {})[d] || {}).affordable).map((d) => HOTEL_WINGS[d]); return up.length ? `Upgrade affordable: ${up.join(', ')}` : 'Editors, Bus Wranglers, Shift Crews'; }
    case 'research': return h.golden > 0 ? `${plural(h.golden, 'Golden Banana', 'Golden Bananas')} in the vault` : 'The vault is empty';
    case 'director': {
      if (h.pinned) return `${KIND_NAMES[h.pinned.kind] || 'Commission'} Commission pinned, ${Math.round(h.pinned.frac * 100)} percent delivered, ${mmss(h.pinned.secondsLeft)} left`;
      if (h.reward) return 'A completed Commission has a reward to use';
      return h.offers > 0 ? `${plural(h.offers, 'offer', 'offers')} waiting. Pin one` : 'No offers yet';
    }
    default: return '';
  }
}

const arrBoard = (p) => { const a = p.hotel && nextArrival(p.hotel); return a ? mmss(a.secondsLeft) : '\u2014'; };
/** Patches the live numbers in place: [data-live] text, [data-bar] meter fills. */
export function patchLive(root, p) {
  const live = {};
  for (const el of root.querySelectorAll('[data-live]')) {
    const k = el.dataset.live;
    const v = k in live ? live[k] : k.startsWith('name:') ? floorName(k.slice(5), p) : k.startsWith('wname:') ? wingName(k.slice(6), p) : k === 'arr-board' ? arrBoard(p) : k.startsWith('lv:') && p.hotel ? count((((p.hotel.staff || {})[k.slice(3)]) || {}).level || 0) : k.startsWith('lv:') ? count(((p.depts || {})[k.slice(3)] || {}).level || 0) : DEPT_IDS.includes(k) ? `${DEPT_NAMES[k]} Lv ${count((p.depts[k] || {}).level || 0)}` : k === 'free-board' ? String(Math.max(0, Math.floor(p.desks) - Math.floor(p.seated))) : floorTag(k, p);
    if (el.textContent !== v) el.textContent = v;
  }
  for (const el of root.querySelectorAll('[data-bar]')) {
    const v = `scaleY(${Math.max(0.03, Math.min(1, (p.meters || {})[el.dataset.bar] || 0)).toFixed(2)})`;
    if (el.style.transform !== v) el.style.transform = v;
  }
  // the waiting candidate and the fourth desk's vacancy: toggled in place, never part of the picture
  const free = Math.max(0, Math.floor(p.desks) - Math.floor(p.seated));
  for (const el of root.querySelectorAll('[data-cand]')) {
    const v = p.candidate ? '' : 'none';
    if (el.style.display !== v) el.style.display = v;
  }
  for (const el of root.querySelectorAll('[data-vx]')) {
    if (el.classList.contains('vacant') !== free > 0) el.classList.toggle('vacant', free > 0);
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
const ka = (name, svg) => `<g data-keyart="${name}">${svg}</g>`;
const seat = (i, cx, yb, k, o) => `<g data-keyart="monkey" transform="translate(${cx} ${yb}) scale(${k})">${seatSVG(i, 0, 0, o || {})}</g>`;
const mark = (cx, yb, k, faint) => `<g transform="translate(${cx} ${yb}) scale(${k})">${deskMark(0, 0, 64, faint, '')}</g>`;
const standing = (x, y, k, s, pose) => `<g data-keyart="figure" transform="translate(${x} ${y}) scale(${k})">${stand(s, pose)}</g>`;

/* ===== floor 1: street, lobby and Personnel ===== */
const CLERK = { fur: 3, H: 56, bw: 30, tw: 1.1, hr: 12.5, ears: 'round', lean: 0, view: 'f', gaze: [.5, .6], eyes: 'open', mouth: 'smile', head: 'glassesR', body: 'bowtie', tail: 'curl', prop: 4, ps: 1, beh: 'slam', shirt: 'sk-paper', chair: 'round' };
function personnelFloor(n) {
  const yb = 88, FH = 134;
  let s = back('tw-pe', FH, yb) + hanging(190) + hanging(330);
  // the lobby door, with its sign, and a welcome mat
  s += ka('lobby-door', pbox({ x: 126, yb, w: 34, h: 56, d: 7, c: 'concrete', tabs: false, extra: `<rect x="130" y="${yb - 51}" width="26" height="51" fill="var(--glow)" stroke="var(--edge)" stroke-width="1.2"/><polygon points="130,${yb - 51} 130,${yb} 119,${yb + 4} 119,${yb - 55}" fill="var(--olive)" stroke="var(--edge)" stroke-width="1.1"/><circle cx="122" cy="${yb - 26}" r="1.6" class="brass"/>` }));
  s += `<rect class="fr c-mustard" x="124" y="${yb - 70}" width="38" height="9" rx="1.5"/><text class="sg sm" x="143" y="${yb - 62.6}" style="font-size:7.4px;letter-spacing:.1em">LOBBY</text>`;
  s += ficus(182, yb, .55);
  // More bathrooms: a second door by the lobby, once the Foreman has built it
  if (n.amen[0]) s += pbox({ x: 70, yb, w: 30, h: 48, d: 6, c: 'concrete', tabs: false, extra: `<rect x="74" y="${yb - 43}" width="22" height="43" fill="var(--screen)" stroke="var(--edge)" stroke-width="1.1"/><path d="M76 ${yb - 41}L92 ${yb - 38}V${yb}H76Z" fill="var(--walnut)" stroke="var(--edge)" stroke-width="1.1"/><circle cx="89" cy="${yb - 22}" r="1.4" class="brass"/><rect x="73" y="${yb - 58}" width="24" height="9" rx="1.5" class="brass"/><text class="sg sm" x="85" y="${yb - 51}" style="font-size:7px">WC</text>` });
  // the clerk's desk and the filing cabinet
  s += seat(41, 236, yb, .74, { over: CLERK });
  s += ka('cabinet', pbox({ x: 288, yb, w: 28, h: 46, d: 7, c: 'steel', extra: drawers(288, yb - 40, 28, 2, 18, false) }));
  if (n.hotel) return personnelHotel(s, n, yb, FH);
  // a board that counts the free desks
  s += `<g class="up" data-keyart="free-desks-board" style="transform-origin:352px ${yb}px"><rect class="fr c-mustard" x="326" y="22" width="52" height="34" rx="2"/><rect x="330" y="26" width="44" height="26" fill="var(--screen)" stroke="var(--edge)" stroke-width=".8"/>` +
    `<text x="352" y="34.4" style="font:700 6.6px var(--font-display);letter-spacing:.14em;fill:var(--screen-muted);text-anchor:middle;text-transform:uppercase">Free desks</text><text data-live="free-board" x="352" y="48" style="font:600 13px var(--font-mono);fill:var(--screen-ink);text-anchor:middle"></text></g>`;
  // the street: kerb, road, the applicants' bus
  s += `<rect class="tw-walk" x="-260" y="${yb + 10}" width="920" height="7"/><path class="tw-edge" d="M-260 ${yb + 10}H660"/><rect class="tw-road" x="-260" y="${yb + 17}" width="920" height="${FH - yb - 17}"/><path d="M-260 ${yb + 30}H660" stroke="var(--mustard)" stroke-width="1.6" stroke-dasharray="10 9" opacity=".8"/>`;
  s += `<g><rect x="262" y="${yb + 2}" width="104" height="24" rx="5" fill="var(--mustard)" stroke="var(--edge)" stroke-width="1.6"/><rect x="270" y="${yb + 6}" width="78" height="8" fill="color-mix(in srgb, var(--glow) 60%, var(--edge))" stroke="var(--screen)" stroke-width=".6"/><rect x="268" y="${yb + 17}" width="70" height="6" fill="var(--screen)"/><text x="303" y="${yb + 22.4}" style="font:700 5.2px var(--font-display);letter-spacing:.12em;fill:var(--screen-ink);text-anchor:middle">APPLICANTS</text><circle cx="284" cy="${yb + 27}" r="5" fill="var(--screen)" stroke="var(--edge)"/><circle cx="346" cy="${yb + 27}" r="5" fill="var(--screen)" stroke="var(--edge)"/></g>`;
  s += `<g data-cand data-keyart="candidate" transform="translate(238 ${yb + 22}) scale(.6)"><g id="t-cand" class="cand">${stand(Object.assign({}, CANDIDATE, { H: 58, bw: 24 }), { hl: [-9, -26], hr: [12, -22], front: `<rect x="10" y="-26" width="22" height="16" rx="2" fill="var(--walnut)" stroke="var(--edge)" stroke-width="1.2"/><path d="M16 -26v-4h10v4" fill="none" stroke="var(--edge)" stroke-width="1.6"/><rect x="19" y="-20" width="4" height="4" class="brass"/>` })}</g></g>`;
  s += `<g class="tw-fx"></g>`;
  return s;
}

/** A bus painted with its market's alphabet: three big letters in the windows, the name on the destination board. */
export function busSVG(market, x, yb = 88) {
  const m = marketLook(market), y = yb + 4;
  const g = Array.from(m.glyphs);
  const win = [0, 1, 2].map((i) => `<rect x="${x + 7 + i * 31}" y="${y + 4}" width="27" height="15" rx="1.5" fill="color-mix(in srgb, var(--glow) 70%, var(--edge))" stroke="var(--screen)" stroke-width=".8"/><text x="${x + 20.5 + i * 31}" y="${y + 16}" style="font:700 14px var(--font-display);fill:var(--screen);text-anchor:middle">${g[i % g.length]}</text>`).join('');
  return `<g class="bus bus-${market}" data-keyart="bus"><rect x="${x}" y="${y}" width="110" height="30" rx="6" fill="${m.paint}" stroke="var(--edge)" stroke-width="1.6"/>${win}` +
    `<rect x="${x + 6}" y="${y + 21}" width="76" height="7" fill="var(--screen)"/><text x="${x + 44}" y="${y + 26.6}" style="font:700 6px var(--font-display);letter-spacing:.14em;fill:var(--screen-ink);text-anchor:middle;text-transform:uppercase">${m.name}</text>` +
    `<rect x="${x + 98}" y="${y + 6}" width="9" height="12" rx="1.5" fill="var(--screen)" opacity=".55"/><circle cx="${x + 24}" cy="${y + 31}" r="5.2" fill="var(--screen)" stroke="var(--edge)"/><circle cx="${x + 88}" cy="${y + 31}" r="5.2" fill="var(--screen)" stroke="var(--edge)"/></g>`;
}

/** Floor 1 after Infinity: the Front Desk. The lobby stays; the applicants' bus is gone and the markets' buses park on the street. */
function personnelHotel(s, n, yb, FH) {
  // an arrivals board where the free-desk board hung
  s += `<g class="up" data-keyart="arrivals-board" style="transform-origin:352px ${yb}px"><rect class="fr c-mustard" x="320" y="22" width="64" height="34" rx="2"/><rect x="324" y="26" width="56" height="26" fill="var(--screen)" stroke="var(--edge)" stroke-width=".8"/>` +
    `<text x="352" y="34.4" style="font:700 6.6px var(--font-display);letter-spacing:.14em;fill:var(--screen-muted);text-anchor:middle;text-transform:uppercase">Next bus</text><text data-live="arr-board" x="352" y="48" style="font:600 13px var(--font-mono);fill:var(--screen-ink);text-anchor:middle"></text></g>`;
  s += `<rect class="tw-walk" x="-260" y="${yb + 10}" width="920" height="7"/><path class="tw-edge" d="M-260 ${yb + 10}H660"/><rect class="tw-road" x="-260" y="${yb + 17}" width="920" height="${FH - yb - 17}"/><path d="M-260 ${yb + 30}H660" stroke="var(--mustard)" stroke-width="1.6" stroke-dasharray="10 9" opacity=".8"/>`;
  let slot = 0;
  const xs = [262, 130];
  for (const b of n.hotel.buses) {
    const [id, st] = b.split(':');
    if (st === 'onboarding') s += busSVG(id, xs[slot++ % xs.length], yb);
  }
  // a bus stop where a bus is due: a sign on a post, with the alphabet on it
  const due = n.hotel.buses.map((b) => b.split(':')).filter(([, st]) => st === 'inTransit');
  if (due.length) {
    const m = marketLook(due[0][0]);
    s += `<g data-keyart="bus-stop"><rect x="318" y="${yb - 14}" width="3.4" height="26" fill="var(--screen)"/><rect class="fr c-mustard" x="300" y="${yb - 24}" width="40" height="15" rx="2"/><text x="320" y="${yb - 12.6}" style="font:700 12px var(--font-display);fill:var(--screen);text-anchor:middle">${m.short} \u2192</text></g>`;
  }
  s += `<g class="tw-fx"></g>`;
  return s;
}

/* ===== floor 2: the Typing Pool ===== */
function poolFloor(n) {
  const xs = [178, 236, 294, 352], k = .66;
  let s = back('tw-pl') + hanging(150) + hanging(300) + clock(62, 34) + (n.hotel ? '' : ficus(104, YB, .6));
  const [drawn, vac] = n.pool;
  for (let i = 0; i < 4; i++) {
    if (i === 3 && drawn === 4) s += seat(i, xs[i], YB, k, { vx: true });
    else if (i < drawn) s += seat(i, xs[i], YB, k);
    else if (i < drawn + vac) s += seat(i, xs[i], YB, k, { vacant: true });
    else s += mark(xs[i], YB, k, i > drawn + vac);
  }
  // After Infinity the pool never ends: more desks recede to the left, smaller and paler, into the distance.
  if (n.hotel) {
    s += [[132, .5, .8, 0], [104, .42, .6, 1], [80, .34, .46, 0], [60, .27, .34, 1], [44, .21, .24, 0], [32, .16, .16, 1]]
      .map(([cx, k, o, i], j) => `<g opacity="${o}" data-keyart="far-desk">${j < 2 ? seat(i + 10 + j, cx, YB - j * 2, k) : mark(cx, YB - j * 2, k, true)}</g>`).join('');
  }
  // Break room (a nook with a couch) and the snack machine, once built
  if (n.amen[1]) s += `<rect x="108" y="46" width="34" height="${YB - 46}" fill="color-mix(in srgb, var(--olive) 30%, var(--screen))" opacity=".5" stroke="var(--edge)" stroke-width="1.2" stroke-dasharray="4 3"/><g><rect x="112" y="${YB - 20}" width="26" height="9" rx="4" fill="color-mix(in srgb, var(--alert) 55%, var(--walnut))" stroke="var(--edge)" stroke-width="1.2"/><rect x="109" y="${YB - 14}" width="32" height="12" rx="4" fill="color-mix(in srgb, var(--alert) 65%, var(--walnut))" stroke="var(--edge)" stroke-width="1.2"/></g><rect x="110" y="40" width="30" height="8" rx="1.5" class="brass"/><text class="sg sm" x="125" y="46.2" style="font-size:5.6px">BREAK ROOM</text>`;
  if (n.amen[2]) s += `<g><rect class="fr c-steel" x="144" y="${YB - 42}" width="14" height="42" rx="1.5"/><rect x="146" y="${YB - 38}" width="10" height="20" fill="var(--screen)"/><path d="M147 ${YB - 32}h8M147 ${YB - 26}h8" stroke="var(--mustard)" stroke-width="2"/><rect x="146" y="${YB - 13}" width="10" height="5" fill="var(--screen)"/></g>`;
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
  s += ka('cabinet', pbox({ x: 10, yb: YB, w: 34, h: hA, d: 7, c: 'steel', extra: drawers(10, YB - hA + 5, 34, rA, 12, false) }));
  s += standing(88, YB - 6, .66, { fur: 1, H: 62, bw: 26, tw: 1.1, hr: 12, ears: 'big', view: 'pl', gaze: [-1, .3], eyes: 'open', mouth: 'smile', head: 'phones', tail: true, shirt: 'sk-rust' }, { hr: [-13, -50], hl: [-6, -22], xr: `<path d="M-10 -52l-5 3v8l5 -3z" fill="var(--screen)" stroke="var(--edge)" stroke-width="1"/>` });
  s += `<g><rect class="fr c-concrete" x="104" y="${YB - 11}" width="22" height="11" rx="1.5"/><path d="M108 ${YB - 11}q0 -7 6 -6t6 6" fill="none" stroke="var(--screen)" stroke-width="2.4" stroke-linecap="round"/></g>`;
  s += stageLamps(124, 68, sr);
  // Construction: a desk frame going up, planks, the Foreman with a hammer
  const plank = Math.min(1 + lc, 4);
  s += Array.from({ length: plank }, (_, k) => `<rect class="fr c-walnut" x="${140 + (k % 2) * 3}" y="${YB - 5 - k * 5}" width="34" height="4.6" rx="1"/>`).join('');
  s += ka('desk-frame', pbox({ x: 182, yb: YB, w: 40, h: 24, d: 7, c: 'walnut', extra: `<path d="M184 ${YB - 24}v-22M220 ${YB - 24}v-22M184 ${YB - 46}h36" stroke="var(--edge)" stroke-width="2" stroke-dasharray="4 3" fill="none"/>` }));
  s += standing(246, YB - 6, .66, { fur: 4, H: 64, bw: 28, tw: 1.1, hr: 12, ears: 'tuft', view: 'pl', gaze: [-1, .4], eyes: 'open', mouth: 'smirk', head: 'none', tail: true, shirt: 'sk-mustard', beh: 'slam' },
    { hl: [-8, -24], hr: [-14, -40], front: hardhat(64) + `<g class="hammer" style="transform-origin:-14px -40px"><rect x="-17" y="-50" width="3" height="16" fill="var(--walnut)" stroke="var(--edge)" stroke-width=".8"/><rect x="-23" y="-54" width="14" height="7" rx="1.4" fill="var(--concrete)" stroke="var(--edge)" stroke-width=".9"/></g>` });
  s += stageLamps(257, 68, sc);
  // Editing: the Chief Editor seated at the in-tray, a second desk once Editors are hired
  s += seat(40, 322, YB, .72, { over: EDITOR, dw: 84 });
  if (n.editors) s += seat(42, 288, YB, .5, { over: Object.assign({}, EDITOR, { fur: 2, H: 54, bw: 40, hr: 13, view: 'pr', gaze: [1, .3], head: 'none', body: 'cardigan', shirt: 'sk-paper', chair: 'short', flange: false, ears: 'tuft', lean: -5 }), dw: 64 });
  // the in-tray: two sheets, or a pile to the ceiling when finds are going unreviewed
  // Both states are drawn; the wing's `piled` class (tower.ts) shows the pile and the warning, so the picture never redraws when the bottleneck flips.
  const sheets = 11;
  s += `<g class="pile" data-keyart="in-tray">` + pbox({ x: 358, yb: YB, w: 30, h: 12, d: 6, c: 'walnut', tabs: false, extra: '' }) +
    Array.from({ length: sheets }, (_, k) => `<rect class="page${k >= 2 ? ' pgx' : ''}" x="${360 + (k % 3) * 2 - (k > 6 ? 3 : 0)}" y="${YB - 16 - k * 4.4}" width="${27 - (k % 2) * 2}" height="4" rx=".8" transform="rotate(${((k * 37) % 9) - 4} 372 ${YB - 14 - k * 4.4})"/>`).join('') + `</g>`;
  s += `<g class="pgx"><path d="M392 ${YB - 62}l9 15h-18z" fill="var(--alert)" stroke="var(--edge)" stroke-width="1.4" stroke-linejoin="round"/><path d="M392 ${YB - 58}v7" stroke="var(--edge)" stroke-width="2" stroke-linecap="round"/><circle cx="392" cy="${YB - 48.5}" r="1.2" fill="var(--edge)"/></g>`;
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
  s += ka('bookcase', pbox({ x: bx, yb: YB, w: bw, h: bh, d: 8, c: 'walnut', extra: `<rect x="${bx + 3}" y="${YB - bh + 4}" width="${bw - 6}" height="${bh - 8}" fill="var(--screen)" opacity=".6"/>${shelves}<rect x="${bx + 3}" y="${YB - bh + 4}" width="${bw - 6}" height="${bh - 8}" fill="none" stroke="var(--edge)" stroke-width=".9"/>` }));
  // the librarian, with an armful of volumes
  s += standing(232, YB - 4, .64, { fur: 3, H: 60, bw: 24, tw: 1.1, hr: 11.5, ears: 'round', view: 'pr', gaze: [1, .5], eyes: 'open', mouth: 'smile', head: 'none', tail: true, shirt: 'sk-shade' },
    { hl: [-8, -26], hr: [12, -30], front: `<g><rect x="3" y="-40" width="24" height="5" fill="var(--alert)" stroke="var(--edge)" stroke-width=".8"/><rect x="2" y="-35" width="24" height="5" fill="var(--mustard)" stroke="var(--edge)" stroke-width=".8"/><rect x="4" y="-30" width="22" height="4.6" fill="var(--olive)" stroke="var(--edge)" stroke-width=".8"/></g>` });
  if (n.hotel) return researchHotel(s, n);
  // the volume rack: one volume per tier
  s += pbox({ x: 262, yb: YB, w: 134, h: 14, d: 6, c: 'walnut', tabs: false });
  s += n.tiers.map((st, i) => ka('volume', volume(265 + i * 33, YB - 14, st, TIER_IDS[i], 30, 26))).join('');
  if (n.tiers.includes('researching')) s += `<g class="spark" style="--d:0s"><path d="M${265 + n.tiers.indexOf('researching') * 33 + 15} 30l2 5l5 2l-5 2l-2 5l-2 -5l-5 -2l5 -2z" fill="var(--mustard)" stroke="var(--edge)" stroke-width=".6"/></g>`;
  return s;
}

/** Floor 4 after Infinity: the shelves stay; the volume rack gives way to the Golden Banana vault. */
function researchHotel(s, n) {
  const x = 270, w = 118, h = 62, g = n.hotel.gold;
  s += pbox({ x, yb: YB, w, h, d: 8, c: 'steel', extra: `<rect x="${x + 8}" y="${YB - h + 8}" width="${w - 38}" height="${h - 16}" rx="2" fill="var(--screen)" stroke="var(--edge)" stroke-width="1"/>` +
    Array.from({ length: 6 }, (_, i) => i < g ? `<g data-keyart="golden-banana"><ellipse cx="${x + 20 + (i % 3) * 22}" cy="${YB - 34 + Math.floor(i / 3) * 20}" rx="13" ry="7" fill="var(--glow)" opacity=".35"/>${banana(x + 20 + (i % 3) * 22, YB - 30 + Math.floor(i / 3) * 20, .78)}</g>` : `<path d="M${x + 12 + (i % 3) * 22} ${YB - 30 + Math.floor(i / 3) * 20}h16" stroke="var(--concrete)" stroke-width="1.2" stroke-dasharray="3 2" opacity=".6"/>`).join('') +
    `<circle cx="${x + w - 15}" cy="${YB - h / 2 - 4}" r="9" class="brass"/><circle cx="${x + w - 15}" cy="${YB - h / 2 - 4}" r="3" fill="var(--screen)"/><path d="M${x + w - 15} ${YB - h / 2 - 13}v18M${x + w - 24} ${YB - h / 2 - 4}h18" stroke="var(--screen)" stroke-width="1.4"/>` +
    `<rect x="${x + 22}" y="${YB - h - 3}" width="${w - 44}" height="9" rx="1.5" class="brass"/><text class="sg sm" x="${x + w / 2}" y="${YB - h + 4}" style="font-size:7px">VAULT</text>` });
  return s;
}

/* ===== floor 5: the Director's Office, the executive suite ===== */
function directorFloor(n) {
  let s = back('tw-dr') + hanging(160) + hanging(330);
  s += `<rect class="tw-rug" x="118" y="${YB - 5}" width="270" height="9" rx="2"/>`;
  if (n.hotel) return directorHotel(s, n);
  // three readiness meters, filled live
  [['recruiting', 'R'], ['construction', 'C'], ['editing', 'E']].forEach(([id, ch], i) => {
    const x = 138 + i * 22;
    s += `<g data-keyart="meter"><rect x="${x}" y="22" width="16" height="54" rx="2" fill="var(--screen)" stroke="var(--edge)" stroke-width="1.2"/><rect class="mbar" data-bar="${id}" x="${x + 2}" y="24" width="12" height="50" rx="1" fill="${['var(--tangerine)', 'var(--mustard)', 'var(--phosphor-green)'][i]}"/><text x="${x + 8}" y="${YB - 3.5}" style="font:700 8.6px var(--font-display);fill:var(--ink);text-anchor:middle">${ch}</text></g>`;
  });
  // the Permit panel on the wall: glowing and blank, or stamped
  const px = 318, py = 12;
  s += n.permit
    ? `<g data-keyart="permit"><rect x="${px}" y="${py}" width="50" height="44" fill="var(--mustard)" stroke="var(--edge)" stroke-width="1.6"/><rect x="${px + 4}" y="${py + 4}" width="42" height="36" fill="var(--edge)" stroke="var(--screen)" stroke-width="1"/><path d="M${px + 8} ${py + 10}h30M${px + 8} ${py + 15}h30" stroke="var(--concrete)" stroke-width="1.2"/><g transform="rotate(-9 ${px + 25} ${py + 28})"><rect class="stampd" x="${px + 9}" y="${py + 21}" width="32" height="13" style="stroke-width:1.7"/><text class="stampt" x="${px + 25}" y="${py + 31}" style="font-size:8.4px">PERMIT</text></g><circle cx="${px + 25}" cy="${py + 47}" r="5" class="brass"/></g>`
    : `<g data-keyart="permit"><polygon points="${px},${py} ${px + 50},${py} ${px + 46},${py + 44} ${px + 4},${py + 44}" fill="var(--glow)" stroke="var(--edge)" stroke-width="1.4"/><text x="${px + 25}" y="${py + 26}" style="font:700 7px var(--font-display);letter-spacing:.14em;fill:var(--screen);text-anchor:middle">PERMIT</text></g>`;
  // the Director behind the desk: a silhouette, a lamp and the waiting stamp
  s += `<g class="dsil" data-keyart="director" style="transform-origin:262px ${YB - 20}px"><rect class="sil" x="248" y="${YB - 58}" width="28" height="40" rx="11"/><circle class="sil" cx="262" cy="${YB - 58}" r="12"/><circle class="sil" cx="248" cy="${YB - 59}" r="5"/><circle class="sil" cx="276" cy="${YB - 59}" r="5"/></g>`;
  s += ka('director-desk', pbox({ x: 214, yb: YB, w: 106, h: 22, d: 7, c: 'walnut', extra: `<rect x="258" y="${YB - 16}" width="18" height="3.2" rx="1.2" class="brass"/><rect x="220" y="${YB - 20}" width="24" height="8" fill="var(--edge)" stroke="var(--concrete)" stroke-width=".7"/>` }));
  s += `<rect x="292" y="${YB - 31}" width="20" height="9" fill="var(--mustard)" stroke="var(--edge)" stroke-width="1"/>` + (n.permit ? `<rect class="stampd" x="295" y="${YB - 30}" width="14" height="6" style="stroke-width:1.2"/>` : `<g class="dst"><rect x="299" y="${YB - 44}" width="3" height="13" fill="var(--walnut)" stroke="var(--edge)" stroke-width=".7"/><rect x="293" y="${YB - 34}" width="15" height="6" rx="1.4" class="ink"/></g>`);
  s += lamp(392, YB, 0).replace(/ry="26"/, 'ry="20"');
  return s;
}

/** Floor 5 after Infinity: the meters and the Permit give way to the Commissions board. Offers hang as playbills; a pinned one wears a pin. */
function directorHotel(s, n) {
  const h = n.hotel;
  s += `<rect class="fr c-mustard" x="124" y="8" width="100" height="10" rx="1.5"/><text class="sg sm" x="174" y="16" style="font-size:7.4px;letter-spacing:.14em">COMMISSIONS</text>`;
  for (let i = 0; i < 3; i++) {
    const x = 126 + i * 34, hung = i < h.offers + h.pinned, pin = h.pinned && i === 0;
    s += hung
      ? `<g data-keyart="playbill" transform="rotate(${[-2, 1.5, -1][i]} ${x + 14} 40)"><rect x="${x}" y="22" width="28" height="38" fill="var(--edge)" stroke="var(--screen)" stroke-width="1.2"/><rect x="${x + 3}" y="25" width="22" height="9" fill="${['var(--tangerine)', 'var(--mustard)', 'var(--olive)'][i]}"/><path d="M${x + 4} 39h20M${x + 4} 44h20M${x + 4} 49h13" stroke="var(--screen)" stroke-width="1.3" opacity=".7"/><circle cx="${x + 14}" cy="22" r="2.6" class="${pin ? 'brass' : 'ink'}"/></g>`
      : `<rect x="${x}" y="22" width="28" height="38" fill="none" stroke="var(--concrete)" stroke-width="1.2" stroke-dasharray="4 3" opacity=".7"/>`;
  }
  s += `<g class="dsil" data-keyart="director" style="transform-origin:262px ${YB - 20}px"><rect class="sil" x="248" y="${YB - 58}" width="28" height="40" rx="11"/><circle class="sil" cx="262" cy="${YB - 58}" r="12"/><circle class="sil" cx="248" cy="${YB - 59}" r="5"/><circle class="sil" cx="276" cy="${YB - 59}" r="5"/></g>`;
  s += ka('director-desk', pbox({ x: 214, yb: YB, w: 106, h: 22, d: 7, c: 'walnut', extra: `<rect x="258" y="${YB - 16}" width="18" height="3.2" rx="1.2" class="brass"/><rect x="220" y="${YB - 20}" width="24" height="8" fill="var(--edge)" stroke="var(--concrete)" stroke-width=".7"/>` }));
  // the stamp that used to wait for the Permit now waits for a signature
  s += `<rect x="292" y="${YB - 31}" width="20" height="9" fill="var(--mustard)" stroke="var(--edge)" stroke-width="1"/><rect class="stampd" x="295" y="${YB - 30}" width="14" height="6" style="stroke-width:1.2"/>`;
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

/** After Infinity the roof is the sky: ghost floors stack upward and fade out. A brass plaque, and a few windows that twinkle. */
export function skySVG() {
  const rows = [[26, 1], [2, .78], [-22, .52], [-46, .3]];
  const label = ['\u2135\u2080', 'n + 1', '\u2026', '\u221E'];
  let s = '';
  rows.forEach(([yb, o], r) => {
    s += `<g opacity="${o}" data-keyart="ghost-floor"><rect x="-260" y="${yb - 24}" width="920" height="24" class="tw-ghost"/><path class="tw-edge" d="M-260 ${yb - 24}H660"/>`;
    for (let i = 0; i < 14; i++) {
      const x = 14 + i * 28 + (hash(r * 31 + i) % 3);
      if (r === 0 && (i < 3 || i > 9)) continue; // the plaque (left) and the deadline clock (right) sit here
      const lit = hash(r * 17 + i * 5) % 3 !== 0, tw = lit && hash(r * 13 + i) % 5 === 0;
      s += `<rect class="tw-win${lit ? ' lit' : ''}${tw ? ' tw' : ''}" style="${tw ? `--d:${(hash(i + r) % 40) / 10}s` : ''}" x="${x}" y="${yb - 17}" width="11" height="9"/>`;
    }
    s += `</g>`;
  });
  s += `<g data-keyart="plaque"><rect class="brass" x="14" y="4" width="84" height="19" rx="2.5"/><text class="sg" x="56" y="17.6" style="font:700 13px var(--font-display);letter-spacing:.1em">${label[0]} FLOORS</text></g>`;
  s += `<text x="200" y="-52" class="tw-inf">${label[3]}</text>`;
  return s;
}
