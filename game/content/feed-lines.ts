// Feed text: presentation, not tuning, so it lives here and not in /content.
// Voice (DESIGN Appendix B, visual guide "Voice and copy"): polite memo
// language, sincere, humor from procedure versus subject. No exclamation marks
// outside the rare human moments. No timeline/branch/variant words, no clocks.

/** Stages in order. Ambient lines unlock at their stage and stay eligible after. */
export const STAGES = ['start', 'office', 'building', 'tall', 'aleph0'] as const;
export type FeedStage = (typeof STAGES)[number];

export interface FeedLine {
  id: string;
  stage: FeedStage;
  text: string;
  /** A rare human moment: printed with a typed margin annotation. About 1 in 8 here. */
  human?: boolean;
}

export const AMBIENT: FeedLine[] = [
  // Start: straight-faced office.
  { id: 's1', stage: 'start', text: 'Memo 1: The typing pool is open. Please take a seat.' },
  { id: 's2', stage: 'start', text: 'Stationery confirms delivery of one (1) typewriter.' },
  { id: 's3', stage: 'start', text: 'Submissions are reviewed in the order received.' },
  { id: 's4', stage: 'start', text: 'The kettle in the break room has been inspected and found adequate.' },
  { id: 's5', stage: 'start', text: 'Form 1-A (Statement of Intent) is on file. It has not been read.' },

  // Office: two desks and a window.
  { id: 'o1', stage: 'office', text: 'Facilities reports that the second desk is level.' },
  { id: 'o2', stage: 'office', text: 'Staff are reminded that the ribbon is not a snack.' },
  { id: 'o3', stage: 'office', text: 'Stationery has taken a census of pencils. The census is on a desk.' },
  { id: 'o4', stage: 'office', text: 'Staff are asked to keep their hands on the keys and their feet on the floor.' },
  { id: 'o5', stage: 'office', text: 'Margin note, typed: someone has left a banana on the Editor\'s desk. It was not requested.', human: true },

  // Building: floors.
  { id: 'b1', stage: 'building', text: 'Now hiring: recruiters to hire recruiters.' },
  { id: 'b2', stage: 'building', text: 'Floor 2 reports adequate lighting. Floor 1 reports that it was first.' },
  { id: 'b3', stage: 'building', text: 'The stairwell has been numbered. The numbers are provisional.' },
  { id: 'b4', stage: 'building', text: 'Floors now exchange memos by pneumatic tube. Please do not send monkeys by tube.' },
  { id: 'b5', stage: 'building', text: 'The Parking Committee notes that nobody owns a car. The Committee will meet regardless.' },
  { id: 'b6', stage: 'building', text: 'The builders\' union has filed a grievance: "infinite floors, finite lunch breaks."' },
  { id: 'b7', stage: 'building', text: 'Margin note, typed: the new hires have named the ficus.', human: true },

  // Tall: the building keeps going.
  { id: 't1', stage: 'tall', text: 'Elevator maintenance is now its own department. The department has an elevator.' },
  { id: 't2', stage: 'tall', text: 'Floors above the clouds are now classified as "upper."' },
  { id: 't3', stage: 'tall', text: 'The org chart no longer fits on one wall. It has been moved to a second wall.' },
  { id: 't4', stage: 'tall', text: 'Archives requests more shelves. Archives has requested more archives.' },
  { id: 't5', stage: 'tall', text: 'Please do not ask what is on the top floor. Please ask Facilities.' },
  { id: 't6', stage: 'tall', text: 'Every desk now has a number. Numbers are being reissued as they run low.' },
  { id: 't7', stage: 'tall', text: 'Margin note, typed: night shift says the hum is louder at night. Day shift says that is what night is.', human: true },

  // Aleph-zero (hotel). Not finite-phase, but the ticker keeps going after the ceremony.
  { id: 'a1', stage: 'aleph0', text: 'Per the new org chart, floor construction is complete. Forever. Please redirect all questions to Shifting.' },
  { id: 'a2', stage: 'aleph0', text: 'Room 7 has been relocated 40 times today.' },
  { id: 'a3', stage: 'aleph0', text: 'Bus 12 has arrived. Everyone on it types exclusively in Cyrillic.' },
];

/** Printed when a milestone is reached (milestone ids from content/prototype.ts). */
export const STAGE_LINES: Record<string, string> = {
  office: 'Form 2-B approved: a second desk, and a window. The window faces the street.',
  building: 'Permit 11-D issued. The typing pool is now classified as a building.',
  tall: 'Notice: the building now exceeds the height of its neighbors. Neighbors have been informed.',
};

/** First certified find of a tier. Unknown tiers fall back to a generic line. */
export const TIER_LINES: Record<string, string> = {
  words: 'DISCOVERED: first certified word. Stamped, filed, and framed.',
  phrases: 'DISCOVERED: first certified phrase. Circulated to all floors.',
  sentences: 'DISCOVERED: first certified sentence. The Editor has asked for a moment.',
};
export const tierLine = (tier: string): string => TIER_LINES[tier] ?? `DISCOVERED: first certified ${tier}. Filed.`;

export const PERMIT_LINE = 'Infinity Permit issued. You may now declare.';
export const DECLARED_LINE = 'Infinity declared. The ceiling is under review.';
export const titleLine = (from: string, to: string): string => `Name plate re-lettered: ${from} is now ${to}.`;
export const FUNDING_LINE = 'Form 7-F filed: departmental funding revised.';
export const ALLOCATION_LINES = {
  tiers: 'Form 7-A filed: Editor assignments revised.',
  markets: 'Form 7-M filed: market allocation revised.',
} as const;
export const pinLine = (kind: string, id?: string): string =>
  kind === 'bananas'
    ? 'Objective pinned: banana income.'
    : kind === 'readiness'
      ? 'Objective pinned: Infinity readiness.'
      : `Objective pinned: Commission ${id ?? ''}.`.replace(' .', '.');

export const OPENING_LINE = 'Bureau of Infinite Typing. Teletype online.';
