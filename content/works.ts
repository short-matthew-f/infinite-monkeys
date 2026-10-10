// The Complete Works: public-domain passages whose lines the monkeys type, one
// sighting at a time (core/pages.ts). Shakespeare in the home market; Pushkin
// and Homer arrive with the Cyrillic and Greek buses. Texts are the standard
// editions' wording; proofread before changing.

import type { WorkDef } from '../core/tuning.js';

export const WORKS: WorkDef[] = [
  // ---------- home ----------
  {
    id: 'sonnet18',
    title: 'Sonnet 18',
    author: 'William Shakespeare',
    market: 'home',
    lines: [
      "Shall I compare thee to a summer's day?",
      'Thou art more lovely and more temperate:',
      'Rough winds do shake the darling buds of May,',
      "And summer's lease hath all too short a date;",
      'Sometime too hot the eye of heaven shines,',
      "And often is his gold complexion dimm'd;",
      'And every fair from fair sometime declines,',
      "By chance or nature's changing course untrimm'd;",
      "But thy eternal summer shall not fade,",
      "Nor lose possession of that fair thou ow'st;",
      "Nor shall Death brag thou wander'st in his shade,",
      'When in eternal lines to time thou grow\'st:',
      'So long as men can breathe or eyes can see,',
      'So long lives this, and this gives life to thee.',
    ],
  },
  {
    id: 'tobe',
    title: 'Hamlet, 3.1',
    author: 'William Shakespeare',
    market: 'home',
    lines: [
      'To be, or not to be, that is the question:',
      "Whether 'tis nobler in the mind to suffer",
      'The slings and arrows of outrageous fortune,',
      'Or to take arms against a sea of troubles,',
      'And by opposing end them. To die, to sleep,',
      'No more; and by a sleep to say we end',
      'The heartache and the thousand natural shocks',
      "That flesh is heir to: 'tis a consummation",
    ],
  },
  {
    id: 'tomorrow',
    title: 'Macbeth, 5.5',
    author: 'William Shakespeare',
    market: 'home',
    lines: [
      'Tomorrow, and tomorrow, and tomorrow,',
      'Creeps in this petty pace from day to day,',
      'To the last syllable of recorded time;',
      'And all our yesterdays have lighted fools',
      'The way to dusty death. Out, out, brief candle!',
      "Life's but a walking shadow, a poor player,",
      'That struts and frets his hour upon the stage,',
      'And then is heard no more. It is a tale',
      'Told by an idiot, full of sound and fury,',
      'Signifying nothing.',
    ],
  },
  {
    id: 'music',
    title: 'Twelfth Night, 1.1',
    author: 'William Shakespeare',
    market: 'home',
    lines: [
      'If music be the food of love, play on;',
      'Give me excess of it, that, surfeiting,',
      'The appetite may sicken, and so die.',
    ],
  },
  {
    id: 'allthestage',
    title: 'As You Like It, 2.7',
    author: 'William Shakespeare',
    market: 'home',
    lines: [
      "All the world's a stage,",
      'And all the men and women merely players;',
      'They have their exits and their entrances,',
      'And one man in his time plays many parts,',
    ],
  },
  {
    id: 'sonnet116',
    title: 'Sonnet 116',
    author: 'William Shakespeare',
    market: 'home',
    lines: [
      'Let me not to the marriage of true minds',
      'Admit impediments. Love is not love',
      'Which alters when it alteration finds,',
      'Or bends with the remover to remove:',
    ],
  },

  // ---------- cyrillic ----------
  {
    id: 'pushkin_k',
    title: 'К ***',
    author: 'Александр Пушкин',
    market: 'cyrillic',
    lines: [
      'Я помню чудное мгновенье:',
      'Передо мной явилась ты,',
      'Как мимолетное виденье,',
      'Как гений чистой красоты.',
    ],
  },
  {
    id: 'pushkin_winter',
    title: 'Зимнее утро',
    author: 'Александр Пушкин',
    market: 'cyrillic',
    lines: [
      'Мороз и солнце; день чудесный!',
      'Еще ты дремлешь, друг прелестный —',
      'Пора, красавица, проснись:',
      'Открой сомкнуты негой взоры',
    ],
  },

  // ---------- greek ----------
  {
    id: 'iliad',
    title: 'Iliad, 1.1–1.5',
    author: 'Homer',
    market: 'greek',
    lines: [
      'Μῆνιν ἄειδε θεὰ Πηληϊάδεω Ἀχιλῆος',
      'οὐλομένην, ἣ μυρί᾽ Ἀχαιοῖς ἄλγε᾽ ἔθηκε,',
      'πολλὰς δ᾽ ἰφθίμους ψυχὰς Ἄϊδι προΐαψεν',
      'ἡρώων, αὐτοὺς δὲ ἑλώρια τεῦχε κύνεσσιν',
      'οἰωνοῖσί τε πᾶσι· Διὸς δ᾽ ἐτελείετο βουλή·',
    ],
  },
  {
    id: 'odyssey',
    title: 'Odyssey, 1.1–1.4',
    author: 'Homer',
    market: 'greek',
    lines: [
      'Ἄνδρα μοι ἔννεπε, Μοῦσα, πολύτροπον, ὃς μάλα πολλὰ',
      'πλάγχθη, ἐπεὶ Τροίης ἱερὸν πτολίεθρον ἔπερσεν·',
      'πολλῶν δ᾽ ἀνθρώπων ἴδεν ἄστεα καὶ νόον ἔγνω,',
      'πολλὰ δ᾽ ὅ γ᾽ ἐν πόντῳ πάθεν ἄλγεα ὃν κατὰ θυμόν,',
    ],
  },
];
