import type { Lesson } from './types';

/**
 * The 120-lesson sequence transcribed from Evie's phonics book checklist.
 * `newGraphemes` are the letter-sound units introduced; `memoryWords` are the
 * book's explicitly taught irregular words ("memory words").
 *
 * Practice lessons introduce nothing — they exist so the parent's
 * book-lesson marker lines up with the physical book.
 */

const L = (
  id: number,
  label: string,
  newGraphemes: string[] = [],
  memoryWords: string[] = [],
): Lesson => ({ id, label, newGraphemes, memoryWords });

const practice = (id: number): Lesson => L(id, 'practice');

export const LESSONS: Lesson[] = [
  L(1, 'a, m, n, s, t, x', ['a', 'm', 'n', 's', 't', 'x']),
  L(2, 'h', ['h']),
  practice(3),
  L(4, 'd, w', ['d', 'w']),
  L(5, 'was, questions + statements', [], ['was']),
  L(6, 'l', ['l']),
  L(7, 'b, c, g, f, j', ['b', 'c', 'g', 'f', 'j']),
  L(8, 'p, r, v', ['p', 'r', 'v']),
  L(9, 'k, y, z', ['k', 'y', 'z']),
  L(10, 'double letter endings', ['ss', 'll', 'ff', 'zz', 'dd', 'gg']),
  L(11, 'ck, qu', ['ck', 'qu']),
  practice(12),
  L(13, 'e, i', ['e', 'i']),
  L(14, 'o, u', ['o', 'u']),
  practice(15),
  practice(16),
  practice(17),
  L(18, 'ph', ['ph']),
  L(19, 'th, the', ['th'], ['the']),
  L(20, 'on, son, ton, won, of, off', [], ['son', 'ton', 'won', 'of']),
  practice(21),
  L(22, "s, es, 's endings", ['es', "'s"]),
  practice(23),
  L(24, 'u (second sound)', [], ['put', 'pull', 'push', 'full']),
  practice(25),
  L(26, 'sh, wash', ['sh'], ['wash']),
  practice(27),
  L(28, 'ch', ['ch']),
  practice(29),
  L(30, 'wh, what', ['wh'], ['what']),
  practice(31),
  L(32, 'contractions', [], ["isn't", "can't", "hasn't", "it's", "let's", "didn't"]),
  practice(33),
  practice(34),
  L(35, 'all', [], ['all']),
  practice(36),
  L(37, 'ng', ['ng']),
  practice(38),
  practice(39),
  practice(40),
  L(41, 'nd, nt, wand, want', ['nd', 'nt'], ['wand', 'want']),
  practice(42),
  L(43, 'er, nk, nch, nc', ['er', 'nk', 'nch', 'nc']),
  practice(44),
  L(45, 'ct, ft, pt, xt', ['ct', 'ft', 'pt', 'xt']),
  practice(46),
  L(47, 'sk, sp, st', ['sk', 'sp', 'st']),
  practice(48),
  L(49, 'lb, ld, lf, lk + calf, half, talk, walk', ['lb', 'ld', 'lf', 'lk'], ['calf', 'half', 'talk', 'walk']),
  practice(50),
  L(51, 'lm, lp, lt, mp, tch + halt, malt, salt, watch', ['lm', 'lp', 'lt', 'mp', 'tch'], ['halt', 'malt', 'salt', 'watch']),
  practice(52),
  L(53, 'dge, nge, nce, nse + one, once', ['dge', 'nge', 'nce', 'nse'], ['one', 'once']),
  practice(54),
  L(55, 'bl, br, cl, cr', ['bl', 'br', 'cl', 'cr']),
  practice(56),
  L(57, 'dr, dw, fl, fr', ['dr', 'dw', 'fl', 'fr']),
  practice(58),
  L(59, 'gl, gr, gw, pl, pr', ['gl', 'gr', 'gw', 'pl', 'pr']),
  practice(60),
  L(61, 'sl, shr, sm, sn, sp, spl, spr', ['sl', 'shr', 'sm', 'sn', 'spl', 'spr']),
  L(62, 'st, str, sw, sc, sk, scr', ['str', 'sw', 'sc', 'sk', 'scr']),
  practice(63),
  L(64, 'tr, thr, tw', ['tr', 'thr', 'tw']),
  practice(65),
  L(66, 'transforming e + are, have', ['a_e'], ['are', 'have']),
  practice(67),
  practice(68),
  practice(69),
  L(70, 'ai + said, again, against', ['ai'], ['said', 'again', 'against']),
  practice(71),
  L(72, 'ay, ey + away', ['ay', 'ey'], ['away']),
  practice(73),
  L(74, 'eigh, ei + height', ['eigh', 'ei'], ['height']),
  practice(75),
  L(76, 'au, aw', ['au', 'aw']),
  practice(77),
  L(78, 'a (broad), ar', ['ar']),
  practice(79),
  L(80, 'ar after w (war)', []),
  practice(81),
  L(82, 'ee', ['ee']),
  practice(83),
  L(84, 'been, she, he, be, we, me', [], ['been', 'she', 'he', 'be', 'we', 'me']),
  practice(85),
  L(86, 'ea', ['ea']),
  L(87, 'e_e + there, where', ['e_e'], ['there', 'where']),
  practice(88),
  practice(89),
  L(90, 'ie', ['ie']),
  practice(91),
  L(92, 'y (as vowel)', []),
  practice(93),
  L(94, 'y, ie, uy', ['uy']),
  practice(95),
  L(96, 'i_e + give, live', ['i_e'], ['give', 'live']),
  practice(97),
  L(98, 'igh', ['igh']),
  practice(99),
  practice(100),
  L(101, 'ough, augh, gh', ['ough', 'augh', 'gh']),
  practice(102),
  L(103, 'o_e', ['o_e']),
  practice(104),
  L(105, 'oa, ow, old', ['oa', 'ow', 'old']),
  practice(106),
  L(107, 'oo + could, would, should', ['oo'], ['could', 'would', 'should', "couldn't", "wouldn't", "shouldn't"]),
  practice(108),
  L(109, 'ow, ou', ['ou']),
  L(110, 'ou + doubt', [], ['doubt']),
  L(111, 'oy, oi', ['oy', 'oi']),
  practice(112),
  L(113, 'ue, ui, u_e', ['ue', 'ui', 'u_e']),
  practice(114),
  L(115, 'ew, eu + through, sew', ['ew', 'eu'], ['through', 'sew']),
  L(116, 'er, ir, or, ur, ear', ['ir', 'or', 'ur', 'ear']),
  L(117, 'le, tle, ph, su, ssu', ['le', 'tle']),
  L(118, 'ci, sci, xi, si, su, tu, ti', ['ci', 'ti', 'si']),
  L(119, 'kn, mb, bt, wr, silent h', ['kn', 'mb', 'bt', 'wr']),
  L(120, 'st, ft, ch, ps, y (rare sounds)', []),
];

/** Cumulative set of grapheme units taught by the end of lesson `n`. */
export function graphemesTaughtBy(n: number): Set<string> {
  const set = new Set<string>();
  for (const lesson of LESSONS) {
    if (lesson.id > n) break;
    for (const g of lesson.newGraphemes) set.add(g);
  }
  return set;
}

/** Cumulative set of memory words taught by the end of lesson `n` (lowercase). */
export function memoryWordsTaughtBy(n: number): Set<string> {
  const set = new Set<string>();
  for (const lesson of LESSONS) {
    if (lesson.id > n) break;
    for (const w of lesson.memoryWords) set.add(w.toLowerCase());
  }
  return set;
}
