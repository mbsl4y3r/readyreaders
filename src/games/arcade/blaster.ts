import Phaser from 'phaser';
import type { RunArcadeGame, ArcadeGame, ArcadeCtx } from './types';
import { emojiText } from '../../ui/kit';
import { chime } from '../../services/audio';

interface Rock {
  sprite: Phaser.GameObjects.Text;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  big: boolean;
}

interface Bolt {
  dot: Phaser.GameObjects.Arc;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export const run: RunArcadeGame = (scene, ctx: ArcadeCtx) => {
  const { width, height, hudBottom, theme } = ctx;

  // --- Soft playfield background so the game reads as its own place. --------
  const fieldH = height - hudBottom;
  const bg = scene.add.rectangle(width / 2, (hudBottom + height) / 2, width, fieldH, theme.bgBottom);
  ctx.layer.add(bg);
  const bgGlow = scene.add.rectangle(width / 2, hudBottom + 6, width, 12, theme.bgTop, 0.5);
  ctx.layer.add(bgGlow);

  // A few decorative background stars (non-interactive).
  for (let i = 0; i < 14; i++) {
    const sx = 30 + Math.random() * (width - 60);
    const sy = hudBottom + 20 + Math.random() * (fieldH - 40);
    const twinkle = scene.add.circle(sx, sy, 2 + Math.random() * 2, 0xffffff, 0.4);
    ctx.layer.add(twinkle);
  }

  // --- Ship (fixed near the centre) ----------------------------------------
  const shipX = width / 2;
  const shipY = (hudBottom + height) / 2;
  const shipR = 34;
  const halo = scene.add.circle(shipX, shipY, shipR + 10, theme.accent, 0.35);
  ctx.layer.add(halo);
  const ring = scene.add.circle(shipX, shipY, shipR + 10);
  ring.setStrokeStyle(4, theme.accent, 0.9);
  ctx.layer.add(ring);
  const ship = emojiText(scene, shipX, shipY, '🚀', 56);
  ctx.layer.add(ship);

  // --- State ---------------------------------------------------------------
  let score = 0;
  let over = false;
  let destroyed = false;
  const rocks: Rock[] = [];
  const bolts: Bolt[] = [];
  let spawnTimer = -1400; // grace before the first rock
  let spawnEvery = 1500; // ms, shrinks gently over time
  const BOLT_SPEED = 560; // px/sec
  const MAX_BOLTS = 10;

  // Gentle ship pulse (polish tween — stopped in destroy()).
  const pulse = scene.tweens.add({
    targets: [ship, halo],
    scale: 1.08,
    duration: 900,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.InOut',
  });

  const spawnRock = (x: number, y: number, big: boolean, vx?: number, vy?: number) => {
    const r = big ? 40 : 26;
    const sprite = emojiText(scene, x, y, '⭐', big ? 60 : 40);
    ctx.layer.add(sprite);
    let dvx = vx ?? 0;
    let dvy = vy ?? 0;
    if (vx === undefined || vy === undefined) {
      // Drift slowly toward the ship.
      const ang = Math.atan2(shipY - y, shipX - x);
      const speed = 42 + Math.random() * 26; // gentle
      dvx = Math.cos(ang) * speed;
      dvy = Math.sin(ang) * speed;
    }
    rocks.push({ sprite, x, y, vx: dvx, vy: dvy, r, big });
  };

  const spawnFromEdge = () => {
    // Pick a point along the playfield perimeter.
    const side = Math.floor(Math.random() * 4);
    let x = width / 2;
    let y = shipY;
    if (side === 0) {
      x = Math.random() * width;
      y = hudBottom + 8;
    } else if (side === 1) {
      x = Math.random() * width;
      y = height - 8;
    } else if (side === 2) {
      x = 8;
      y = hudBottom + Math.random() * fieldH;
    } else {
      x = width - 8;
      y = hudBottom + Math.random() * fieldH;
    }
    spawnRock(x, y, Math.random() < 0.55);
  };

  const fire = (tx: number, ty: number) => {
    if (over || bolts.length >= MAX_BOLTS) return;
    const ang = Math.atan2(ty - shipY, tx - shipX);
    const dot = scene.add.circle(shipX, shipY, 9, theme.accent);
    dot.setStrokeStyle(3, 0xffffff, 0.95);
    ctx.layer.add(dot);
    bolts.push({
      dot,
      x: shipX,
      y: shipY,
      vx: Math.cos(ang) * BOLT_SPEED,
      vy: Math.sin(ang) * BOLT_SPEED,
    });
    // Point the ship toward the shot.
    ship.setRotation(ang + Math.PI / 2);
    chime('good');
  };

  const onDown = (pointer: Phaser.Input.Pointer) => {
    if (pointer.y < hudBottom) return; // ignore taps on the HUD strip
    fire(pointer.x, pointer.y);
  };
  scene.input.on('pointerdown', onDown, this);

  // Keyboard bonus: space fires straight up.
  const keys = scene.input.keyboard?.addKeys({ fire: Phaser.Input.Keyboard.KeyCodes.SPACE }) as
    | { fire: Phaser.Input.Keyboard.Key }
    | undefined;

  const endGame = () => {
    if (over) return;
    over = true;
    chime('gentle');
    ctx.onGameOver(score);
  };

  const removeRock = (i: number) => {
    rocks[i]!.sprite.destroy();
    rocks.splice(i, 1);
  };

  const removeBolt = (i: number) => {
    bolts[i]!.dot.destroy();
    bolts.splice(i, 1);
  };

  return {
    update(_time: number, delta: number) {
      if (over || destroyed) return;
      const dt = delta / 1000;

      if (keys?.fire.isDown) fire(shipX, hudBottom); // straight up on keypress

      // Spawn rocks, gradually a touch more often.
      spawnTimer += delta;
      if (spawnTimer >= spawnEvery) {
        spawnTimer = 0;
        spawnEvery = Math.max(850, spawnEvery - 40);
        spawnFromEdge();
      }

      // Move bolts; cull off-field ones.
      for (let i = bolts.length - 1; i >= 0; i--) {
        const b = bolts[i]!;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.dot.setPosition(b.x, b.y);
        if (b.x < -20 || b.x > width + 20 || b.y < hudBottom - 20 || b.y > height + 20) {
          removeBolt(i);
        }
      }

      // Move rocks toward the ship.
      for (let i = rocks.length - 1; i >= 0; i--) {
        const rk = rocks[i]!;
        rk.x += rk.vx * dt;
        rk.y += rk.vy * dt;
        rk.sprite.setPosition(rk.x, rk.y);
        rk.sprite.rotation += dt * 0.8;

        // Rock reached the ship => game over.
        const ds = Phaser.Math.Distance.Between(rk.x, rk.y, shipX, shipY);
        if (ds < rk.r + shipR - 6) {
          endGame();
          return;
        }
      }

      // Bolt vs rock collisions (generous hitboxes).
      for (let i = rocks.length - 1; i >= 0; i--) {
        const rk = rocks[i]!;
        let hit = false;
        for (let j = bolts.length - 1; j >= 0; j--) {
          const b = bolts[j]!;
          if (Phaser.Math.Distance.Between(rk.x, rk.y, b.x, b.y) < rk.r + 12) {
            removeBolt(j);
            hit = true;
            break;
          }
        }
        if (!hit) continue;

        score += 1;
        ctx.onScore(score);
        chime('good');

        const wasBig = rk.big;
        const bx = rk.x;
        const by = rk.y;
        removeRock(i);

        // A big rock breaks into two little ones once.
        if (wasBig) {
          const base = Math.atan2(shipY - by, shipX - bx);
          for (const off of [-0.9, 0.9]) {
            const a = base + off;
            const sp = 60 + Math.random() * 20;
            spawnRock(bx, by, false, Math.cos(a) * sp, Math.sin(a) * sp);
          }
        }
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      scene.input.off('pointerdown', onDown, this);
      pulse.stop();
    },
  } satisfies ArcadeGame;
};
