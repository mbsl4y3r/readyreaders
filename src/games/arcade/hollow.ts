import Phaser from 'phaser';
import type { RunArcadeGame, ArcadeGame, ArcadeCtx } from './types';
import { emojiText } from '../../ui/kit';
import { chime } from '../../services/audio';

/**
 * Hop Hollow — a gentle auto-running platformer. The hedgehog runs right, the
 * world scrolls left, and Evie TAPS ANYWHERE to hop. Collect berries for score.
 * The only way to lose is falling into a gap; landings are forgiving (coyote
 * time + generous hitboxes). Endless — segments keep generating.
 */
export const run: RunArcadeGame = (scene: Phaser.Scene, ctx: ArcadeCtx) => {
  const { width, height, hudBottom, theme } = ctx;

  // Soft playfield background (its own place).
  const bg = scene.add.rectangle(width / 2, height / 2, width, height, theme.bgTop);
  ctx.layer.add(bg);
  const meadow = scene.add.rectangle(width / 2, height * 0.72, width, height * 0.56, theme.bgBottom);
  meadow.setAlpha(0.55);
  ctx.layer.add(meadow);

  // --- World geometry ---------------------------------------------------
  const PLAYER_X = 260;             // hedgehog stays at this screen x
  const SURFACE_Y = height - 150;   // top of the ground (feet rest here)
  const GROUND_H = height - SURFACE_Y;
  const GRAVITY = 1800;             // px / s^2
  const JUMP_V = -760;              // px / s
  const SCROLL = 205;               // px / s — gentle
  const COYOTE = 130;               // ms of forgiveness after leaving ground

  interface Platform { worldX: number; w: number; body: Phaser.GameObjects.Rectangle; grass: Phaser.GameObjects.Rectangle; }
  interface Prop { worldX: number; obj: Phaser.GameObjects.Text; collected: boolean; }

  const platforms: Platform[] = [];
  const berries: Prop[] = [];
  const logs: Prop[] = [];

  let scroll = 0;          // how far the world has scrolled left
  let nextEdge = 0;        // world x where the next platform should begin
  let score = 0;
  let feetY = SURFACE_Y;   // player's feet y
  let vy = 0;
  let sinceGround = 0;     // ms since last on solid ground
  let over = false;
  let destroyed = false;

  const rand = (a: number, b: number) => a + Math.random() * (b - a);

  function addPlatform(worldX: number, w: number): void {
    const body = scene.add.rectangle(0, SURFACE_Y + GROUND_H / 2, w, GROUND_H, theme.accent);
    body.setOrigin(0, 0.5);
    ctx.layer.add(body);
    const grass = scene.add.rectangle(0, SURFACE_Y, w, 16, 0xffffff);
    grass.setOrigin(0, 0.5);
    grass.setAlpha(0.35);
    ctx.layer.add(grass);
    platforms.push({ worldX, w, body, grass });
  }

  function addBerry(worldX: number, worldY: number): void {
    const obj = emojiText(scene, 0, worldY, '🫐', 46);
    ctx.layer.add(obj);
    berries.push({ worldX, obj, collected: false });
  }

  function addLog(worldX: number): void {
    const obj = emojiText(scene, 0, SURFACE_Y - 20, '🪵', 52);
    ctx.layer.add(obj);
    logs.push({ worldX, obj, collected: false });
  }

  // Build a fresh platform (+ its berries / log) and advance nextEdge.
  function grow(): void {
    const w = rand(280, 430);
    addPlatform(nextEdge, w);
    // berries hovering over the platform
    const nBerries = Math.random() < 0.6 ? 2 : 1;
    for (let i = 0; i < nBerries; i++) {
      addBerry(nextEdge + rand(60, w - 60), SURFACE_Y - rand(90, 150));
    }
    // an occasional log to hop
    if (Math.random() < 0.5) addLog(nextEdge + rand(80, w - 80));
    // a reward berry floating over the upcoming gap
    addBerry(nextEdge + w + 65, SURFACE_Y - 175);
    // gentle, clearable gap
    nextEdge += w + rand(95, 150);
  }

  // Starting stretch: a long safe runway, then the endless generator.
  addPlatform(-200, PLAYER_X + 500);
  nextEdge = PLAYER_X + 300;
  while (nextEdge < scroll + width + 500) grow();

  // --- Input: tap anywhere to hop --------------------------------------
  function jump(): void {
    if (over) return;
    if (sinceGround <= COYOTE) {
      vy = JUMP_V;
      sinceGround = COYOTE + 1; // consume the coyote window
      chime('gentle');
    }
  }
  const onDown = () => jump();
  scene.input.on('pointerdown', onDown, this);
  const keys = scene.input.keyboard?.createCursorKeys();

  const player = emojiText(scene, PLAYER_X, feetY - 34, '🦔', 68);
  ctx.layer.add(player);

  function groundUnderPlayer(): boolean {
    const px = scroll + PLAYER_X;
    for (const p of platforms) {
      if (px >= p.worldX && px <= p.worldX + p.w) return true;
    }
    return false;
  }

  function endGame(): void {
    if (over) return;
    over = true;
    chime('fanfare');
    ctx.onGameOver(score);
  }

  return {
    update(_time: number, delta: number): void {
      if (over || destroyed) return;
      const dt = Math.min(delta, 40) / 1000; // clamp long frames

      // keyboard bonus control
      if (keys && (keys.space.isDown || keys.up.isDown)) jump();

      scroll += SCROLL * dt;

      // recycle / generate platforms
      while (nextEdge < scroll + width + 500) grow();

      // vertical physics
      const solid = groundUnderPlayer();
      vy += GRAVITY * dt;
      feetY += vy * dt;
      if (solid && vy >= 0 && feetY >= SURFACE_Y) {
        feetY = SURFACE_Y;
        vy = 0;
        sinceGround = 0;
      } else {
        sinceGround += delta;
      }
      player.y = feetY - 34;
      player.setRotation(vy < -60 ? -0.18 : vy > 260 ? 0.22 : 0);

      // fell into a gap
      if (feetY > height + 60) { endGame(); return; }

      // position + cull platforms
      for (let i = platforms.length - 1; i >= 0; i--) {
        const p = platforms[i];
        if (!p) continue;
        const sx = p.worldX - scroll;
        p.body.x = sx;
        p.grass.x = sx;
        if (sx + p.w < -80) {
          p.body.destroy();
          p.grass.destroy();
          platforms.splice(i, 1);
        }
      }

      // logs (decorative hops)
      for (let i = logs.length - 1; i >= 0; i--) {
        const l = logs[i];
        if (!l) continue;
        l.obj.x = l.worldX - scroll;
        if (l.obj.x < -80) { l.obj.destroy(); logs.splice(i, 1); }
      }

      // berries: move, collect, cull
      const pcY = feetY - 34;
      for (let i = berries.length - 1; i >= 0; i--) {
        const b = berries[i];
        if (!b) continue;
        const sx = b.worldX - scroll;
        b.obj.x = sx;
        if (!b.collected && Math.abs(sx - PLAYER_X) < 56 && Math.abs(b.obj.y - pcY) < 74) {
          b.collected = true;
          b.obj.destroy();
          berries.splice(i, 1);
          score += 1;
          ctx.onScore(score);
          chime('good');
          continue;
        }
        if (sx < -80) { b.obj.destroy(); berries.splice(i, 1); }
      }
      void hudBottom; // gameplay already sits well below the HUD strip
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      scene.input.off('pointerdown', onDown, this);
    },
  } satisfies ArcadeGame;
};
