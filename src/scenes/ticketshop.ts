/**
 * Ticket Shop 🎟️ — the arcade counter where hard-won play tickets buy the
 * fancy, shop-only cosmetics. Tickets come from playing games (see juice.ts),
 * so this is the second, no-reading path to the premium pieces the wardrobe
 * would otherwise charge pearls for.
 *
 * No fail states: an item you can't afford just dims and says "Need more 🎟️".
 * A purchase is the one place tickets are spent and ownership is written; the
 * grid then rebuilds so the card flips to "Owned ✓". The wardrobe is where the
 * item actually gets worn — here we only unlock it into progress.cosmetics.
 */
import Phaser from 'phaser';
import { COSMETICS_BY_ID } from '../avatar/catalog';
import { TICKET_SHOP } from '../services/juice';
import { loadProgress, saveProgress, type ProgressData } from '../services/progress';
import { chime, speakUI } from '../services/audio';
import {
  GAME_W,
  GAME_H,
  readingText,
  emojiText,
  makeButton,
  drawRealmBackground,
  popIn,
} from '../ui/kit';

// Card grid: four columns across, wrapping to a second row. Centres are spaced
// so 200px cards leave a comfortable gutter and the outer cards stay clear of
// the screen edges.
const COL_X = [176, 400, 624, 848];
const ROW_Y = [318, 556];
const CARD_W = 200;
const CARD_H = 224;

export class TicketShopScene extends Phaser.Scene {
  private progress!: ProgressData;

  /** Live ticket balance, rebuilt/refreshed on every purchase. */
  private balanceText!: Phaser.GameObjects.Text;

  /** The whole grid of cards — destroyed and rebuilt after a buy. */
  private grid: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('ticketshop');
  }

  create(): void {
    this.grid = null;
    this.progress = loadProgress();

    // deep arcade-night purple, star twinkles
    drawRealmBackground(this, 0x1a1030, 0x0a0618, ['🎟️', '🎮', '⭐'], 'stars');
    this.cameras.main.fadeIn(300);
    void speakUI('ticket-shop', 'The ticket shop! Spend your game tickets on treasures!');

    readingText(this, GAME_W / 2, 56, 'Ticket Shop 🎟️', 40, '#ffe9a8');

    // home button — always a way back to the map
    const home = makeButton(this, 62, 52, '🏠', () => this.scene.start('map'), {
      emoji: true,
      fontSize: 30,
      width: 76,
      height: 64,
      fill: 0xffffff,
    });
    home.setAlpha(0.85);

    this.buildBalance();
    this.buildCards();
  }

  // -------------------------------------------------------------- balance

  private buildBalance(): void {
    const y = 132;
    emojiText(this, GAME_W / 2 - 40, y, '🎟️', 40);
    this.balanceText = readingText(this, GAME_W / 2 + 4, y, `${this.progress.tickets}`, 40, '#ffffff');
    this.balanceText.setOrigin(0, 0.5);
  }

  private refreshBalance(): void {
    this.balanceText.setText(`${this.progress.tickets}`);
    this.tweens.add({ targets: this.balanceText, scale: 1.25, duration: 140, yoyo: true });
  }

  // ---------------------------------------------------------------- cards

  /** Rebuild the entire grid from current progress (owned / affordable state). */
  private buildCards(): void {
    this.grid?.destroy();
    const grid = this.add.container(0, 0);
    this.grid = grid;

    TICKET_SHOP.forEach((entry, i) => {
      const x = COL_X[i % 4]!;
      const y = ROW_Y[Math.floor(i / 4)]!;
      grid.add(this.makeCard(entry.id, entry.tickets, x, y, i));
    });
  }

  private makeCard(id: string, price: number, x: number, y: number, index: number): Phaser.GameObjects.Container {
    const item = COSMETICS_BY_ID.get(id);
    const emoji = item?.emoji ?? '❓';
    const label = item?.label ?? id;

    const owned = this.progress.cosmetics.includes(id);
    const affordable = this.progress.tickets >= price;

    const card = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.25);
    bg.fillRoundedRect(-CARD_W / 2 + 3, -CARD_H / 2 + 5, CARD_W, CARD_H, 22);
    bg.fillStyle(owned ? 0xfff4d6 : 0xffffff, 1);
    bg.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 22);
    card.add(bg);

    card.add(emojiText(this, 0, -66, emoji, 56));

    const name = readingText(this, 0, -6, label, 20, '#3a2a4a');
    // squeeze long labels so they never spill the card
    const maxLabel = CARD_W - 28;
    if (name.width > maxLabel) name.setScale(maxLabel / name.width);
    card.add(name);

    // price row: 🎟️ N
    card.add(emojiText(this, -22, 34, '🎟️', 26));
    card.add(readingText(this, 14, 34, `${price}`, 24, '#4a5568').setOrigin(0, 0.5));

    if (owned) {
      card.add(readingText(this, 0, 82, 'Owned ✓', 24, '#3c7a3c'));
    } else if (affordable) {
      const get = makeButton(this, 0, 84, 'Get!', () => this.buy(id, price), {
        width: 150,
        height: 60,
        fontSize: 26,
        fill: 0xffe9a8,
      });
      card.add(get);
    } else {
      card.add(readingText(this, 0, 82, 'Need more 🎟️', 18, '#8a7a99'));
      card.setAlpha(0.5);
    }

    popIn(this, card, index * 45);
    return card;
  }

  // ------------------------------------------------------------------ buy

  /** The one place tickets are spent and ownership is written. */
  private buy(id: string, price: number): void {
    // guard against a stale tap racing a rebuild
    if (this.progress.cosmetics.includes(id) || this.progress.tickets < price) return;

    this.progress.tickets -= price;
    this.progress.cosmetics.push(id);
    saveProgress(this.progress);

    chime('good');
    this.refreshBalance();
    this.buildCards();
  }
}
