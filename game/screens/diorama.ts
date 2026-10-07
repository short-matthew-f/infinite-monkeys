// Diorama: a cross-section of the Bureau. Monkeys type, an Editor stamps, the
// first window opens after the 'office' milestone, and the building gains
// floors as milestones are reached (office -> building -> tall).
//
// Figures are capped (a few dozen SVG groups at most). Scale is carried by the
// caption ("Seated x1.2M") and by the floors fading out of frame at 'tall'.
// The SVG is rebuilt only when the drawn picture changes, never every render.
import { N, deptOutput } from '../../core/index.js';
import type { Ctx, Screen } from '../ctx.js';
import { h, text } from '../ui/dom.js';
import * as f from '../ui/format.js';
import './diorama.css';

// Geometry (viewBox units).
const VW = 360;
const VH = 124;
const GROUND_Y = 118; // top of the ground strip
const ROW_H = 38; // one floor, including its ceiling band and slab
const CEIL = 4;
const SLAB = 4;
const SLOT_X = 12;
const SLOT_W = 44;
const DESK_SLOTS = 5; // monkeys per floor; slot 5 is the editor's station
const SCALE = 0.85; // glyph scale

const VIEWS = ['Street level', 'City skyline', 'Above the clouds'] as const;

const glyphMonkey = (i: number): string => {
  const d = (i * 0.17) % 0.6;
  return `<g transform="scale(${SCALE})">
<rect class="dio-chair" x="9" y="-21" width="3" height="21"/>
<rect class="dio-shirt" x="14" y="-23" width="11" height="12" rx="2"/>
<circle class="dio-fur" cx="14.5" cy="-29" r="2"/><circle class="dio-fur" cx="25.5" cy="-29" r="2"/>
<circle class="dio-fur" cx="20" cy="-28" r="6"/>
<ellipse class="dio-muzzle" cx="20" cy="-26" rx="3.4" ry="2.4"/>
<circle class="dio-stampbase" cx="18" cy="-29" r="0.8"/><circle class="dio-stampbase" cx="22" cy="-29" r="0.8"/>
<rect class="dio-desk" x="4" y="-11" width="40" height="3"/>
<line class="dio-leg" x1="7" y1="-8" x2="7" y2="0"/><line class="dio-leg" x1="41" y1="-8" x2="41" y2="0"/>
<rect class="dio-key" x="15" y="-14" width="14" height="3"/>
<line class="dio-arm" style="animation-delay:-${d.toFixed(2)}s" x1="17" y1="-20" x2="19" y2="-14"/>
<line class="dio-arm" style="animation-delay:-${(d + 0.3).toFixed(2)}s" x1="24" y1="-20" x2="25" y2="-14"/>
</g>`;
};

const glyphDesk = (): string => `<g transform="scale(${SCALE})">
<rect class="dio-chair" x="9" y="-21" width="3" height="21"/>
<rect class="dio-desk" x="4" y="-11" width="40" height="3"/>
<line class="dio-leg" x1="7" y1="-8" x2="7" y2="0"/><line class="dio-leg" x1="41" y1="-8" x2="41" y2="0"/>
<rect class="dio-key" x="15" y="-14" width="14" height="3"/>
</g>`;

const glyphEditor = (): string => `<g transform="scale(${SCALE})">
<rect class="dio-white" x="14" y="-23" width="11" height="12" rx="2"/>
<polygon class="dio-tie" points="19.2,-23 20.8,-23 21.2,-15 20,-13.5 18.8,-15"/>
<circle class="dio-fur" cx="14.5" cy="-29" r="2"/><circle class="dio-fur" cx="25.5" cy="-29" r="2"/>
<circle class="dio-fur" cx="20" cy="-28" r="6"/>
<ellipse class="dio-muzzle" cx="20" cy="-26" rx="3.4" ry="2.4"/>
<circle class="dio-stampbase" cx="18" cy="-29" r="0.8"/><circle class="dio-stampbase" cx="22" cy="-29" r="0.8"/>
<rect class="dio-desk" x="4" y="-11" width="40" height="3"/>
<line class="dio-leg" x1="7" y1="-8" x2="7" y2="0"/><line class="dio-leg" x1="41" y1="-8" x2="41" y2="0"/>
<rect class="dio-white" x="28" y="-14" width="13" height="3"/>
<g class="dio-stamp"><line class="dio-arm" x1="25" y1="-20" x2="33" y2="-19"/><rect class="dio-stampbase" x="31" y="-21" width="5" height="4" rx="0.8"/><rect class="dio-ink" x="31" y="-17.2" width="5" height="1.4"/></g>
</g>`;

const viewMarkup = (view: number): string => {
  if (view === 0) {
    // Street level: low buildings, a lamp post, pavement.
    return `<rect class="dio-glass-bg" x="288" y="0" width="60" height="38"/>
<rect class="dio-bld" x="294" y="20" width="12" height="12"/><rect class="dio-bld2" x="308" y="23" width="14" height="9"/>
<rect class="dio-bld" x="324" y="21" width="14" height="11"/>
<rect class="dio-ink" x="316" y="18" width="1" height="14"/>
<rect class="dio-ground" x="288" y="30" width="60" height="8"/>`;
  }
  if (view === 1) {
    // City skyline: towers of mixed height.
    return `<rect class="dio-glass-bg" x="288" y="0" width="60" height="38"/>
<rect class="dio-sun" x="332" y="11" width="6" height="6" rx="3"/>
<rect class="dio-bld2" x="292" y="16" width="8" height="22"/><rect class="dio-bld" x="301" y="10" width="9" height="28"/>
<rect class="dio-bld2" x="311" y="19" width="8" height="19"/><rect class="dio-bld" x="320" y="13" width="9" height="25"/>
<rect class="dio-bld2" x="330" y="21" width="12" height="17"/>`;
  }
  return `<rect class="dio-glass-bg" x="288" y="0" width="60" height="38"/>
<rect class="dio-sun" x="326" y="10" width="8" height="8" rx="4"/>
<ellipse class="dio-cloud" cx="302" cy="26" rx="12" ry="4"/><ellipse class="dio-cloud" cx="326" cy="31" rx="14" ry="4"/>`;
};

interface Plan {
  rows: number; // floors drawn (1..3)
  windowOpen: boolean;
  desks: number; // desk glyphs drawn
  monkeys: number; // seated monkey glyphs drawn
  lit: boolean; // editing output present: the stamp moves
  clipped: boolean; // the building runs off the top of the frame
}

const svgKey = (p: Plan) => `${p.rows}|${p.windowOpen}|${p.desks}|${p.monkeys}|${p.lit}`;

function build(p: Plan): string {
  const parts: string[] = [];
  parts.push(`<rect class="dio-sky" x="0" y="0" width="${VW}" height="${VH}"/>`);
  if (!p.clipped) {
    parts.push(`<g class="dio-cloudg"><ellipse class="dio-cloud" cx="60" cy="14" rx="22" ry="5"/><ellipse class="dio-cloud" cx="84" cy="18" rx="16" ry="4"/><ellipse class="dio-cloud" cx="250" cy="9" rx="20" ry="4.5"/></g>`);
  }
  // Glass clip, in a floor's local coordinates (applied inside each floor's translate).
  parts.push(`<defs><clipPath id="dio-glass"><polygon points="292,9 340,12 340,26 292,29"/></clipPath>
<linearGradient id="dio-fadeg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="dio-fade" stop-opacity="1"/><stop offset="1" class="dio-fade" stop-opacity="0"/></linearGradient></defs>`);

  let seated = p.monkeys;
  let desksLeft = p.desks;
  for (let r = 0; r < p.rows; r++) {
    const bottom = GROUND_Y - r * ROW_H;
    const top = bottom - ROW_H;
    const here = Math.min(DESK_SLOTS, desksLeft);
    desksLeft -= here;
    const floor: string[] = [];
    floor.push(`<rect class="dio-wall" x="3" y="0" width="${VW - 6}" height="${ROW_H}"/>`);
    floor.push(`<rect class="dio-slab" x="0" y="0" width="${VW}" height="${CEIL}"/>`);
    floor.push(`<rect class="dio-slab" x="0" y="${ROW_H - SLAB}" width="${VW}" height="${SLAB}"/>`);
    floor.push(`<rect class="dio-slab" x="0" y="0" width="3" height="${ROW_H}"/><rect class="dio-slab" x="${VW - 3}" y="0" width="3" height="${ROW_H}"/>`);
    // Light bowls with a soft cone over each used slot (and the station).
    const lit = here > 0 ? here + 1 : 0;
    for (let i = 0; i < lit; i++) {
      const cx = SLOT_X + i * SLOT_W + SLOT_W / 2;
      floor.push(`<polygon class="dio-cone" points="${cx - 3},${CEIL} ${cx + 3},${CEIL} ${cx + 15},${ROW_H - SLAB} ${cx - 15},${ROW_H - SLAB}"/><path class="dio-bowl" d="M${cx - 4},${CEIL} a4,3 0 0 0 8,0z"/>`);
    }
    // Pneumatic tube along the ceiling to the editor station.
    if (here > 0) {
      const ex = SLOT_X + DESK_SLOTS * SLOT_W + SLOT_W / 2;
      floor.push(`<path class="dio-tube" d="M${SLOT_X + 4},${CEIL + 2} H${ex} V${ROW_H - SLAB - 22}"/>`);
    }
    const baseY = ROW_H - SLAB;
    for (let i = 0; i < DESK_SLOTS; i++) {
      if (i >= here) break;
      const x = SLOT_X + i * SLOT_W;
      if (seated > 0) {
        seated--;
        floor.push(`<g transform="translate(${x},${baseY})">${glyphMonkey(r * DESK_SLOTS + i)}</g>`);
      } else {
        floor.push(`<g transform="translate(${x},${baseY})">${glyphDesk()}</g>`);
      }
    }
    if (here > 0) {
      const x = SLOT_X + DESK_SLOTS * SLOT_W;
      floor.push(`<g class="${p.lit ? '' : 'dio-idle'}" transform="translate(${x},${baseY})">${glyphEditor()}</g>`);
    }
    // Window: a deep trapezoid reveal once the 'office' milestone is reached.
    if (p.windowOpen) {
      floor.push(`<polygon class="dio-reveal" points="284,5 346,9 346,29 284,33"/>`);
      floor.push(`<polygon class="dio-glass-bg" points="292,9 340,12 340,26 292,29"/>`);
      floor.push(`<g clip-path="url(#dio-glass)">${viewMarkup(Math.min(r, VIEWS.length - 1))}</g>`);
    } else {
      floor.push(`<polygon class="dio-blank" points="284,5 346,9 346,29 284,33"/><rect class="dio-notice" x="304" y="12" width="14" height="10"/>`);
    }
    parts.push(`<g transform="translate(0,${top})">${floor.join('')}</g>`);
  }
  // Ground strip.
  parts.push(`<rect class="dio-ground" x="0" y="${GROUND_Y}" width="${VW}" height="${VH - GROUND_Y}"/>`);
  if (p.clipped) {
    // The building continues past the frame: fade the top and mark it.
    parts.push(`<rect fill="url(#dio-fadeg)" x="0" y="0" width="${VW}" height="22"/>`);
    parts.push(`<g class="dio-dots"><circle cx="180" cy="4" r="1.3"/><circle cx="180" cy="9" r="1.3"/><circle cx="180" cy="14" r="1.3"/></g>`);
  }
  return parts.join('');
}

function mount(root: HTMLElement, ctx: Ctx): () => void {
  const { t } = ctx;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'dio-svg');
  svg.setAttribute('viewBox', `0 0 ${VW} ${VH}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMax meet');
  svg.setAttribute('role', 'img');
  const capSeated = h('span', {});
  const capView = h('span', {});
  const capDesks = h('span', {});
  const wrap = h('div', { class: 'dio' }, svg as unknown as Node, h('div', { class: 'dio-caption' }, capSeated, capDesks, capView));
  root.append(wrap);

  let key = '';
  return () => {
    const s = ctx.state();
    const reached = s.milestonesReached;
    const rows = reached.includes('tall') ? 3 : reached.includes('building') ? 2 : 1;
    const desks = Math.floor(N.toNumber(s.desks));
    const monkeys = Math.floor(N.toNumber(s.monkeys));
    const drawnDesks = Math.min(desks, rows * DESK_SLOTS);
    const plan: Plan = {
      rows,
      windowOpen: reached.includes('office'),
      desks: drawnDesks,
      monkeys: Math.min(monkeys, drawnDesks),
      lit: N.toNumber(deptOutput(s, t, 'editing')) > 0,
      clipped: rows === 3,
    };
    const k = svgKey(plan);
    if (k !== key) {
      key = k;
      svg.innerHTML = build(plan);
    }

    const view = plan.windowOpen ? VIEWS[Math.min(rows - 1, VIEWS.length - 1)] : 'No window';
    text(capSeated, `Seated ×${f.count(s.monkeys)}`);
    text(capDesks, `Desks ×${f.count(s.desks)}`);
    text(capView, `View: ${view}`);
    const label = `Bureau cross-section. ${f.count(s.monkeys)} monkeys seated at ${f.count(s.desks)} desks. ${view}.`;
    if (svg.getAttribute('aria-label') !== label) svg.setAttribute('aria-label', label);
  };
}

export const diorama: Screen = { id: 'diorama', label: 'Diorama', mount };
