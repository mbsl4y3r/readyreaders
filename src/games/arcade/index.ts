/**
 * Maps each arcade game id to its runner. Every game module exports a single
 * `run: RunArcadeGame`; we alias them here so the ArcadeScene can look one up
 * by catalog id. Keep this in step with content/arcade-games.ts.
 */
import type { RunArcadeGame } from './types';
import { run as serpent } from './serpent';
import { run as bounce } from './bounce';
import { run as flutter } from './flutter';
import { run as crumble } from './crumble';
import { run as hoppy } from './hoppy';
import { run as blaster } from './blaster';
import { run as muncher } from './muncher';
import { run as skeeball } from './skeeball';
import { run as racer } from './racer';
import { run as putt } from './putt';
import { run as ascent } from './ascent';
import { run as hollow } from './hollow';
import { run as whack } from './whack';
import { run as bubblepop } from './bubblepop';
import { run as memory } from './memory';
import { run as catchgame } from './catch';
import { run as echo } from './echo';

export const ARCADE_RUNNERS: Record<string, RunArcadeGame> = {
  serpent,
  bounce,
  flutter,
  crumble,
  hoppy,
  blaster,
  muncher,
  skeeball,
  racer,
  putt,
  ascent,
  hollow,
  whack,
  bubblepop,
  memory,
  catch: catchgame,
  echo,
};
