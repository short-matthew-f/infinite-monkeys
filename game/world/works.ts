// Presentation helpers for sightings and the Complete Works. Text only; no game state, no randomness.
// The near-miss gag (a monkey types one wrong key, then corrects it) is chosen from the line itself, so the
// sighting page, the shelf and the feed all agree on it and a replay is identical.

const LATIN_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const isLetter = (c: string): boolean => /\p{L}/u.test(c);

/** Neighbouring key for a letter: the key to its right on a QWERTY row (or left at the row's end); next letter of the alphabet elsewhere. */
function wrongKey(ch: string): string {
  const lower = ch.toLowerCase();
  for (const row of LATIN_ROWS) {
    const i = row.indexOf(lower);
    if (i >= 0) return (row[i + 1] ?? row[i - 1]!).toUpperCase();
  }
  const next = String.fromCodePoint(ch.codePointAt(0)! + 1);
  return isLetter(next) ? next : String.fromCodePoint(ch.codePointAt(0)! - 1);
}

export interface NearMiss {
  /** The line in typewriter capitals. */
  text: string[];
  /** Index (into text) of the letter the monkey fumbles: the last letter of the line. */
  at: number;
  /** What the monkey typed there first. */
  wrong: string;
  /** The word as first typed, and as meant (for jokes). */
  wrongWord: string;
  rightWord: string;
}

export function nearMiss(line: string): NearMiss {
  const text = Array.from(line.toUpperCase());
  let at = text.length - 1;
  while (at > 0 && !isLetter(text[at]!)) at--;
  const wrong = wrongKey(text[at]!);
  let a = at;
  while (a > 0 && isLetter(text[a - 1]!)) a--;
  const rightWord = text.slice(a, at + 1).join('');
  return { text, at, wrong, rightWord, wrongWord: rightWord.slice(0, -1) + wrong };
}

/** One step of the typing show: what is on the page, and when (ms from the start). */
export interface TypeFrame {
  text: string;
  at: number;
}

/**
 * The typing show for a line: letters arrive quickly, the monkey hits a wrong key on the last letter, pauses,
 * backspaces and corrects it, then the full stop (if any) lands. `total` ms end to end.
 */
export function typingFrames(line: string, total = 600): TypeFrame[] {
  const m = nearMiss(line);
  const n = m.text.length;
  const pause = total * 0.2;
  const per = (total - pause) / (n + 2);
  const frames: TypeFrame[] = [{ text: '', at: 0 }];
  let t = 0;
  for (let i = 0; i < m.at; i++) {
    t += per;
    frames.push({ text: m.text.slice(0, i + 1).join(''), at: t });
  }
  const head = m.text.slice(0, m.at).join('');
  t += per;
  frames.push({ text: head + m.wrong, at: t });
  t += pause; // the double take
  frames.push({ text: head, at: t });
  t += per;
  frames.push({ text: head + m.text[m.at], at: t });
  for (let i = m.at + 1; i < n; i++) {
    t += per;
    frames.push({ text: m.text.slice(0, i + 1).join(''), at: t });
  }
  return frames;
}

/** A missing line as underscores (letters only; spaces and punctuation stay, so the rhythm shows). */
export function blanks(line: string): string {
  return Array.from(line).map((c) => (isLetter(c) ? '_' : c)).join('');
}
