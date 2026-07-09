import Phaser from 'phaser';
import type { RunArcadeGame, ArcadeGame, ArcadeCtx } from './types';

export const run: RunArcadeGame = (scene, ctx: ArcadeCtx) => {
  const top = ctx.hudBottom + 6;
  const bottom = ctx.height - 6;
  const fishX = 260;

  // Soft playfield background
  const bg = scene.add.rectangle(
    ctx.width / 2,
    (top + bottom) / 2,
    ctx.width,
    bottom - top,
    ctx.theme.bgTop,
  );
  bg.setOrigin(0.5);
  ctx.layer.add(bg);
  const bgLow = scene.add.rectangle(
    ctx.width / 2,
    bottom - (bottom - top) * 0.25,
    ctx.width,
    (bottom - top) * 0.5,
    ctx.theme.bgBottom,
  );
  bgLow.setOrigin(0.5);
  bgLow.setAlpha(0.5);
  ctx.layer.add(bgLow);

  // The fish
  const fish = scene.add.text(fishX, (top + bottom) / 2, '🐠', {
    fontSize: '58px',
  });
  fish.setOrigin(0.5);
  ctx.layer.add(fish);

  // Physics state (units: px, px/s)
  const GRAVITY = 900;
  const FLAP = -360;
  const SCROLL = 150 * ctx.difficulty;
  const GAP = 260; // generous gap
  const PILLAR_W = 90;
  const SPAWN_GAP = 460 / ctx.difficulty; // horizontal distance between gate pairs (closer = more frequent when zippy)

  let vy = 0;
  let fishY = (top + bottom) / 2;
  let score = 0;
  let over = false;
  let destroyed = false;
  let started = false;

  interface Gate {
    x: number;
    gapCenter: number;
    passed: boolean;
    topRect: Phaser.GameObjects.Rectangle;
    botRect: Phaser.GameObjects.Rectangle;
    topCap: Phaser.GameObjects.Text;
    botCap: Phaser.GameObjects.Text;
  }
  const gates: Gate[] = [];

  const randGapCenter = (): number => {
    const margin = GAP / 2 + 40;
    return margin + Math.random() * (bottom - top - margin * 2) + top;
  };

  const makeGate = (x: number): Gate => {
    const gapCenter = randGapCenter();
    const topRect = scene.add.rectangle(x, top, PILLAR_W, 10, ctx.theme.accent);
    topRect.setOrigin(0.5, 0);
    const botRect = scene.add.rectangle(x, bottom, PILLAR_W, 10, ctx.theme.accent);
    botRect.setOrigin(0.5, 1);
    const topCap = scene.add.text(x, 0, '🪸', { fontSize: '46px' });
    topCap.setOrigin(0.5, 0.5);
    const botCap = scene.add.text(x, 0, '🪸', { fontSize: '46px' });
    botCap.setOrigin(0.5, 0.5);
    ctx.layer.add(topRect);
    ctx.layer.add(botRect);
    ctx.layer.add(topCap);
    ctx.layer.add(botCap);
    const gate: Gate = { x, gapCenter, passed: false, topRect, botRect, topCap, botCap };
    layoutGate(gate);
    return gate;
  };

  function layoutGate(g: Gate): void {
    const gapTop = g.gapCenter - GAP / 2;
    const gapBot = g.gapCenter + GAP / 2;
    g.topRect.x = g.x;
    g.topRect.height = Math.max(2, gapTop - top);
    g.botRect.x = g.x;
    g.botRect.height = Math.max(2, bottom - gapBot);
    g.topCap.setPosition(g.x, gapTop);
    g.botCap.setPosition(g.x, gapBot);
  }

  // Seed initial gates off to the right
  let nextSpawnX = ctx.width + 120;
  for (let i = 0; i < 3; i++) {
    gates.push(makeGate(nextSpawnX));
    nextSpawnX += SPAWN_GAP;
  }

  // Input: tap anywhere to flap
  const onPointerDown = (): void => {
    if (over) return;
    started = true;
    vy = FLAP;
  };
  scene.input.on('pointerdown', onPointerDown, this);

  const cursors = scene.input.keyboard?.createCursorKeys();
  let spacePrev = false;

  const endGame = (): void => {
    if (over) return;
    over = true;
    ctx.onGameOver(score);
  };

  const collides = (g: Gate): boolean => {
    const halfW = PILLAR_W / 2 + 22;
    if (Math.abs(g.x - fishX) > halfW) return false;
    const gapTop = g.gapCenter - GAP / 2;
    const gapBot = g.gapCenter + GAP / 2;
    // fish half-height (forgiving)
    const fh = 20;
    return fishY - fh < gapTop || fishY + fh > gapBot;
  };

  return {
    update(_time: number, delta: number): void {
      if (over || destroyed) return;
      const dt = delta / 1000;

      // Keyboard flap (bonus)
      if (cursors) {
        const spaceDown = cursors.space?.isDown || cursors.up?.isDown || false;
        if (spaceDown && !spacePrev) {
          started = true;
          vy = FLAP;
        }
        spacePrev = spaceDown;
      }

      if (!started) {
        // gentle idle bob before first tap
        fish.y = fishY + Math.sin(_time / 300) * 6;
        return;
      }

      // Physics
      vy += GRAVITY * dt;
      fishY += vy * dt;
      fish.y = fishY;
      fish.rotation = Phaser.Math.Clamp(vy / 900, -0.4, 0.6);

      // Top / bottom bounds
      if (fishY - 20 < top || fishY + 20 > bottom) {
        fishY = Phaser.Math.Clamp(fishY, top + 20, bottom - 20);
        fish.y = fishY;
        endGame();
        return;
      }

      // Scroll gates
      const dx = SCROLL * dt;
      for (const g of gates) {
        g.x -= dx;
        g.topRect.x = g.x;
        g.botRect.x = g.x;
        g.topCap.x = g.x;
        g.botCap.x = g.x;

        if (!g.passed && g.x < fishX) {
          g.passed = true;
          score += 1;
          ctx.onScore(score);
        }
        if (collides(g)) {
          endGame();
          return;
        }
      }

      // Recycle gates that left the screen
      for (const g of gates) {
        if (g.x < -PILLAR_W) {
          g.x = nextSpawnX;
          nextSpawnX += SPAWN_GAP;
          g.gapCenter = randGapCenter();
          g.passed = false;
          layoutGate(g);
        }
      }
      // keep nextSpawnX trailing the rightmost gate
      let maxX = -Infinity;
      for (const g of gates) maxX = Math.max(maxX, g.x);
      nextSpawnX = maxX + SPAWN_GAP;
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      scene.input.off('pointerdown', onPointerDown, this);
    },
  } satisfies ArcadeGame;
};
