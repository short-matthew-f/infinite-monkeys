// Presentation progress: which Orientation Reels have been seen, which rooms
// have been opened, which cues have been acknowledged. One localStorage record,
// never part of GameState (core doesn't know about teaching), cleared by Reset.

const KEY = 'im:progress';

interface Data {
  reels: string[];
  opened: string[];
  cues: string[];
}

function read(): Data {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Data> | null;
    if (v && typeof v === 'object') return { reels: v.reels ?? [], opened: v.opened ?? [], cues: v.cues ?? [] };
  } catch {}
  // Migrate the first build's Reel 1 flag.
  let reel1 = false;
  try {
    reel1 = localStorage.getItem('im:ernest-reel1') === 'done';
  } catch {}
  return { reels: reel1 ? ['first-hire'] : [], opened: [], cues: [] };
}

const data = read();
const write = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {}
};

export const progress = {
  seenReel: (id: string) => data.reels.includes(id),
  markReel(id: string) {
    if (!data.reels.includes(id)) {
      data.reels.push(id);
      write();
    }
  },
  hasOpened: (room: string) => data.opened.includes(room),
  markOpened(room: string) {
    if (!data.opened.includes(room)) {
      data.opened.push(room);
      write();
    }
  },
  /** A cue (by its key) the player has already acted on, so it stays quiet. */
  ackedCue: (key: string) => data.cues.includes(key),
  ackCue(key: string) {
    if (!data.cues.includes(key)) {
      data.cues.push(key);
      if (data.cues.length > 200) data.cues.splice(0, data.cues.length - 200);
      write();
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
      localStorage.removeItem('im:ernest-reel1');
    } catch {}
  },
};
