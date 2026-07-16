import {
  Application,
  BlurFilter,
  Container,
  FederatedPointerEvent,
  Graphics,
  Text,
} from "pixi.js";
import "pixi.js/unsafe-eval";
import Matter from "matter-js";
import { FRUITS, LEVELS, WORLD } from "./data";
import { haptic, sounds } from "./audio";
import type { GameCallbacks, GameControls, GameResult, GameSnapshot, GameStatus } from "./types";

type CardNode = {
  id: number;
  tier: number;
  layer: number;
  active: boolean;
  x: number;
  y: number;
  view: Container;
  locked: boolean;
};

type FruitNode = {
  body: Matter.Body;
  tier: number;
  view: Container;
};

type Particle = {
  view: Graphics;
  vx: number;
  vy: number;
  gravity: number;
  life: number;
  maxLife: number;
  spin: number;
};

type Ring = { view: Graphics; life: number; maxLife: number };
type FloatLabel = { view: Text; life: number; maxLife: number };

const { Engine, Bodies, Body, Composite, Events } = Matter;
const CARD_W = 58;
const CARD_H = 66;

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

function multiplier(combo: number) {
  if (combo >= 6) return 3;
  if (combo >= 5) return 2.5;
  if (combo >= 4) return 2;
  if (combo >= 3) return 1.5;
  if (combo >= 2) return 1.25;
  return 1;
}

export class FruitGame implements GameControls {
  private app = new Application();
  private engine = Engine.create({ gravity: { x: 0, y: 1.08 } });
  private root = new Container();
  private world = new Container();
  private ambientLayer = new Container();
  private cardLayer = new Container();
  private fruitLayer = new Container();
  private dropLayer = new Container();
  private dropPreviewLayer = new Container();
  private fxLayer = new Container();
  private trayLayer = new Container();
  private cards: CardNode[] = [];
  private fruits = new Map<number, FruitNode>();
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private labels: FloatLabel[] = [];
  private tray: number[] = [];
  private pendingDrops: number[] = [];
  private dropToken = 0;
  private merging = new Set<number>();
  private timers = new Set<number>();
  private callbacks: GameCallbacks;
  private levelIndex: number;
  private status: GameStatus = "playing";
  private score = 0;
  private combo = 0;
  private maxCombo = 0;
  private maxFruitTier = 0;
  private comboAt = 0;
  private dangerSince = 0;
  private dangerProgress = 0;
  private exhaustedSince = 0;
  private startedAt = Date.now();
  private undoLeft = 1;
  private shuffleLeft = 3;
  private juiceLeft = 1;
  private lastPick: CardNode | null = null;
  private shake = 0;
  private elapsed = 0;
  private paused = false;
  private destroyed = false;

  private constructor(levelIndex: number, callbacks: GameCallbacks) {
    this.levelIndex = Math.max(0, Math.min(levelIndex, LEVELS.length - 1));
    this.callbacks = callbacks;
  }

  static async create(canvas: HTMLCanvasElement, levelIndex: number, callbacks: GameCallbacks) {
    const game = new FruitGame(levelIndex, callbacks);
    await game.initialize(canvas);
    return game;
  }

  private async initialize(canvas: HTMLCanvasElement) {
    await this.app.init({
      canvas,
      width: WORLD.width,
      height: WORLD.height,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      powerPreference: "high-performance",
    });
    this.app.stage.addChild(this.root);
    this.root.addChild(this.ambientLayer, this.world, this.dropLayer, this.fxLayer);
    this.world.addChild(this.cardLayer, this.trayLayer, this.fruitLayer);
    this.dropLayer.addChild(this.dropPreviewLayer);
    this.drawScene();
    this.createPhysicsWorld();
    this.createCards();
    this.drawTray();
    Events.on(this.engine, "collisionStart", this.onCollision);
    this.app.ticker.add(this.tick);
    this.emitSnapshot();
    if (this.levelIndex === 0) {
      this.callbacks.onToast("合成演示 · 两颗葡萄正在相遇", "cyan");
      this.setTimer(() => this.spawnFruit(0, WORLD.width / 2 - 24, WORLD.box.y + 28), 320);
      this.setTimer(() => this.spawnFruit(0, WORLD.width / 2 + 24, WORLD.box.y + 28), 480);
    }
  }

  private drawScene() {
    const background = new Graphics()
      .rect(0, 0, WORLD.width, WORLD.height)
      .fill({ color: 0x130b28 });
    this.ambientLayer.addChild(background);

    const haloA = new Graphics().circle(70, 175, 115).fill({ color: 0x6c28d9, alpha: 0.2 });
    const haloB = new Graphics().circle(375, 610, 145).fill({ color: 0xff3d81, alpha: 0.13 });
    const haloC = new Graphics().circle(225, 820, 120).fill({ color: 0x00d4ff, alpha: 0.09 });
    haloA.filters = [new BlurFilter({ strength: 48 })];
    haloB.filters = [new BlurFilter({ strength: 58 })];
    haloC.filters = [new BlurFilter({ strength: 52 })];
    this.ambientLayer.addChild(haloA, haloB, haloC);

    for (let index = 0; index < 42; index += 1) {
      const star = new Graphics()
        .circle(0, 0, 0.7 + Math.random() * 1.4)
        .fill({ color: index % 4 === 0 ? 0xffd166 : 0xffffff, alpha: 0.25 + Math.random() * 0.55 });
      star.position.set(Math.random() * WORLD.width, Math.random() * WORLD.height);
      star.label = `star-${Math.random() * 10}`;
      this.ambientLayer.addChild(star);
    }

    const stackPanel = new Graphics()
      .roundRect(WORLD.stack.x, WORLD.stack.y, WORLD.stack.width, WORLD.stack.height, 30)
      .fill({ color: 0x211443, alpha: 0.72 })
      .stroke({ color: 0xa56cff, alpha: 0.25, width: 1.5 });
    const trayPanel = new Graphics()
      .roundRect(WORLD.tray.x, WORLD.tray.y, WORLD.tray.width, WORLD.tray.height, 22)
      .fill({ color: 0x241647, alpha: 0.94 })
      .stroke({ color: 0xff5fa2, alpha: 0.35, width: 1.5 });
    const boxPanel = new Graphics()
      .roundRect(WORLD.box.x, WORLD.box.y, WORLD.box.width, WORLD.box.height, 28)
      .fill({ color: 0x0d1731, alpha: 0.72 })
      .stroke({ color: 0x46ddff, alpha: 0.42, width: 2 });
    const danger = new Graphics()
      .moveTo(WORLD.box.x + 14, WORLD.dangerY)
      .lineTo(WORLD.box.x + WORLD.box.width - 14, WORLD.dangerY)
      .stroke({ color: 0xff476f, alpha: 0.48, width: 2 });
    danger.label = "danger-line";
    this.ambientLayer.addChild(stackPanel, trayPanel, boxPanel, danger);

    const stackLabel = new Text({
      text: "FRUIT DECK  ·  只点亮起的卡片",
      style: { fontFamily: "system-ui", fontSize: 10, fontWeight: "700", fill: 0xcbb9f6, letterSpacing: 1.6 },
    });
    stackLabel.position.set(29, 114);
    this.ambientLayer.addChild(stackLabel);

    const dangerLabel = new Text({
      text: "⚠ 甜度警戒线",
      style: { fontFamily: "system-ui", fontSize: 10, fontWeight: "700", fill: 0xff7893, letterSpacing: 1 },
    });
    dangerLabel.position.set(31, WORLD.dangerY - 18);
    this.ambientLayer.addChild(dangerLabel);

    const mergeLabel = new Text({
      text: "MERGE LAB  ·  同级水果相撞升级",
      style: { fontFamily: "system-ui", fontSize: 9, fontWeight: "800", fill: 0x76e7ff, letterSpacing: 1.1 },
    });
    mergeLabel.anchor.set(1, 0);
    mergeLabel.position.set(WORLD.box.x + WORLD.box.width - 20, WORLD.box.y + 12);
    this.ambientLayer.addChild(mergeLabel);

    const dropTarget = new Graphics()
      .roundRect(WORLD.box.x, WORLD.box.y, WORLD.box.width, WORLD.box.height, 28)
      .fill({ color: 0xffffff, alpha: 0.001 });
    dropTarget.eventMode = "static";
    dropTarget.cursor = "crosshair";
    dropTarget.on("pointertap", (event: FederatedPointerEvent) => {
      if (this.pendingDrops.length > 0) this.dropPending(event.global.x);
    });
    this.dropLayer.addChildAt(dropTarget, 0);
  }

  private createPhysicsWorld() {
    const box = WORLD.box;
    Composite.add(this.engine.world, [
      Bodies.rectangle(box.x - 6, box.y + box.height / 2, 20, box.height + 60, { isStatic: true, label: "wall" }),
      Bodies.rectangle(box.x + box.width + 6, box.y + box.height / 2, 20, box.height + 60, { isStatic: true, label: "wall" }),
      Bodies.rectangle(box.x + box.width / 2, box.y + box.height + 6, box.width + 40, 20, { isStatic: true, label: "floor" }),
    ]);
  }

  private createCards() {
    const definition = LEVELS[this.levelIndex];
    const tiers = shuffle(definition.cards.flatMap(({ tier, count }) => Array.from({ length: count }, () => tier)));
    const perLayer = 9;

    tiers.forEach((tier, index) => {
      const layer = Math.floor(index / perLayer);
      const slot = index % perLayer;
      const col = slot % 5;
      const row = Math.floor(slot / 5);
      const layerShiftX = ((layer % 3) - 1) * 17;
      const layerShiftY = ((layer * 13) % 24) - 12;
      const rowWidth = row === 0 ? 5 : 4;
      const xStart = WORLD.width / 2 - ((rowWidth - 1) * 69) / 2;
      const x = xStart + col * 69 + layerShiftX + (Math.random() - 0.5) * 4;
      const y = 185 + row * 88 + layerShiftY + (Math.random() - 0.5) * 5;
      const locked = Math.random() < definition.specialRate && layer < Math.max(1, Math.floor(tiers.length / perLayer) - 1);
      const card: CardNode = {
        id: index + 1,
        tier,
        layer,
        active: true,
        x,
        y,
        view: this.makeCard(tier, locked),
        locked,
      };
      card.view.position.set(x, y);
      card.view.zIndex = layer;
      card.view.on("pointertap", (event: FederatedPointerEvent) => {
        event.stopPropagation();
        this.pickCard(card);
      });
      this.cards.push(card);
      this.cardLayer.addChild(card.view);
    });
    this.cardLayer.sortableChildren = true;
    this.updateCardAccess();
  }

  private makeCard(tier: number, locked: boolean) {
    const fruit = FRUITS[tier];
    const view = new Container();
    const shadow = new Graphics()
      .roundRect(-CARD_W / 2 + 2, -CARD_H / 2 + 5, CARD_W, CARD_H, 15)
      .fill({ color: 0x05030c, alpha: 0.44 });
    const glow = new Graphics()
      .roundRect(-CARD_W / 2 - 2, -CARD_H / 2 - 2, CARD_W + 4, CARD_H + 4, 17)
      .fill({ color: fruit.glow, alpha: 0.15 });
    const face = new Graphics()
      .roundRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 15)
      .fill({ color: 0xfff7ed })
      .stroke({ color: fruit.color, alpha: 0.8, width: 2 });
    const sheen = new Graphics()
      .roundRect(-CARD_W / 2 + 5, -CARD_H / 2 + 5, CARD_W - 10, 15, 8)
      .fill({ color: 0xffffff, alpha: 0.55 });
    const emoji = new Text({
      text: fruit.emoji,
      style: { fontSize: 31, align: "center", dropShadow: { color: 0x4b2348, alpha: 0.18, blur: 2, distance: 2 } },
    });
    emoji.anchor.set(0.5);
    emoji.position.set(0, -3);
    view.addChild(shadow, glow, face, sheen, emoji);
    if (locked) {
      const lock = new Text({ text: "❄", style: { fontSize: 13 } });
      lock.anchor.set(0.5);
      lock.position.set(19, -25);
      lock.label = "lock";
      view.addChild(lock);
    }
    return view;
  }

  private isCovered(card: CardNode) {
    return this.cards.some((other) => {
      if (!other.active || other.layer <= card.layer || other.id === card.id) return false;
      const overlapX = Math.max(0, CARD_W - Math.abs(other.x - card.x));
      const overlapY = Math.max(0, CARD_H - Math.abs(other.y - card.y));
      return overlapX * overlapY > 520;
    });
  }

  private updateCardAccess() {
    const active = this.cards.filter((card) => card.active);
    const accessible = active.filter((card) => !this.isCovered(card));
    if (accessible.length > 0 && accessible.every((card) => card.locked)) {
      accessible.slice(0, 2).forEach((card) => {
        card.locked = false;
        card.view.getChildByLabel("lock")?.destroy();
      });
      this.callbacks.onToast("冰晶松动 · 解锁两张卡", "cyan");
    }
    active.forEach((card) => {
      const covered = this.isCovered(card);
      const usable = !covered && !card.locked;
      card.view.eventMode = usable ? "static" : "none";
      card.view.cursor = usable ? "pointer" : "default";
      card.view.alpha = usable ? 1 : covered ? 0.46 : 0.72;
      card.view.scale.set(usable ? 1 : 0.97);
    });
  }

  private pickCard(card: CardNode) {
    if (this.status !== "playing" || this.paused || !card.active || this.isCovered(card) || card.locked) return;
    sounds.tap();
    haptic();
    card.active = false;
    card.view.visible = false;
    this.tray.push(card.tier);
    this.lastPick = card;
    this.unlockNearby(card);
    this.updateCardAccess();
    this.drawTray();

    const matches = this.tray.reduce((count, tier) => count + Number(tier === card.tier), 0);
    if (matches >= 3) {
      this.lastPick = null;
      let removed = 0;
      this.tray = this.tray.filter((tier) => {
        if (tier === card.tier && removed < 3) {
          removed += 1;
          return false;
        }
        return true;
      });
      this.registerCombo();
      const points = Math.round((card.tier + 1) * 90 * multiplier(this.combo));
      this.addScore(points, WORLD.width / 2, WORLD.tray.y + 18);
      sounds.match();
      haptic([16, 35, 22]);
      this.burst(WORLD.width / 2, WORLD.tray.y + 28, FRUITS[card.tier].color, 26);
      this.ring(WORLD.width / 2, WORLD.tray.y + 30, FRUITS[card.tier].glow);
      this.shake = Math.max(this.shake, 7 + this.combo * 1.2);
      this.callbacks.onToast(this.comboMessage(), this.combo >= 4 ? "gold" : "pink");
      this.setTimer(() => this.queueDrop(card.tier), 260);
      this.drawTray();
    }

    if (this.tray.length >= 7) {
      this.finish("lost", "卡槽装满啦，再试一次就能逆转");
    } else {
      this.emitSnapshot();
    }
  }

  private unlockNearby(card: CardNode) {
    this.cards.forEach((other) => {
      if (!other.active || !other.locked) return;
      if (Math.hypot(other.x - card.x, other.y - card.y) < 95) {
        other.locked = false;
        other.view.getChildByLabel("lock")?.destroy();
        this.burst(other.x, other.y, 0x8be9fd, 10);
      }
    });
  }

  private drawTray() {
    this.trayLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
    const slotWidth = 49;
    for (let index = 0; index < 7; index += 1) {
      const x = WORLD.tray.x + 25 + index * 56.5;
      const slot = new Graphics()
        .roundRect(-22, -25, 44, 50, 13)
        .fill({ color: index < this.tray.length ? 0x38245b : 0x160f2b, alpha: 0.82 })
        .stroke({ color: index < this.tray.length ? 0xff6fb1 : 0x7d65a1, alpha: 0.32, width: 1.2 });
      slot.position.set(x, WORLD.tray.y + WORLD.tray.height / 2);
      this.trayLayer.addChild(slot);
      const tier = this.tray[index];
      if (tier !== undefined) {
        const emoji = new Text({ text: FRUITS[tier].emoji, style: { fontSize: 26 } });
        emoji.anchor.set(0.5);
        emoji.position.set(x, WORLD.tray.y + WORLD.tray.height / 2 - 1);
        this.trayLayer.addChild(emoji);
      }
      void slotWidth;
    }
  }

  private queueDrop(tier: number) {
    if (this.destroyed || this.status !== "playing") return;
    const wasEmpty = this.pendingDrops.length === 0;
    this.pendingDrops.push(tier);
    this.renderDropPreview();
    if (wasEmpty) {
      this.callbacks.onToast(`获得 ${FRUITS[tier].emoji} · 点击果箱选择落点`, "gold");
      this.scheduleAutoDrop();
    }
  }

  private preferredDropX(tier: number) {
    const sameTier = [...this.fruits.values()]
      .filter((fruit) => fruit.tier === tier && !this.merging.has(fruit.body.id))
      .sort((a, b) => b.body.position.y - a.body.position.y)[0];
    return sameTier?.body.position.x ?? WORLD.box.x + WORLD.box.width / 2;
  }

  private renderDropPreview() {
    this.dropPreviewLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
    const tier = this.pendingDrops[0];
    if (tier === undefined || this.status !== "playing") return;
    const x = this.preferredDropX(tier);
    const guide = new Graphics()
      .moveTo(0, 0)
      .lineTo(0, 52)
      .stroke({ color: FRUITS[tier].glow, alpha: 0.7, width: 2 });
    guide.position.set(x, WORLD.box.y + 22);
    guide.blendMode = "add";
    const halo = new Graphics()
      .circle(0, 0, FRUITS[tier].radius + 10)
      .fill({ color: FRUITS[tier].glow, alpha: 0.2 })
      .stroke({ color: 0xffffff, alpha: 0.7, width: 1.5 });
    halo.position.set(x, WORLD.box.y + 27);
    const emoji = new Text({ text: FRUITS[tier].emoji, style: { fontSize: Math.max(24, FRUITS[tier].radius * 1.15) } });
    emoji.anchor.set(0.5);
    emoji.position.copyFrom(halo.position);
    const hint = new Text({
      text: `点击果箱投放  ${FRUITS[tier].emoji}${this.pendingDrops.length > 1 ? `  ×${this.pendingDrops.length}` : ""}`,
      style: { fontFamily: "system-ui", fontSize: 10, fontWeight: "900", fill: 0xffffff, stroke: { color: 0x25123f, width: 4 } },
    });
    hint.anchor.set(0.5);
    hint.position.set(WORLD.width / 2, WORLD.box.y + 82);
    this.dropPreviewLayer.addChild(guide, halo, emoji, hint);
  }

  private scheduleAutoDrop() {
    const token = ++this.dropToken;
    this.setTimer(() => {
      if (token === this.dropToken && this.pendingDrops.length > 0) this.dropPending();
    }, 2_800);
  }

  private dropPending(chosenX?: number) {
    if (this.status !== "playing") return;
    const tier = this.pendingDrops.shift();
    if (tier === undefined) return;
    this.dropToken += 1;
    const margin = FRUITS[tier].radius + 9;
    const fallbackX = this.preferredDropX(tier);
    const x = Math.max(WORLD.box.x + margin, Math.min(WORLD.box.x + WORLD.box.width - margin, chosenX ?? fallbackX));
    this.spawnFruit(tier, x, WORLD.box.y + 18);
    this.renderDropPreview();
    if (this.pendingDrops.length > 0) this.scheduleAutoDrop();
  }

  private spawnFruit(tier: number, x = WORLD.box.x + 55 + Math.random() * (WORLD.box.width - 110), y = WORLD.box.y + 18) {
    if (this.destroyed || this.status !== "playing") return;
    const definition = FRUITS[tier];
    const body = Bodies.circle(x, y, definition.radius, {
      restitution: 0.22,
      friction: 0.16,
      frictionAir: 0.008,
      density: 0.0012 + tier * 0.00008,
      label: `fruit-${tier}`,
    });
    body.plugin = { tier, birth: performance.now() };
    const view = this.makeFruit(tier);
    view.position.set(x, y);
    this.fruitLayer.addChild(view);
    this.fruits.set(body.id, { body, tier, view });
    Composite.add(this.engine.world, body);
    this.maxFruitTier = Math.max(this.maxFruitTier, tier);
    this.burst(x, y + 6, definition.glow, 10);
    if (tier >= LEVELS[this.levelIndex].target) {
      this.setTimer(() => this.finish("won", `${definition.name}诞生，甜度爆表！`), 850);
    }
    this.emitSnapshot();
  }

  private makeFruit(tier: number) {
    const definition = FRUITS[tier];
    const view = new Container();
    const aura = new Graphics().circle(0, 0, definition.radius + 7).fill({ color: definition.glow, alpha: 0.14 });
    aura.filters = [new BlurFilter({ strength: 7 })];
    const body = new Graphics()
      .circle(0, 0, definition.radius)
      .fill({ color: definition.color, alpha: 0.92 })
      .stroke({ color: definition.glow, alpha: 0.78, width: Math.max(2, definition.radius * 0.09) });
    const shine = new Graphics().ellipse(-definition.radius * 0.28, -definition.radius * 0.33, definition.radius * 0.42, definition.radius * 0.22)
      .fill({ color: 0xffffff, alpha: 0.38 });
    const emoji = new Text({ text: definition.emoji, style: { fontSize: Math.max(20, definition.radius * 1.15) } });
    emoji.anchor.set(0.5);
    emoji.position.set(0, 1);
    view.addChild(aura, body, shine, emoji);
    view.scale.set(0.2);
    return view;
  }

  private onCollision = (event: Matter.IEventCollision<Matter.Engine>) => {
    if (this.status !== "playing") return;
    for (const pair of event.pairs) {
      const nodeA = this.fruits.get(pair.bodyA.id);
      const nodeB = this.fruits.get(pair.bodyB.id);
      if (!nodeA || !nodeB || nodeA.tier !== nodeB.tier || nodeA.tier >= FRUITS.length - 1) continue;
      if (this.merging.has(pair.bodyA.id) || this.merging.has(pair.bodyB.id)) continue;
      this.mergeFruits(nodeA, nodeB);
    }
  };

  private mergeFruits(first: FruitNode, second: FruitNode) {
    this.merging.add(first.body.id);
    this.merging.add(second.body.id);
    const tier = first.tier + 1;
    const x = (first.body.position.x + second.body.position.x) / 2;
    const y = (first.body.position.y + second.body.position.y) / 2;
    const velocityX = (first.body.velocity.x + second.body.velocity.x) * 0.22;
    this.removeFruit(first);
    this.removeFruit(second);
    this.registerCombo();
    const points = Math.round(110 * 2 ** Math.min(tier, 12) * multiplier(this.combo));
    this.addScore(points, x, y);
    this.burst(x, y, FRUITS[tier].color, 20 + tier * 2);
    this.ring(x, y, FRUITS[tier].glow);
    if (tier >= 8) this.ring(x, y, 0xffffff, 1.4);
    this.shake = Math.min(19, 6 + tier * 0.9 + this.combo);
    sounds.merge(tier);
    haptic(tier >= 8 ? [24, 35, 28, 35, 38] : [18, 28, 18]);
    this.callbacks.onToast(tier >= 11 ? "大果合成 · 果汁风暴！" : this.comboMessage(), tier >= 8 ? "gold" : "cyan");
    this.setTimer(() => {
      this.spawnFruit(tier, x, y - 5);
      const newest = [...this.fruits.values()].at(-1);
      if (newest) Body.setVelocity(newest.body, { x: velocityX, y: -2.2 });
    }, 55);
  }

  private removeFruit(node: FruitNode) {
    Composite.remove(this.engine.world, node.body);
    this.fruits.delete(node.body.id);
    node.view.destroy({ children: true });
  }

  private registerCombo() {
    const now = performance.now();
    this.combo = now - this.comboAt < 2_300 ? this.combo + 1 : 1;
    this.comboAt = now;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
  }

  private comboMessage() {
    if (this.combo >= 7) return `×${this.combo} 果王节拍！`;
    if (this.combo >= 5) return `×${this.combo} 彩虹连锁！`;
    if (this.combo >= 3) return `×${this.combo} 果汁爆发！`;
    return this.combo === 2 ? "×2 太甜了！" : "清爽三消！";
  }

  private addScore(points: number, x: number, y: number) {
    this.score += points;
    const label = new Text({
      text: `+${points.toLocaleString()}`,
      style: {
        fontFamily: "system-ui",
        fontSize: Math.min(27, 17 + this.combo * 1.5),
        fontWeight: "900",
        fill: this.combo >= 4 ? 0xffe169 : 0xffffff,
        stroke: { color: 0x3b165a, width: 4 },
      },
    });
    label.anchor.set(0.5);
    label.position.set(x, y);
    this.fxLayer.addChild(label);
    this.labels.push({ view: label, life: 1, maxLife: 1 });
    this.emitSnapshot();
  }

  private burst(x: number, y: number, color: number, amount: number) {
    for (let index = 0; index < amount; index += 1) {
      const size = 1.8 + Math.random() * 4.5;
      const shape = new Graphics();
      if (index % 3 === 0) shape.star(0, 0, 4, size, size * 0.3).fill({ color: index % 5 === 0 ? 0xffffff : color });
      else shape.circle(0, 0, size).fill({ color: index % 6 === 0 ? 0xffe169 : color });
      shape.position.set(x, y);
      shape.blendMode = "add";
      this.fxLayer.addChild(shape);
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 6.2;
      const life = 0.45 + Math.random() * 0.65;
      this.particles.push({
        view: shape,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.3,
        gravity: 0.1 + Math.random() * 0.08,
        life,
        maxLife: life,
        spin: (Math.random() - 0.5) * 0.25,
      });
    }
  }

  private ring(x: number, y: number, color: number, size = 1) {
    const ring = new Graphics().circle(0, 0, 18).stroke({ color, alpha: 0.95, width: 4 / size });
    ring.position.set(x, y);
    ring.scale.set(size);
    ring.blendMode = "add";
    this.fxLayer.addChild(ring);
    this.rings.push({ view: ring, life: 0.55, maxLife: 0.55 });
  }

  private tick = (ticker: { deltaMS: number }) => {
    if (this.paused || this.destroyed) return;
    const deltaMs = Math.min(ticker.deltaMS, 1000 / 60);
    const delta = deltaMs / 16.667;
    this.elapsed += deltaMs / 1000;
    Engine.update(this.engine, deltaMs);

    this.fruits.forEach((fruit) => {
      fruit.view.position.copyFrom(fruit.body.position);
      fruit.view.rotation = fruit.body.angle;
      if (fruit.view.scale.x < 0.99) {
        const next = Math.min(1, fruit.view.scale.x + 0.11 * delta);
        fruit.view.scale.set(next);
      }
    });
    this.attractMatchingFruits();

    if (this.dropPreviewLayer.children.length > 0) {
      this.dropPreviewLayer.alpha = 0.8 + Math.sin(this.elapsed * 5.5) * 0.2;
    }

    this.ambientLayer.children.forEach((child, index) => {
      if (child.label?.startsWith("star-")) child.alpha = 0.35 + Math.sin(this.elapsed * 1.7 + index) * 0.25;
    });

    this.updateParticles(delta, deltaMs / 1000);
    this.updateDanger();
    this.checkExhausted();

    if (this.shake > 0.15) {
      this.world.position.set((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
      this.shake *= 0.86;
    } else {
      this.world.position.set(0, 0);
      this.shake = 0;
    }
  };

  private updateParticles(delta: number, seconds: number) {
    this.particles = this.particles.filter((particle) => {
      particle.life -= seconds;
      if (particle.life <= 0) {
        particle.view.destroy();
        return false;
      }
      particle.vy += particle.gravity * delta;
      particle.view.x += particle.vx * delta;
      particle.view.y += particle.vy * delta;
      particle.view.rotation += particle.spin * delta;
      particle.view.alpha = particle.life / particle.maxLife;
      particle.view.scale.set(0.6 + particle.life / particle.maxLife);
      return true;
    });
    this.rings = this.rings.filter((ring) => {
      ring.life -= seconds;
      if (ring.life <= 0) {
        ring.view.destroy();
        return false;
      }
      const progress = 1 - ring.life / ring.maxLife;
      ring.view.scale.set(1 + progress * 5.5);
      ring.view.alpha = 1 - progress;
      return true;
    });
    this.labels = this.labels.filter((label) => {
      label.life -= seconds;
      if (label.life <= 0) {
        label.view.destroy();
        return false;
      }
      label.view.y -= 1.05 * delta;
      label.view.alpha = Math.min(1, label.life * 2.4);
      return true;
    });
  }

  private attractMatchingFruits() {
    const fruits = [...this.fruits.values()];
    for (let firstIndex = 0; firstIndex < fruits.length; firstIndex += 1) {
      const first = fruits[firstIndex];
      if (this.merging.has(first.body.id)) continue;
      for (let secondIndex = firstIndex + 1; secondIndex < fruits.length; secondIndex += 1) {
        const second = fruits[secondIndex];
        if (first.tier !== second.tier || this.merging.has(second.body.id)) continue;
        const dx = second.body.position.x - first.body.position.x;
        const dy = second.body.position.y - first.body.position.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 1 || distance > 250) continue;
        const settled = first.body.speed + second.body.speed < 7;
        if (!settled && Math.abs(dy) > 120) continue;
        const strength = Math.min(0.00016 + first.tier * 0.000012, distance * 0.0000012);
        const forceX = (dx / distance) * strength;
        const forceY = (dy / distance) * strength * 0.18;
        Body.applyForce(first.body, first.body.position, { x: forceX, y: forceY });
        Body.applyForce(second.body, second.body.position, { x: -forceX, y: -forceY });
      }
    }
  }

  private updateDanger() {
    if (this.status !== "playing") return;
    const now = performance.now();
    const overflowing = [...this.fruits.values()].some((fruit) => {
      const birth = Number(fruit.body.plugin.birth || 0);
      return now - birth > 1_350 && fruit.body.bounds.min.y < WORLD.dangerY;
    });
    if (overflowing) {
      if (!this.dangerSince) this.dangerSince = now;
      this.dangerProgress = Math.min(1, (now - this.dangerSince) / 2_500);
      const line = this.ambientLayer.getChildByLabel("danger-line");
      if (line) line.alpha = 0.45 + Math.sin(now / 75) * 0.4;
      if (this.dangerProgress >= 1) this.finish("lost", "甜度冲破警戒线，果箱爆满了");
    } else {
      this.dangerSince = 0;
      this.dangerProgress = Math.max(0, this.dangerProgress - 0.035);
    }
  }

  private checkExhausted() {
    if (this.status !== "playing" || this.cards.some((card) => card.active) || this.tray.length > 0 || this.pendingDrops.length > 0) {
      this.exhaustedSince = 0;
      return;
    }
    const tierCounts = new Map<number, number>();
    this.fruits.forEach((fruit) => tierCounts.set(fruit.tier, (tierCounts.get(fruit.tier) || 0) + 1));
    const possibleMerge = [...tierCounts.values()].some((count) => count >= 2) || this.merging.size > 0;
    if (possibleMerge) {
      this.exhaustedSince = 0;
      return;
    }
    if (!this.exhaustedSince) this.exhaustedSince = performance.now();
    if (performance.now() - this.exhaustedSince > 2_600) this.finish("lost", "水果不够继续合成目标，再来一局吧");
  }

  private emitSnapshot() {
    this.callbacks.onSnapshot(this.snapshot());
  }

  private snapshot(): GameSnapshot {
    return {
      status: this.status,
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo,
      maxFruitTier: this.maxFruitTier,
      remainingCards: this.cards.filter((card) => card.active).length,
      trayCount: this.tray.length,
      dangerProgress: this.dangerProgress,
      undoLeft: this.undoLeft,
      shuffleLeft: this.shuffleLeft,
      juiceLeft: this.juiceLeft,
    };
  }

  private finish(status: "won" | "lost", reason: string) {
    if (this.status !== "playing") return;
    this.status = status;
    this.pendingDrops = [];
    this.dropToken += 1;
    this.renderDropPreview();
    this.shake = status === "won" ? 18 : 7;
    if (status === "won") {
      const bonus = Math.max(0, this.cards.filter((card) => card.active).length * 150 + (7 - this.tray.length) * 300);
      this.score += bonus;
      this.burst(WORLD.width / 2, WORLD.height / 2, 0xffd60a, 90);
      this.ring(WORLD.width / 2, WORLD.height / 2, 0xffffff, 1.6);
      sounds.win();
      haptic([35, 50, 35, 50, 80]);
    } else {
      sounds.lose();
      haptic([60, 60, 110]);
    }
    const result: GameResult = {
      ...this.snapshot(),
      reason,
      durationMs: Date.now() - this.startedAt,
    };
    this.emitSnapshot();
    this.setTimer(() => this.callbacks.onFinish(result), status === "won" ? 900 : 350);
  }

  undo = () => {
    if (this.paused || this.status !== "playing" || this.undoLeft <= 0 || !this.lastPick) return;
    const card = this.lastPick;
    const index = this.tray.lastIndexOf(card.tier);
    if (index < 0) return;
    this.tray.splice(index, 1);
    card.active = true;
    card.view.visible = true;
    this.lastPick = null;
    this.undoLeft -= 1;
    this.drawTray();
    this.updateCardAccess();
    this.callbacks.onToast("时间倒流 · 卡片已归位", "cyan");
    this.emitSnapshot();
  };

  shuffle = () => {
    if (this.paused || this.status !== "playing" || this.shuffleLeft <= 0) return;
    const active = this.cards.filter((card) => card.active);
    const positions = shuffle(active.map(({ x, y }) => ({ x, y })));
    active.forEach((card, index) => {
      card.x = positions[index].x;
      card.y = positions[index].y;
      card.view.position.set(card.x, card.y);
    });
    this.shuffleLeft -= 1;
    this.lastPick = null;
    this.updateCardAccess();
    this.burst(WORLD.width / 2, WORLD.stack.y + WORLD.stack.height / 2, 0xb88cff, 34);
    this.callbacks.onToast("果园洗牌 · 路线刷新", "pink");
    haptic([12, 24, 12]);
    this.emitSnapshot();
  };

  juice = () => {
    if (this.paused || this.status !== "playing" || this.juiceLeft <= 0) return;
    const target = [...this.fruits.values()].sort((a, b) => b.tier - a.tier)[0];
    if (!target || target.tier <= 0) {
      this.callbacks.onToast("箱里还没有可榨汁的水果", "cyan");
      return;
    }
    const { x, y } = target.body.position;
    const nextTier = target.tier - 1;
    this.removeFruit(target);
    this.juiceLeft -= 1;
    this.spawnFruit(nextTier, x, y - 8);
    this.burst(x, y, 0x46ddff, 28);
    this.callbacks.onToast(`榨汁降压 · ${FRUITS[nextTier].name}`, "cyan");
    haptic([24, 30, 18]);
    this.emitSnapshot();
  };

  pause = () => {
    this.paused = true;
  };

  resume = () => {
    this.paused = false;
  };

  private setTimer(callback: () => void, delay: number) {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      callback();
    }, delay);
    this.timers.add(id);
  }

  destroy = () => {
    this.destroyed = true;
    this.timers.forEach((id) => window.clearTimeout(id));
    this.timers.clear();
    Events.off(this.engine, "collisionStart", this.onCollision);
    this.app.ticker.remove(this.tick);
    Composite.clear(this.engine.world, false, true);
    this.app.destroy({ removeView: false }, { children: true, texture: true });
  };
}
