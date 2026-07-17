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
import {
  rollMutator,
  type GameMode,
  type RelicId,
  type WaveMutator,
} from "./modes";
import type {
  GameCallbacks,
  GameControls,
  GameOptions,
  GameResult,
  GameSnapshot,
  GameStatus,
} from "./types";

type CardSpecial = "normal" | "frozen" | "bomb" | "vine" | "sugar";

type CardNode = {
  id: number;
  tier: number;
  layer: number;
  active: boolean;
  x: number;
  y: number;
  view: Container;
  locked: boolean;
  special: CardSpecial;
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
type ConversionSequence = {
  cards: Container[];
  fruit: Text;
  starts: Array<{ x: number; y: number }>;
  tier: number;
  elapsed: number;
  condensed: boolean;
};
type GoalEnergy = {
  view: Graphics;
  fromX: number;
  toX: number;
  y: number;
  life: number;
  maxLife: number;
};

const { Engine, Bodies, Body, Composite, Events } = Matter;
const CARD_W = 58;
const CARD_H = 66;
const CARD_COVER_W = CARD_W + 6;
const CARD_COVER_H = CARD_H + 6;
const COVER_EPSILON = 0.5;

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
  private conversions: ConversionSequence[] = [];
  private goalEnergies: GoalEnergy[] = [];
  private tray: number[] = [];
  private pendingDrops: number[] = [];
  private dropToken = 0;
  private merging = new Set<number>();
  private timers = new Set<number>();
  private callbacks: GameCallbacks;
  private levelIndex: number;
  private mode: GameMode;
  private wave: number;
  private relics: RelicId[];
  private trayLimit = 7;
  private radiusScale = 1;
  private scoreMultiplier = 1;
  private dangerLimit = 2;
  private magnetMultiplier = 1;
  private specialBonus = 0;
  private wavePending = false;
  private cardIdCounter = 0;
  private status: GameStatus = "playing";
  private score = 0;
  private combo = 0;
  private maxCombo = 0;
  private maxFruitTier = 0;
  private comboAt = -10;
  private dangerSince = -1;
  private dangerProgress = 0;
  private exhaustedSince = -1;
  private startedAt = Date.now();
  private undoLeft = 1;
  private shuffleLeft = 3;
  private juiceLeft = 1;
  private hammerLeft = 1;
  private magnetLeft = 1;
  private wildLeft = 1;
  private bubbleLeft = 1;
  private sunLeft = 1;
  private aimX: number | null = null;
  private chainLayer = new Container();
  private chainPositions = new Map<number, { x: number; y: number }>();
  private converterCore: Container | null = null;
  private mutator: WaveMutator = rollMutator(1);
  private feverEnergy = 0;
  private feverUntil = -1;
  private feverFill: Graphics | null = null;
  private feverLabel: Text | null = null;
  private mutatorTag: Text | null = null;
  private secondWindUsed = false;
  private lastPick: CardNode | null = null;
  private shake = 0;
  private elapsed = 0;
  private paused = false;
  private destroyed = false;
  private winPending = false;

  private constructor(options: number | GameOptions, callbacks: GameCallbacks) {
    const config: GameOptions =
      typeof options === "number" ? { level: options, mode: "story" } : options;
    this.levelIndex = Math.max(0, Math.min(config.level, LEVELS.length - 1));
    this.mode = config.mode;
    this.wave = Math.max(1, config.wave || 1);
    this.relics = [...(config.relics || [])];
    this.score = Math.max(0, config.startingScore || 0);
    this.trayLimit = this.hasRelic("deep_tray") ? 8 : 7;
    this.radiusScale = this.hasRelic("mini_orchard") ? 0.86 : 1;
    this.scoreMultiplier = this.hasRelic("golden_touch") ? 1.35 : 1;
    this.dangerLimit = this.hasRelic("slow_sugar") ? 3.2 : 2;
    this.magnetMultiplier = this.hasRelic("magnet_core") ? 1.55 : 1;
    this.specialBonus = this.hasRelic("blast_juice") ? 0.12 : 0;
    if (this.hasRelic("tool_belt")) {
      this.shuffleLeft += 1;
      this.hammerLeft += 1;
      this.bubbleLeft += 1;
    }
    if (this.hasRelic("crystal_seed")) {
      this.wildLeft += 1;
      this.juiceLeft += 1;
    }
    const upgrades = config.upgrades || {};
    if ((upgrades.pack || 0) >= 1) this.shuffleLeft += 1;
    if ((upgrades.pack || 0) >= 2) this.hammerLeft += 1;
    if ((upgrades.pack || 0) >= 3) this.wildLeft += 1;
    this.sunLeft += Math.min(2, upgrades.sun || 0);
    this.feverEnergy = [0, 20, 35, 50][Math.min(3, upgrades.fever || 0)];
    this.dangerLimit += 0.3 * Math.min(3, upgrades.danger || 0);
    if (this.mode !== "story") this.mutator = rollMutator(this.wave);
    this.callbacks = callbacks;
  }

  private get feverActive() {
    return this.feverUntil > 0 && this.elapsed < this.feverUntil;
  }

  // 得分总倍率 = 奇物 × 波次变异 × 狂热
  private effectiveScoreMultiplier() {
    return (
      this.scoreMultiplier *
      (this.mutator.score || 1) *
      (this.feverActive ? 2 : 1)
    );
  }

  // 三消/合成充能;充满进入 9 秒甜度狂热(得分×2、磁吸×1.8、连击窗口+1s)
  private gainFever(amount: number) {
    if (this.feverActive || this.status !== "playing") return;
    const scaled = amount * (this.hasRelic("fever_bloom") ? 1.4 : 1);
    this.feverEnergy = Math.min(100, this.feverEnergy + scaled);
    if (this.feverEnergy >= 100) {
      this.feverUntil = this.elapsed + 9;
      if (this.feverLabel) this.feverLabel.visible = true;
      this.callbacks.onToast("🔥 甜度狂热 · 得分翻倍 9 秒！", "gold");
      this.burst(
        WORLD.width / 2,
        WORLD.tray.y + WORLD.tray.height,
        0xffd85e,
        30,
      );
      this.ring(
        WORLD.width / 2,
        WORLD.tray.y + WORLD.tray.height - 4,
        0xffe169,
        1.2,
      );
      sounds.match();
      haptic([20, 30, 20, 30, 40]);
      this.emitSnapshot();
    }
  }

  static async create(
    canvas: HTMLCanvasElement,
    options: number | GameOptions,
    callbacks: GameCallbacks,
  ) {
    const game = new FruitGame(options, callbacks);
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
    // autoDensity 会写死内联 width/height(430×860 px),容器变小时画布溢出被裁;
    // 强制回到 CSS 控制,让画布始终随 .game-phone 等比缩放
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    this.app.stage.addChild(this.root);
    this.root.addChild(
      this.ambientLayer,
      this.world,
      this.dropLayer,
      this.fxLayer,
    );
    this.world.addChild(this.cardLayer, this.trayLayer, this.fruitLayer);
    this.dropLayer.addChild(this.dropPreviewLayer);
    this.drawScene();
    this.createPhysicsWorld();
    this.createCards();
    this.drawTray();
    Events.on(this.engine, "collisionStart", this.onCollision);
    this.app.ticker.add(this.tick);
    if (import.meta.env.DEV)
      (window as unknown as { __game?: FruitGame }).__game = this;
    this.emitSnapshot();
    if (this.mode === "story" && this.levelIndex === 0) {
      this.callbacks.onToast("合成演示 · 两颗葡萄正在相遇", "cyan");
      this.setTimer(
        () => this.spawnFruit(0, WORLD.width / 2 - 24, WORLD.box.y + 28),
        320,
      );
      this.setTimer(
        () => this.spawnFruit(0, WORLD.width / 2 + 24, WORLD.box.y + 28),
        480,
      );
    }
    if (this.mode === "expedition" && this.hasRelic("lucky_bloom")) {
      this.setTimer(
        () =>
          this.spawnFruit(
            Math.min(2, Math.floor(this.wave / 3)),
            WORLD.width / 2,
            WORLD.box.y + 24,
          ),
        520,
      );
    }
    if (this.mode === "expedition" && this.wave > 1) {
      this.setTimer(
        () =>
          this.callbacks.onToast(
            `🧭 路线 ${this.wave} · ${this.mutator.icon} ${this.mutator.name}`,
            "gold",
          ),
        220,
      );
    }
  }

  private hasRelic(relic: RelicId) {
    return this.relics.includes(relic);
  }

  private fruitRadius(tier: number) {
    return FRUITS[tier].radius * this.radiusScale * (this.mutator.radius || 1);
  }

  private drawScene() {
    const background = new Graphics()
      .rect(0, 0, WORLD.width, WORLD.height)
      .fill({ color: 0x1c1240 });
    this.ambientLayer.addChild(background);

    const haloA = new Graphics()
      .circle(70, 175, 115)
      .fill({ color: 0x6c28d9, alpha: 0.2 });
    const haloB = new Graphics()
      .circle(375, 610, 145)
      .fill({ color: 0xff3d81, alpha: 0.13 });
    const haloC = new Graphics()
      .circle(225, 820, 120)
      .fill({ color: 0x00d4ff, alpha: 0.09 });
    haloA.filters = [new BlurFilter({ strength: 48 })];
    haloB.filters = [new BlurFilter({ strength: 58 })];
    haloC.filters = [new BlurFilter({ strength: 52 })];
    this.ambientLayer.addChild(haloA, haloB, haloC);

    for (let index = 0; index < 42; index += 1) {
      const star = new Graphics().circle(0, 0, 0.7 + Math.random() * 1.4).fill({
        color: index % 4 === 0 ? 0xffd166 : 0xffffff,
        alpha: 0.25 + Math.random() * 0.55,
      });
      star.position.set(
        Math.random() * WORLD.width,
        Math.random() * WORLD.height,
      );
      star.label = `star-${Math.random() * 10}`;
      this.ambientLayer.addChild(star);
    }

    const stackPanel = new Graphics()
      .roundRect(
        WORLD.stack.x,
        WORLD.stack.y,
        WORLD.stack.width,
        WORLD.stack.height,
        30,
      )
      .fill({ color: 0x352268, alpha: 0.78 })
      .stroke({ color: 0xc79cff, alpha: 0.42, width: 1.5 });
    const trayPanel = new Graphics()
      .roundRect(
        WORLD.tray.x,
        WORLD.tray.y,
        WORLD.tray.width,
        WORLD.tray.height,
        22,
      )
      .fill({ color: 0x3b245f, alpha: 0.96 })
      .stroke({ color: 0xff86bd, alpha: 0.55, width: 1.5 });
    const boxPanel = new Graphics()
      .roundRect(
        WORLD.box.x,
        WORLD.box.y,
        WORLD.box.width,
        WORLD.box.height,
        28,
      )
      .fill({ color: 0x16345d, alpha: 0.78 })
      .stroke({ color: 0x72e9ff, alpha: 0.62, width: 2 });
    const danger = new Graphics()
      .moveTo(WORLD.box.x + 14, WORLD.dangerY)
      .lineTo(WORLD.box.x + WORLD.box.width - 14, WORLD.dangerY)
      .stroke({ color: 0xff476f, alpha: 0.48, width: 2 });
    danger.label = "danger-line";
    this.ambientLayer.addChild(stackPanel, trayPanel, boxPanel, danger);

    const stackLabel = new Text({
      text: "FRUIT DECK  ·  只点亮起的卡片",
      style: {
        fontFamily: "system-ui",
        fontSize: 10,
        fontWeight: "700",
        fill: 0xcbb9f6,
        letterSpacing: 1.6,
      },
    });
    stackLabel.position.set(29, WORLD.stack.y + 8);
    this.ambientLayer.addChild(stackLabel);

    const dangerLabel = new Text({
      text: "⚠ 甜度警戒线",
      style: {
        fontFamily: "system-ui",
        fontSize: 10,
        fontWeight: "700",
        fill: 0xff7893,
        letterSpacing: 1,
      },
    });
    dangerLabel.position.set(31, WORLD.dangerY - 18);
    this.ambientLayer.addChild(dangerLabel);

    const mergeLabel = new Text({
      text: "MERGE LAB  ·  同级水果相撞升级",
      style: {
        fontFamily: "system-ui",
        fontSize: 9,
        fontWeight: "800",
        fill: 0x76e7ff,
        letterSpacing: 1.1,
      },
    });
    mergeLabel.anchor.set(1, 0);
    mergeLabel.position.set(
      WORLD.box.x + WORLD.box.width - 20,
      WORLD.box.y + 12,
    );
    const dropHint = new Text({
      text: "↓  三消水果从这里进入合成箱",
      style: {
        fontFamily: "system-ui",
        fontSize: 10,
        fontWeight: "800",
        fill: 0x75eaff,
        letterSpacing: 0.4,
      },
    });
    dropHint.anchor.set(0.5, 0);
    dropHint.position.set(WORLD.width / 2, WORLD.box.y + 34);
    dropHint.alpha = 0.32;
    this.ambientLayer.addChild(mergeLabel, dropHint);

    // 狂热能量条:贴在卡槽面板底边,充满触发 9 秒狂热
    const feverBack = new Graphics()
      .roundRect(
        WORLD.tray.x + 14,
        WORLD.tray.y + WORLD.tray.height - 9,
        WORLD.tray.width - 28,
        4,
        2,
      )
      .fill({ color: 0x0c0820, alpha: 0.85 });
    this.feverFill = new Graphics()
      .roundRect(0, 0, WORLD.tray.width - 28, 4, 2)
      .fill({ color: 0xffffff });
    this.feverFill.position.set(
      WORLD.tray.x + 14,
      WORLD.tray.y + WORLD.tray.height - 9,
    );
    this.feverFill.tint = 0xff4f9a;
    this.feverFill.scale.x = this.feverEnergy / 100;
    this.feverLabel = new Text({
      text: "🔥 FEVER ×2",
      style: {
        fontFamily: "system-ui",
        fontSize: 9,
        fontWeight: "900",
        fill: 0xffe169,
        stroke: { color: 0x2a123f, width: 3 },
      },
    });
    this.feverLabel.anchor.set(0.5, 1);
    this.feverLabel.position.set(
      WORLD.width / 2,
      WORLD.tray.y + WORLD.tray.height - 11,
    );
    this.feverLabel.visible = false;
    // 能量条放在最上层，避免被卡槽格子的背景遮住。
    this.fxLayer.addChild(feverBack, this.feverFill, this.feverLabel);

    // 卡槽与果箱之间的核心转换口：让“三张卡变成一颗水果”在静态画面里也能读懂。
    const transferRail = new Graphics()
      .moveTo(WORLD.converter.x, WORLD.tray.y + WORLD.tray.height - 1)
      .lineTo(WORLD.converter.x, WORLD.box.y + 18)
      .stroke({ color: 0x69e8ff, alpha: 0.34, width: 2 });
    const converter = new Container();
    converter.position.set(WORLD.converter.x, WORLD.converter.y);
    const converterHalo = new Graphics()
      .circle(0, 0, 25)
      .fill({ color: 0x3ae5ff, alpha: 0.08 })
      .stroke({ color: 0x64edff, alpha: 0.45, width: 1.5 });
    converterHalo.label = "converter-halo";
    const converterRing = new Graphics()
      .circle(0, 0, 17)
      .fill({ color: 0x24133f, alpha: 0.95 })
      .stroke({ color: 0xff72b7, alpha: 0.9, width: 2.5 });
    const converterCore = new Text({
      text: "✦",
      style: {
        fontSize: 19,
        fontWeight: "900",
        fill: 0xffe169,
        stroke: { color: 0x6b215f, width: 3 },
      },
    });
    converterCore.anchor.set(0.5);
    const converterLabel = new Text({
      text: "3消 · 转果",
      style: {
        fontFamily: "system-ui",
        fontSize: 8,
        fontWeight: "900",
        fill: 0xbff8ff,
        stroke: { color: 0x21113c, width: 3 },
      },
    });
    converterLabel.anchor.set(0.5);
    converterLabel.position.set(0, 27);
    converter.addChild(
      converterHalo,
      converterRing,
      converterCore,
      converterLabel,
    );
    this.converterCore = converter;
    this.ambientLayer.addChild(transferRail, converter);

    // 变异波次标签(无尽/远征)
    this.mutatorTag = new Text({
      text: "",
      style: {
        fontFamily: "system-ui",
        fontSize: 10,
        fontWeight: "800",
        fill: 0xffd58a,
        letterSpacing: 0.5,
      },
    });
    this.mutatorTag.anchor.set(1, 0);
    this.mutatorTag.position.set(
      WORLD.stack.x + WORLD.stack.width - 14,
      WORLD.stack.y + 8,
    );
    this.ambientLayer.addChild(this.mutatorTag);
    this.updateMutatorTag();

    const dropTarget = new Graphics()
      .roundRect(
        WORLD.box.x,
        WORLD.box.y,
        WORLD.box.width,
        WORLD.box.height,
        28,
      )
      .fill({ color: 0xffffff, alpha: 0.001 });
    dropTarget.eventMode = "static";
    dropTarget.cursor = "grab";
    // 有待投水果:按住拖动瞄准、松手投放;没有:点箱内水果戳它一把
    dropTarget.on("pointerdown", (event: FederatedPointerEvent) => {
      if (this.status !== "playing" || this.paused) return;
      if (this.pendingDrops.length > 0) {
        this.dropToken += 1; // 瞄准期间暂停自动投放
        this.aimX = event.global.x;
        this.renderDropPreview();
      } else {
        this.pokeFruit(event.global.x, event.global.y);
      }
    });
    dropTarget.on("globalpointermove", (event: FederatedPointerEvent) => {
      if (this.aimX === null || this.pendingDrops.length === 0) return;
      this.aimX = event.global.x;
      this.renderDropPreview();
    });
    const releaseAim = () => {
      if (this.aimX === null) return;
      const x = this.aimX;
      this.aimX = null;
      this.dropPending(x);
    };
    dropTarget.on("pointerup", releaseAim);
    dropTarget.on("pointerupoutside", releaseAim);
    this.dropLayer.addChildAt(dropTarget, 0);

    this.ambientLayer.addChild(this.chainLayer);
    this.drawChainMap();
  }

  private updateMutatorTag() {
    if (!this.mutatorTag) return;
    const show = this.mode !== "story" && this.mutator.id !== "calm";
    this.mutatorTag.text = show
      ? `${this.mutator.icon} 变异 · ${this.mutator.name}`
      : "";
  }

  // 箱底常驻合成路线图：聚焦“当前→下一步→目标”，避免高阶关卡把整条路线挤成一团。
  private drawChainMap() {
    this.chainLayer
      .removeChildren()
      .forEach((child) => child.destroy({ children: true }));
    this.chainPositions.clear();
    const target =
      this.mode === "endless" ? null : LEVELS[this.levelIndex].target;
    const current = Math.min(
      this.maxFruitTier,
      target ?? FRUITS.length - 1,
    );
    let tiers: Array<number | null>;
    if (target === null) {
      const from = Math.max(0, current - 2);
      const to = Math.min(FRUITS.length - 1, Math.max(current + 3, 5));
      tiers = Array.from({ length: to - from + 1 }, (_, index) => from + index);
    } else {
      const from = Math.max(0, current - 1);
      const sequentialTo = Math.min(target, from + 4);
      tiers = Array.from(
        { length: sequentialTo - from + 1 },
        (_, index) => from + index,
      );
      if (sequentialTo < target - 1) tiers.push(null);
      if (sequentialTo < target) tiers.push(target);
    }
    const count = tiers.length;
    const y = WORLD.box.y + WORLD.box.height - 24;
    const step = Math.min(58, (WORLD.box.width - 64) / Math.max(1, count - 1));
    const startX = WORLD.box.x + WORLD.box.width / 2 - ((count - 1) * step) / 2;
    tiers.forEach((tier, index) => {
      const x = startX + index * step;
      if (tier === null) {
        const ellipsis = new Text({
          text: "•••",
          style: { fontSize: 10, fontWeight: "900", fill: 0x776990 },
        });
        ellipsis.anchor.set(0.5);
        ellipsis.position.set(x, y);
        this.chainLayer.addChild(ellipsis);
        return;
      }
      this.chainPositions.set(tier, { x, y });
      const reached = tier <= this.maxFruitTier;
      const isCurrent = tier === current;
      const isTarget = tier === target;
      if (isTarget) {
        const halo = new Graphics()
          .circle(x, y, 15)
          .fill({ color: 0xffd85e, alpha: 0.12 })
          .stroke({ color: 0xffd85e, alpha: 0.9, width: 2 });
        this.chainLayer.addChild(halo);
      }
      if (isCurrent) {
        const currentHalo = new Graphics()
          .circle(x, y, 17)
          .fill({ color: 0x45dcff, alpha: 0.1 })
          .stroke({ color: 0x70efff, alpha: 0.95, width: 2 });
        const marker = new Text({
          text: "当前",
          style: {
            fontFamily: "system-ui",
            fontSize: 8,
            fontWeight: "900",
            fill: 0x91f4ff,
          },
        });
        marker.anchor.set(0.5);
        marker.position.set(x, y - 25);
        this.chainLayer.addChild(currentHalo, marker);
      }
      const icon = new Text({
        text: FRUITS[tier].emoji,
        style: { fontSize: isTarget || isCurrent ? 19 : 16 },
      });
      icon.anchor.set(0.5);
      icon.position.set(x, y);
      icon.alpha = reached || isTarget ? 1 : 0.35;
      this.chainLayer.addChild(icon);
      if (index < tiers.length - 1) {
        const arrow = new Text({
          text: "→",
          style: { fontSize: 10, fontWeight: "900", fill: 0x8b7ca7 },
        });
        arrow.anchor.set(0.5);
        arrow.position.set(x + step / 2, y - 1);
        arrow.alpha = 0.7;
        this.chainLayer.addChild(arrow);
      }
    });
  }

  private launchGoalEnergy(tier: number) {
    if (this.mode === "endless") return;
    const target = LEVELS[this.levelIndex].target;
    const from = this.chainPositions.get(tier);
    const destination = this.chainPositions.get(target);
    if (!from || !destination) return;
    if (tier >= target) {
      this.ring(destination.x, destination.y, 0xffd85e, 0.7);
      return;
    }
    const energy = new Graphics()
      .circle(0, 0, 4)
      .fill({ color: 0xffffff })
      .stroke({ color: 0x59e8ff, alpha: 0.95, width: 3 });
    energy.position.set(from.x, from.y);
    energy.blendMode = "add";
    this.fxLayer.addChild(energy);
    this.goalEnergies.push({
      view: energy,
      fromX: from.x,
      toX: destination.x,
      y: from.y,
      life: 0.48,
      maxLife: 0.48,
    });
  }

  private updateGoalEnergies(seconds: number) {
    this.goalEnergies = this.goalEnergies.filter((energy) => {
      energy.life -= seconds;
      const progress = Math.min(1, 1 - energy.life / energy.maxLife);
      const eased = 1 - (1 - progress) ** 2;
      energy.view.position.set(
        energy.fromX + (energy.toX - energy.fromX) * eased,
        energy.y - Math.sin(progress * Math.PI) * 10,
      );
      energy.view.scale.set(0.75 + Math.sin(progress * Math.PI) * 0.8);
      energy.view.alpha = 1 - Math.max(0, progress - 0.84) / 0.16;
      if (energy.life > 0) return true;
      this.burst(energy.toX, energy.y, 0xffd85e, 14);
      energy.view.destroy();
      return false;
    });
  }

  // 戳一戳只做横向滚动；向上弹跳只保留给合成后诞生的新水果。
  private pokeFruit(x: number, y: number) {
    const node = [...this.fruits.values()].find(
      (fruit) =>
        !this.merging.has(fruit.body.id) &&
        Math.hypot(fruit.body.position.x - x, fruit.body.position.y - y) <=
          this.fruitRadius(fruit.tier) + 8,
    );
    if (!node) return;
    const stormStir = this.hasRelic("storm_stir");
    const plugin = node.body.plugin as { pokeAt?: number };
    if (!stormStir && this.elapsed - (plugin.pokeAt ?? -9) < 0.55) return;
    plugin.pokeAt = this.elapsed;
    const force = stormStir ? 2 : 1;
    const partner = [...this.fruits.values()]
      .filter(
        (fruit) =>
          fruit !== node &&
          fruit.tier === node.tier &&
          !this.merging.has(fruit.body.id),
      )
      .sort(
        (a, b) =>
          Math.hypot(
            a.body.position.x - node.body.position.x,
            a.body.position.y - node.body.position.y,
          ) -
          Math.hypot(
            b.body.position.x - node.body.position.x,
            b.body.position.y - node.body.position.y,
          ),
      )[0];
    const direction = partner
      ? Math.sign(partner.body.position.x - node.body.position.x) || 1
      : Math.random() < 0.5
        ? -1
        : 1;
    Body.setVelocity(node.body, {
      x: node.body.velocity.x + direction * 3 * force,
      y: Math.max(0, node.body.velocity.y),
    });
    Body.setAngularVelocity(node.body, direction * 0.08 * force);
    this.ring(
      node.body.position.x,
      node.body.position.y,
      FRUITS[node.tier].glow,
      0.55,
    );
    this.burst(
      node.body.position.x,
      node.body.position.y - 4,
      FRUITS[node.tier].glow,
      6,
    );
    sounds.tap();
    haptic();
  }

  private createPhysicsWorld() {
    const box = WORLD.box;
    Composite.add(this.engine.world, [
      Bodies.rectangle(box.x - 6, box.y + box.height / 2, 20, box.height + 60, {
        isStatic: true,
        label: "wall",
      }),
      Bodies.rectangle(
        box.x + box.width + 6,
        box.y + box.height / 2,
        20,
        box.height + 60,
        { isStatic: true, label: "wall" },
      ),
      Bodies.rectangle(
        box.x + box.width / 2,
        box.y + box.height + 6,
        box.width + 40,
        20,
        { isStatic: true, label: "floor" },
      ),
    ]);
  }

  private createCards(definition = LEVELS[this.levelIndex]) {
    // 先保留可解的三张小组，再做跨层换位；比整组三连更随机，也不会彻底打散到纯碰运气。
    const tiers = shuffle(
      definition.cards.flatMap(({ tier, count }) =>
        Array.from({ length: count / 3 }, () => tier),
      ),
    ).flatMap((tier) => [tier, tier, tier]);
    for (let swap = 0; swap < Math.floor(tiers.length * 0.55); swap += 1) {
      const first = Math.floor(Math.random() * tiers.length);
      const second = Math.floor(Math.random() * tiers.length);
      [tiers[first], tiers[second]] = [tiers[second], tiers[first]];
    }
    // 布局块展开成卡位,按层从低到高排序;设计上卡位数 = 卡片数,不足时向上叠补
    const slots = definition.layout
      .flatMap((block) =>
        Array.from({ length: block.cols * block.rows }, (_, cell) => ({
          layer: block.layer,
          x: block.x + ((cell % block.cols) - (block.cols - 1) / 2) * block.sx,
          y:
            block.y +
            (Math.floor(cell / block.cols) - (block.rows - 1) / 2) * block.sy,
        })),
      )
      .sort((a, b) => a.layer - b.layer);
    while (slots.length < tiers.length) {
      const top = slots[slots.length - 1];
      slots.push({ layer: top.layer + 1, x: top.x + 5, y: top.y - 6 });
    }
    this.scatterSlots(slots);
    const maxLayer = slots[slots.length - 1].layer;
    const exposedSlotIndexes = slots
      .map((slot, index) => ({ slot, index }))
      .filter(
        ({ slot }) =>
          !slots.some((other) => {
            if (other.layer <= slot.layer) return false;
            const overlapX = Math.max(
              0,
              CARD_COVER_W - Math.abs(other.x - slot.x),
            );
            const overlapY = Math.max(
              0,
              CARD_COVER_H - Math.abs(other.y - slot.y),
            );
            return overlapX > COVER_EPSILON && overlapY > COVER_EPSILON;
          }),
      )
      .map(({ index }) => index);

    // 每关开局至少亮出同类三张,避免随机洗牌后顶部卡片无法组成第一组三消。
    const openingTier = definition.cards.find(({ count }) => count >= 3)?.tier;
    const protectedOpeningSlots = new Set(exposedSlotIndexes.slice(0, 3));
    if (openingTier !== undefined && protectedOpeningSlots.size === 3) {
      [...protectedOpeningSlots].forEach((targetIndex, openingIndex) => {
        const earlierTargets = exposedSlotIndexes.slice(0, openingIndex);
        const sourceIndex = tiers.findIndex(
          (tier, index) =>
            tier === openingTier && !earlierTargets.includes(index),
        );
        if (sourceIndex >= 0 && sourceIndex !== targetIndex) {
          [tiers[targetIndex], tiers[sourceIndex]] = [
            tiers[sourceIndex],
            tiers[targetIndex],
          ];
        }
      });
    }

    tiers.forEach((tier, index) => {
      const slot = slots[index];
      const x = slot.x;
      const y = slot.y;
      const protectedOpening = protectedOpeningSlots.has(index);
      const specialRate = Math.min(
        0.52,
        definition.specialRate +
          (this.mode === "endless" ? this.wave * 0.018 : 0) +
          (this.mode === "expedition" ? this.wave * 0.012 : 0) +
          (this.mutator.frozen || this.mutator.bomb ? 0.18 : 0) +
          this.specialBonus,
      );
      const specialRoll = Math.random();
      let special: CardSpecial = "normal";
      if (!protectedOpening && specialRoll < specialRate) {
        const kindRoll = Math.random();
        special =
          kindRoll < 0.38
            ? "frozen"
            : kindRoll < 0.68
              ? "bomb"
              : kindRoll < 0.86
                ? "vine"
                : "sugar";
        // 变异波次偏置：对应特殊牌约占变异牌的 72%。
        if (this.mutator.frozen && Math.random() < 0.72) special = "frozen";
        if (this.mutator.bomb && Math.random() < 0.72) special = "bomb";
        // 向阳花田:冰冻/藤蔓减半
        if (
          (special === "frozen" || special === "vine") &&
          this.hasRelic("frost_ward") &&
          Math.random() < 0.5
        )
          special = "normal";
      }
      const locked = special === "frozen" && slot.layer < maxLayer;
      if (special === "frozen" && !locked) special = "normal";
      const card: CardNode = {
        id: ++this.cardIdCounter,
        tier,
        layer: slot.layer,
        active: true,
        x,
        y,
        view: this.makeCard(tier, special),
        locked,
        special,
      };
      card.view.position.set(x, y);
      card.view.rotation = (Math.random() - 0.5) * 0.14;
      card.view.zIndex = slot.layer * 100 + index;
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

  // 把设计卡位揉成不同牌阵:整组旋转、镜像、层间扭转和单卡抖动每局都会重抽。
  private scatterSlots(slots: Array<{ layer: number; x: number; y: number }>) {
    const mirrorX = Math.random() < 0.5;
    const mirrorY = Math.random() < 0.35;
    const variant = Math.floor(Math.random() * 4);
    const maxLayer = Math.max(...slots.map((slot) => slot.layer));
    const centerX = WORLD.width / 2;
    const centerY = WORLD.stack.y + WORLD.stack.height / 2;
    const rotation = (Math.random() - 0.5) * 0.2;
    const twist = (Math.random() - 0.5) * 0.035;
    const shear = (Math.random() - 0.5) * 0.22;
    const wave = (Math.random() - 0.5) * 15;
    const globalDx = (Math.random() - 0.5) * 22;
    const globalDy = (Math.random() - 0.5) * 12;
    const drift = new Map<number, { dx: number; dy: number }>();
    slots.forEach((slot) => {
      if (mirrorX) slot.x = WORLD.width - slot.x;
      if (mirrorY)
        slot.y = WORLD.stack.y + WORLD.stack.height - (slot.y - WORLD.stack.y);
      const angle = rotation + (slot.layer - maxLayer / 2) * twist;
      const dx = slot.x - centerX;
      const dy = slot.y - centerY;
      slot.x = centerX + dx * Math.cos(angle) - dy * Math.sin(angle);
      slot.y = centerY + dx * Math.sin(angle) + dy * Math.cos(angle);
      slot.x += (slot.y - (WORLD.stack.y + WORLD.stack.height / 2)) * shear;
      slot.y += Math.sin(slot.x / 48 + slot.layer * 0.9) * wave;
      if (variant === 1) slot.x += Math.sin(slot.layer * 1.45) * 17;
      if (variant === 2)
        slot.y += Math.cos(slot.layer * 1.2 + slot.x / 95) * 12;
      if (variant === 3)
        slot.x += (slot.layer % 2 ? 1 : -1) * (7 + slot.layer * 2.3);
      if (!drift.has(slot.layer))
        drift.set(slot.layer, {
          dx: (Math.random() - 0.5) * 34,
          dy: (Math.random() - 0.5) * 24,
        });
      const layerDrift = drift.get(slot.layer)!;
      slot.x += globalDx + layerDrift.dx + (Math.random() - 0.5) * 22;
      slot.y += globalDy + layerDrift.dy + (Math.random() - 0.5) * 20;
    });
    // 同层牌不允许互相压住；真正的遮挡只来自更高层。
    for (let pass = 0; pass < 6; pass += 1) {
      let moved = false;
      for (let a = 0; a < slots.length; a += 1)
        for (let b = a + 1; b < slots.length; b += 1) {
          const first = slots[a];
          const second = slots[b];
          if (first.layer !== second.layer) continue;
          const overlapX = CARD_W + 2 - Math.abs(first.x - second.x);
          const overlapY = CARD_H + 2 - Math.abs(first.y - second.y);
          if (overlapX <= 0 || overlapY <= 0) continue;
          moved = true;
          if (overlapX < overlapY) {
            const push = (overlapX / 2 + 1) * (first.x < second.x ? -1 : 1);
            first.x += push;
            second.x -= push;
          } else {
            const push = (overlapY / 2 + 1) * (first.y < second.y ? -1 : 1);
            first.y += push;
            second.y -= push;
          }
        }
      if (!moved) break;
    }
    slots.forEach((slot) => {
      slot.x = Math.max(46, Math.min(WORLD.width - 46, slot.x));
      slot.y = Math.max(
        WORLD.stack.y + 52,
        Math.min(WORLD.stack.y + WORLD.stack.height - 38, slot.y),
      );
    });
  }

  private makeCard(tier: number, special: CardSpecial) {
    const fruit = FRUITS[tier];
    const view = new Container();
    const shadow = new Graphics()
      .roundRect(-CARD_W / 2 + 2, -CARD_H / 2 + 5, CARD_W, CARD_H, 15)
      .fill({ color: 0x05030c, alpha: 0.44 });
    const glow = new Graphics()
      .roundRect(-CARD_W / 2 - 2, -CARD_H / 2 - 2, CARD_W + 4, CARD_H + 4, 17)
      .fill({ color: fruit.glow, alpha: 0.15 });
    glow.label = "access-glow";
    const edge = new Graphics()
      .roundRect(-CARD_W / 2, -CARD_H / 2 + 3, CARD_W, CARD_H, 15)
      .fill({ color: fruit.color, alpha: 0.72 });
    const face = new Graphics()
      .roundRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 15)
      .fill({ color: 0xe8e1dc })
      .stroke({ color: fruit.color, alpha: 0.8, width: 2 });
    const sheen = new Graphics()
      .roundRect(-CARD_W / 2 + 5, -CARD_H / 2 + 5, CARD_W - 10, 15, 8)
      .fill({ color: 0xffffff, alpha: 0.34 });
    const emoji = new Text({
      text: fruit.emoji,
      style: {
        fontSize: 31,
        align: "center",
        dropShadow: { color: 0x4b2348, alpha: 0.18, blur: 2, distance: 2 },
      },
    });
    emoji.anchor.set(0.5);
    emoji.position.set(0, -3);
    const shade = new Graphics()
      .roundRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 15)
      .fill({ color: 0x140b2c, alpha: 0.5 });
    shade.label = "shade";
    shade.visible = false;
    view.addChild(shadow, glow, edge, face, sheen, emoji, shade);
    if (special === "frozen") {
      const lock = new Text({ text: "❄", style: { fontSize: 13 } });
      lock.anchor.set(0.5);
      lock.position.set(19, -25);
      lock.label = "lock";
      view.addChild(lock);
    } else if (special === "bomb") {
      const bomb = new Text({ text: "💣", style: { fontSize: 14 } });
      bomb.anchor.set(0.5);
      bomb.position.set(19, -24);
      bomb.label = "special-icon";
      view.addChild(bomb);
    } else if (special === "vine") {
      const vine = new Text({ text: "🌿", style: { fontSize: 14 } });
      vine.anchor.set(0.5);
      vine.position.set(19, -24);
      vine.label = "special-icon";
      view.addChild(vine);
    } else if (special === "sugar") {
      const sugar = new Text({ text: "⚡", style: { fontSize: 14 } });
      sugar.anchor.set(0.5);
      sugar.position.set(19, -24);
      sugar.label = "special-icon";
      view.addChild(sugar);
    }
    return view;
  }

  private isCovered(card: CardNode) {
    return this.cards.some((other) => {
      if (!other.active || other.layer <= card.layer || other.id === card.id)
        return false;
      const overlapX = Math.max(
        0,
        CARD_COVER_W - Math.abs(other.x - card.x),
      );
      const overlapY = Math.max(
        0,
        CARD_COVER_H - Math.abs(other.y - card.y),
      );
      // 上层牌只要真实压住就锁住下层牌，避免露出一点边角时误点。
      return overlapX > COVER_EPSILON && overlapY > COVER_EPSILON;
    });
  }

  private coveringCards(card: CardNode) {
    return this.cards.filter((other) => {
      if (!other.active || other.layer <= card.layer || other.id === card.id)
        return false;
      const overlapX = Math.max(
        0,
        CARD_COVER_W - Math.abs(other.x - card.x),
      );
      const overlapY = Math.max(
        0,
        CARD_COVER_H - Math.abs(other.y - card.y),
      );
      return overlapX > COVER_EPSILON && overlapY > COVER_EPSILON;
    });
  }

  private explainBlocked(card: CardNode) {
    const blockers = card.locked ? [card] : this.coveringCards(card);
    blockers.slice(0, 3).forEach((blocker, index) => {
      this.setTimer(() => {
        if (!blocker.active) return;
        blocker.view.scale.set(1.06);
        this.ring(blocker.x, blocker.y, 0xffd85e, 0.55);
        this.setTimer(() => {
          if (blocker.active) this.updateCardAccess();
        }, 130);
      }, index * 45);
    });
    this.callbacks.onToast(
      card.locked ? "先解除这张卡的障碍" : "上层亮卡正在遮挡它",
      "cyan",
    );
    haptic([8, 22, 8]);
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
      card.view.eventMode = "static";
      card.view.cursor = usable ? "pointer" : "not-allowed";
      const shade = card.view.getChildByLabel("shade");
      const accessGlow = card.view.getChildByLabel("access-glow");
      if (shade) {
        shade.visible = !usable;
        shade.alpha = covered ? 0.88 : 0.58;
      }
      if (accessGlow) accessGlow.visible = usable;
      card.view.alpha = 1;
      card.view.scale.set(usable ? 1 : 0.97);
    });
  }

  private pickCard(card: CardNode) {
    if (this.status !== "playing" || this.paused || !card.active) return;
    if (this.isCovered(card) || card.locked) {
      this.explainBlocked(card);
      return;
    }
    if (card.special === "vine") {
      card.special = "normal";
      card.view.getChildByLabel("special-icon")?.destroy();
      this.burst(card.x, card.y, 0x86ef7d, 14);
      this.ring(card.x, card.y, 0x86ef7d, 0.65);
      this.callbacks.onToast("藤蔓已剪断 · 再点一次收取", "cyan");
      haptic([12, 30, 12]);
      return;
    }
    sounds.tap();
    haptic();
    const detonates = card.special === "bomb";
    const chargesFever = card.special === "sugar";
    card.active = false;
    card.view.visible = false;
    card.special = "normal";
    this.lastPick = detonates ? null : card;
    if (chargesFever) {
      this.gainFever(10);
      this.burst(card.x, card.y, 0xffd75e, 18);
      this.callbacks.onToast("⚡ 甜度 +10", "gold");
    }
    this.collectTier(card.tier);
    if (detonates) this.detonate(card);
    this.unlockNearby(card);
    this.updateCardAccess();
    this.drawTray();

    if (this.tray.length >= this.trayLimit && !this.winPending) {
      // 回魂果露:每局一次,卡槽爆满瞬间弹出两张最零散的卡救场
      if (this.hasRelic("second_wind") && !this.secondWindUsed) {
        this.secondWindUsed = true;
        for (let rescue = 0; rescue < 2 && this.tray.length > 0; rescue += 1) {
          const counts = new Map<number, number>();
          this.tray.forEach((trayTier) =>
            counts.set(trayTier, (counts.get(trayTier) || 0) + 1),
          );
          const loneliest = [...counts.entries()].sort(
            (a, b) => a[1] - b[1],
          )[0][0];
          this.tray.splice(this.tray.indexOf(loneliest), 1);
        }
        this.lastPick = null;
        this.drawTray();
        this.burst(WORLD.width / 2, WORLD.tray.y + 30, 0x9be8ff, 26);
        this.callbacks.onToast("💫 回魂果露 · 弹出两张卡！", "cyan");
        haptic([20, 40, 20]);
        this.emitSnapshot();
      } else {
        this.finish("lost", "卡槽装满啦，再试一次就能逆转");
      }
    } else {
      this.emitSnapshot();
      this.maybeAdvanceEndless();
    }
  }

  private collectTier(tier: number) {
    const groupIndex = this.tray.lastIndexOf(tier);
    if (groupIndex >= 0) this.tray.splice(groupIndex + 1, 0, tier);
    else this.tray.push(tier);

    const matches = this.tray.reduce(
      (count, trayTier) => count + Number(trayTier === tier),
      0,
    );
    if (matches >= 3) {
      const matchedSlots = this.tray
        .map((trayTier, index) => ({ trayTier, index }))
        .filter(({ trayTier }) => trayTier === tier)
        .slice(0, 3)
        .map(({ index }) => index);
      this.lastPick = null;
      let removed = 0;
      this.tray = this.tray.filter((trayTier) => {
        if (trayTier === tier && removed < 3) {
          removed += 1;
          return false;
        }
        return true;
      });
      this.lastPick = null;
      this.registerCombo();
      this.gainFever(14);
      const points = Math.round(
        (tier + 1) *
          90 *
          multiplier(this.combo) *
          this.effectiveScoreMultiplier(),
      );
      this.addScore(points, WORLD.width / 2, WORLD.tray.y + 18);
      sounds.match();
      haptic([16, 35, 22]);
      this.burst(WORLD.width / 2, WORLD.tray.y + 28, FRUITS[tier].color, 26);
      this.ring(WORLD.width / 2, WORLD.tray.y + 30, FRUITS[tier].glow);
      this.shake = Math.max(this.shake, 4 + this.combo * 0.8);
      this.callbacks.onToast(
        this.comboMessage(),
        this.combo >= 4 ? "gold" : "pink",
      );
      this.startConversion(tier, matchedSlots);
      if (this.hasRelic("honey_glaze") && Math.random() < 0.18) {
        this.setTimer(() => {
          this.callbacks.onToast("🍯 蜜糖涂层 · 双份掉落！", "gold");
          this.queueDrop(tier);
        }, 880);
      }
    }
  }

  private detonate(source: CardNode) {
    const radius = this.hasRelic("blast_juice") ? 142 : 108;
    const nearby = this.cards
      .filter(
        (card) =>
          card.active &&
          Math.hypot(card.x - source.x, card.y - source.y) <= radius,
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - source.x, a.y - source.y) -
          Math.hypot(b.x - source.x, b.y - source.y),
      )
      .slice(0, this.hasRelic("blast_juice") ? 3 : 2);
    nearby.forEach((card) => {
      card.active = false;
      card.view.visible = false;
      this.collectTier(card.tier);
    });
    this.lastPick = null;
    this.burst(source.x, source.y, 0xffa62b, 42);
    this.ring(source.x, source.y, 0xffe169, 1.25);
    this.shake = Math.max(this.shake, 11);
    this.addScore(
      Math.round(240 * this.effectiveScoreMultiplier()),
      source.x,
      source.y,
    );
    this.callbacks.onToast(`炸弹果汁 · 连带收取 ${nearby.length} 张`, "gold");
    haptic([24, 25, 46]);
  }

  private maybeAdvanceEndless() {
    if (
      this.mode !== "endless" ||
      this.wavePending ||
      this.cards.some((card) => card.active) ||
      this.tray.length > 0
    )
      return;
    this.wavePending = true;
    this.setTimer(() => this.startNextEndlessWave(), 720);
  }

  private startNextEndlessWave() {
    if (this.destroyed || this.status !== "playing") return;
    this.wave += 1;
    this.wavePending = false;
    this.mutator = rollMutator(this.wave);
    this.updateMutatorTag();
    this.cards.forEach((card) => card.view.destroy({ children: true }));
    this.cards = [];
    this.cardLayer.removeChildren();
    const definition = LEVELS[Math.min(LEVELS.length - 1, this.wave - 1)];
    this.createCards(definition);
    if (this.wave % 2 === 0) this.hammerLeft += 1;
    if (this.wave % 3 === 0) {
      this.shuffleLeft += 1;
      this.magnetLeft += 1;
    }
    if (this.wave % 4 === 0) this.wildLeft += 1;
    if (this.wave % 5 === 0) this.bubbleLeft += 1;
    if (this.wave % 6 === 0) this.sunLeft += 1;
    this.callbacks.onToast(
      `∞ 第 ${this.wave} 波 · ${this.mutator.icon} ${this.mutator.name}`,
      "gold",
    );
    this.emitSnapshot();
  }

  private unlockNearby(card: CardNode) {
    this.cards.forEach((other) => {
      if (!other.active || !other.locked) return;
      if (Math.hypot(other.x - card.x, other.y - card.y) < 95) {
        other.locked = false;
        other.special = "normal";
        other.view.getChildByLabel("lock")?.destroy();
        this.burst(other.x, other.y, 0x8be9fd, 10);
      }
    });
  }

  private drawTray() {
    this.trayLayer
      .removeChildren()
      .forEach((child) => child.destroy({ children: true }));
    const gap = 4;
    const slotWidth =
      (WORLD.tray.width - 20 - gap * (this.trayLimit - 1)) / this.trayLimit;
    for (let index = 0; index < this.trayLimit; index += 1) {
      const x = WORLD.tray.x + 10 + slotWidth / 2 + index * (slotWidth + gap);
      const slot = new Graphics()
        .roundRect(-slotWidth / 2, -25, slotWidth, 50, 12)
        .fill({
          color: index < this.tray.length ? 0x38245b : 0x160f2b,
          alpha: 0.82,
        })
        .stroke({
          color: index < this.tray.length ? 0xff6fb1 : 0x7d65a1,
          alpha: 0.32,
          width: 1.2,
        });
      slot.position.set(x, WORLD.tray.y + WORLD.tray.height / 2);
      this.trayLayer.addChild(slot);
      const tier = this.tray[index];
      if (tier !== undefined) {
        const emoji = new Text({
          text: FRUITS[tier].emoji,
          style: { fontSize: this.trayLimit > 7 ? 23 : 26 },
        });
        emoji.anchor.set(0.5);
        emoji.position.set(x, WORLD.tray.y + WORLD.tray.height / 2 - 1);
        this.trayLayer.addChild(emoji);
      }
    }
  }

  private traySlotX(index: number) {
    const gap = 4;
    const slotWidth =
      (WORLD.tray.width - 20 - gap * (this.trayLimit - 1)) / this.trayLimit;
    return WORLD.tray.x + 10 + slotWidth / 2 + index * (slotWidth + gap);
  }

  private startConversion(tier: number, matchedSlots: number[]) {
    const starts = matchedSlots.map((index) => ({
      x: this.traySlotX(index),
      y: WORLD.tray.y + WORLD.tray.height / 2 - 1,
    }));
    while (starts.length < 3)
      starts.push({
        x: WORLD.width / 2 + (starts.length - 1) * 28,
        y: WORLD.tray.y + WORLD.tray.height / 2,
      });
    const cards = starts.map(({ x, y }) => {
      const miniCard = new Container();
      const face = new Graphics()
        .roundRect(-13, -16, 26, 32, 8)
        .fill({ color: 0xeee7e1 })
        .stroke({ color: FRUITS[tier].color, alpha: 0.9, width: 1.5 });
      const icon = new Text({
        text: FRUITS[tier].emoji,
        style: { fontSize: 16 },
      });
      icon.anchor.set(0.5);
      miniCard.addChild(face, icon);
      miniCard.position.set(x, y);
      this.fxLayer.addChild(miniCard);
      return miniCard;
    });
    const fruit = new Text({
      text: FRUITS[tier].emoji,
      style: {
        fontSize: 26,
        dropShadow: {
          color: FRUITS[tier].glow,
          alpha: 0.9,
          blur: 10,
          distance: 0,
        },
      },
    });
    fruit.anchor.set(0.5);
    fruit.position.set(WORLD.converter.x, WORLD.converter.y);
    fruit.visible = false;
    this.fxLayer.addChild(fruit);
    this.conversions.push({
      cards,
      fruit,
      starts,
      tier,
      elapsed: 0,
      condensed: false,
    });
  }

  private updateConversions(seconds: number) {
    this.conversions = this.conversions.filter((sequence) => {
      sequence.elapsed += seconds;
      const gatherDuration = 0.34;
      sequence.cards.forEach((card, index) => {
        if (sequence.condensed) return;
        const progress = Math.max(
          0,
          Math.min(1, (sequence.elapsed - index * 0.025) / 0.29),
        );
        const eased = 1 - (1 - progress) ** 3;
        const start = sequence.starts[index];
        card.position.set(
          start.x + (WORLD.converter.x - start.x) * eased,
          start.y +
            (WORLD.converter.y - start.y) * eased -
            Math.sin(progress * Math.PI) * 12,
        );
        card.rotation = (index - 1) * (1 - eased) * 0.16;
        card.scale.set(0.92 - eased * 0.52);
        card.alpha = 1 - Math.max(0, progress - 0.82) / 0.18;
      });
      if (!sequence.condensed && sequence.elapsed >= gatherDuration) {
        sequence.condensed = true;
        sequence.cards.forEach((card) => card.destroy({ children: true }));
        sequence.fruit.visible = true;
        sequence.fruit.scale.set(0.45);
        this.burst(
          WORLD.converter.x,
          WORLD.converter.y,
          FRUITS[sequence.tier].glow,
          24,
        );
        this.ring(
          WORLD.converter.x,
          WORLD.converter.y,
          FRUITS[sequence.tier].glow,
          0.75,
        );
      }
      if (sequence.condensed) {
        const progress = Math.max(
          0,
          Math.min(1, (sequence.elapsed - gatherDuration) / 0.38),
        );
        const eased = progress * progress;
        sequence.fruit.position.set(
          WORLD.converter.x,
          WORLD.converter.y + (WORLD.box.y + 27 - WORLD.converter.y) * eased,
        );
        sequence.fruit.scale.set(0.45 + Math.sin(progress * Math.PI) * 0.62);
        sequence.fruit.alpha = 1 - Math.max(0, progress - 0.82) / 0.18;
      }
      if (sequence.elapsed < gatherDuration + 0.38) return true;
      sequence.fruit.destroy();
      this.queueDrop(sequence.tier);
      return false;
    });
  }

  private queueDrop(tier: number) {
    if (this.destroyed || this.status !== "playing") return;
    const wasEmpty = this.pendingDrops.length === 0;
    this.pendingDrops.push(tier);
    this.renderDropPreview();
    if (wasEmpty) {
      this.callbacks.onToast(
        `获得 ${FRUITS[tier].emoji} · 点一下或拖动投放`,
        "gold",
      );
      this.scheduleAutoDrop();
    }
  }

  private preferredDropX(tier: number) {
    const sameTier = [...this.fruits.values()]
      .filter(
        (fruit) => fruit.tier === tier && !this.merging.has(fruit.body.id),
      )
      .sort((a, b) => b.body.position.y - a.body.position.y)[0];
    return sameTier?.body.position.x ?? WORLD.box.x + WORLD.box.width / 2;
  }

  private renderDropPreview() {
    this.dropPreviewLayer
      .removeChildren()
      .forEach((child) => child.destroy({ children: true }));
    const tier = this.pendingDrops[0];
    if (tier === undefined || this.status !== "playing") return;
    const radius = this.fruitRadius(tier);
    const margin = radius + 9;
    const aiming = this.aimX !== null;
    const x = Math.max(
      WORLD.box.x + margin,
      Math.min(
        WORLD.box.x + WORLD.box.width - margin,
        this.aimX ?? this.preferredDropX(tier),
      ),
    );
    const guide = new Graphics()
      .moveTo(0, 0)
      .lineTo(0, WORLD.box.height - 44)
      .stroke({
        color: FRUITS[tier].glow,
        alpha: 0.42,
        width: 2,
      });
    guide.position.set(x, WORLD.box.y + 22);
    guide.blendMode = "add";
    guide.visible = aiming;
    const emoji = new Text({
      text: FRUITS[tier].emoji,
      style: {
        fontSize: Math.max(21, radius * 1.08),
        dropShadow: {
          color: FRUITS[tier].glow,
          alpha: 0.8,
          blur: 8,
          distance: 0,
        },
      },
    });
    emoji.anchor.set(0.5);
    emoji.position.set(x, WORLD.box.y + 27);
    const hint = new Text({
      text: aiming
        ? "松手投放"
        : `点一下或拖动  ${this.pendingDrops.length > 1 ? `待投 ×${this.pendingDrops.length}` : "投放"}`,
      style: {
        fontFamily: "system-ui",
        fontSize: 10,
        fontWeight: "900",
        fill: 0xffffff,
        stroke: { color: 0x25123f, width: 4 },
      },
    });
    hint.anchor.set(0.5);
    hint.position.set(WORLD.width / 2, WORLD.box.y + 82);
    this.dropPreviewLayer.addChild(guide, emoji, hint);
    // 排队中的后续水果缩略显示
    this.pendingDrops.slice(1, 5).forEach((queuedTier, index) => {
      const mini = new Text({
        text: FRUITS[queuedTier].emoji,
        style: { fontSize: 13 },
      });
      mini.anchor.set(0.5);
      mini.alpha = 0.62;
      mini.position.set(
        WORLD.box.x + WORLD.box.width - 26,
        WORLD.box.y + 30 + index * 21,
      );
      this.dropPreviewLayer.addChild(mini);
    });
  }

  private scheduleAutoDrop() {
    const token = ++this.dropToken;
    this.setTimer(() => {
      if (token === this.dropToken && this.pendingDrops.length > 0)
        this.dropPending();
    }, 2_800);
  }

  private dropPending(chosenX?: number) {
    if (this.status !== "playing") return;
    const tier = this.pendingDrops.shift();
    if (tier === undefined) return;
    this.dropToken += 1;
    const margin = this.fruitRadius(tier) + 9;
    const fallbackX = this.preferredDropX(tier);
    const x = Math.max(
      WORLD.box.x + margin,
      Math.min(WORLD.box.x + WORLD.box.width - margin, chosenX ?? fallbackX),
    );
    this.spawnFruit(tier, x, WORLD.box.y + 18);
    this.renderDropPreview();
    if (this.pendingDrops.length > 0) this.scheduleAutoDrop();
  }

  private spawnFruit(
    tier: number,
    x = WORLD.box.x + 55 + Math.random() * (WORLD.box.width - 110),
    y = WORLD.box.y + 18,
  ) {
    if (this.destroyed || this.status !== "playing") return;
    const definition = FRUITS[tier];
    const radius = this.fruitRadius(tier);
    const body = Bodies.circle(x, y, radius, {
      restitution: 0.07,
      friction: 0.16,
      frictionAir: 0.008,
      density: 0.0012 + tier * 0.00008,
      label: `fruit-${tier}`,
    });
    body.plugin = { tier, birth: this.elapsed };
    const view = this.makeFruit(tier);
    view.position.set(x, y);
    this.fruitLayer.addChild(view);
    this.fruits.set(body.id, { body, tier, view });
    Composite.add(this.engine.world, body);
    if (tier > this.maxFruitTier) {
      this.maxFruitTier = tier;
      this.drawChainMap();
      this.launchGoalEnergy(tier);
    }
    this.burst(x, y + 6, definition.glow, 10);
    if (this.mode !== "endless" && tier >= LEVELS[this.levelIndex].target) {
      this.winPending = true;
      this.setTimer(
        () => this.finish("won", `${definition.name}诞生，甜度爆表！`),
        850,
      );
    }
    this.emitSnapshot();
  }

  private makeFruit(tier: number) {
    const definition = FRUITS[tier];
    const radius = this.fruitRadius(tier);
    const view = new Container();
    const emoji = new Text({
      text: definition.emoji,
      style: {
        fontSize: Math.max(18, radius * 1.72),
        dropShadow: {
          color: definition.glow,
          alpha: 0.42,
          blur: Math.max(2, radius * 0.12),
          distance: 0,
        },
      },
    });
    emoji.anchor.set(0.5);
    emoji.position.set(0, 1);
    view.addChild(emoji);
    view.scale.set(0.2);
    return view;
  }

  private onCollision = (event: Matter.IEventCollision<Matter.Engine>) => {
    if (this.status !== "playing") return;
    for (const pair of event.pairs) {
      const nodeA = this.fruits.get(pair.bodyA.id);
      const nodeB = this.fruits.get(pair.bodyB.id);
      if (!nodeA || !nodeB || nodeA.tier !== nodeB.tier) continue;
      if (nodeA.tier >= FRUITS.length - 1) {
        if (this.mode === "endless") this.rainbowClear(nodeA, nodeB);
        continue;
      }
      if (this.merging.has(pair.bodyA.id) || this.merging.has(pair.bodyB.id))
        continue;
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
    this.gainFever(7 + tier * 0.6);
    const points = Math.round(
      110 *
        2 ** Math.min(tier, 13) *
        multiplier(this.combo) *
        this.effectiveScoreMultiplier(),
    );
    this.addScore(points, x, y);
    this.burst(x, y, FRUITS[tier].color, 16 + tier);
    this.ring(x, y, FRUITS[tier].glow);
    if (tier >= 8) this.ring(x, y, 0xffffff, 1.4);
    this.shake = Math.min(14, 4 + tier * 0.58 + this.combo * 0.65);
    sounds.merge(tier);
    haptic(tier >= 8 ? [24, 35, 28, 35, 38] : [18, 28, 18]);
    this.callbacks.onToast(
      tier >= 11 ? "大果合成 · 果汁风暴！" : this.comboMessage(),
      tier >= 8 ? "gold" : "cyan",
    );
    this.setTimer(() => {
      this.merging.delete(first.body.id);
      this.merging.delete(second.body.id);
      this.spawnFruit(tier, x, y - 5);
      const newest = [...this.fruits.values()].at(-1);
      if (newest) Body.setVelocity(newest.body, { x: velocityX, y: -2.2 });
    }, 55);
  }

  private rainbowClear(first: FruitNode, second: FruitNode) {
    if (this.merging.has(first.body.id) || this.merging.has(second.body.id))
      return;
    this.merging.add(first.body.id);
    this.merging.add(second.body.id);
    const x = (first.body.position.x + second.body.position.x) / 2;
    const y = (first.body.position.y + second.body.position.y) / 2;
    const cleared = this.fruits.size;
    [...this.fruits.values()].forEach((fruit) => this.removeFruit(fruit));
    this.merging.clear();
    this.score += Math.round(100_000 * this.effectiveScoreMultiplier());
    [0xff4f9a, 0xffd85e, 0x45dcff].forEach((color, index) =>
      this.setTimer(
        () => this.ring(x, y, color, 1.4 + index * 0.42),
        index * 70,
      ),
    );
    this.burst(x, y, 0xffffff, 76);
    this.shake = 16;
    this.callbacks.onToast(`双果王 · 彩虹清场 ${cleared} 颗！`, "gold");
    sounds.win();
    haptic([30, 35, 45, 35, 70]);
    this.emitSnapshot();
  }

  private removeFruit(node: FruitNode) {
    Composite.remove(this.engine.world, node.body);
    this.fruits.delete(node.body.id);
    node.view.destroy({ children: true });
  }

  private registerCombo() {
    const window =
      (this.hasRelic("combo_engine") ? 3.4 : 2.3) + (this.feverActive ? 1 : 0);
    this.combo = this.elapsed - this.comboAt < window ? this.combo + 1 : 1;
    this.comboAt = this.elapsed;
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
    const available = Math.max(0, 190 - this.particles.length);
    const particleCount = Math.min(amount, available);
    for (let index = 0; index < particleCount; index += 1) {
      const size = 1.8 + Math.random() * 4.5;
      const shape = new Graphics();
      if (index % 3 === 0)
        shape
          .star(0, 0, 4, size, size * 0.3)
          .fill({ color: index % 5 === 0 ? 0xffffff : color });
      else
        shape
          .circle(0, 0, size)
          .fill({ color: index % 6 === 0 ? 0xffe169 : color });
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
    const ring = new Graphics()
      .circle(0, 0, 18)
      .stroke({ color, alpha: 0.95, width: 4 / size });
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
    this.attractMatchingFruits(deltaMs / 1000);

    if (this.dropPreviewLayer.children.length > 0) {
      this.dropPreviewLayer.alpha = 0.8 + Math.sin(this.elapsed * 5.5) * 0.2;
    }

    this.cards.forEach((card) => {
      if (!card.active) return;
      const glow = card.view.getChildByLabel("access-glow");
      if (glow?.visible)
        glow.alpha = 0.72 + Math.sin(this.elapsed * 3.2 + card.id * 0.35) * 0.28;
    });

    if (this.converterCore) {
      const pulse = 1 + Math.sin(this.elapsed * 4.4) * 0.055;
      this.converterCore.scale.set(pulse);
      this.converterCore.rotation = Math.sin(this.elapsed * 2.2) * 0.035;
    }

    this.ambientLayer.children.forEach((child, index) => {
      if (child.label?.startsWith("star-"))
        child.alpha = 0.35 + Math.sin(this.elapsed * 1.7 + index) * 0.25;
    });

    this.updateFever();
    this.updateConversions(deltaMs / 1000);
    this.updateGoalEnergies(deltaMs / 1000);
    this.updateParticles(delta, deltaMs / 1000);
    this.updateDanger();
    this.checkExhausted();

    if (this.shake > 0.15) {
      this.world.position.set(
        (Math.random() - 0.5) * this.shake,
        (Math.random() - 0.5) * this.shake,
      );
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

  private attractMatchingFruits(seconds: number) {
    const fruits = [...this.fruits.values()];
    for (let firstIndex = 0; firstIndex < fruits.length; firstIndex += 1) {
      const first = fruits[firstIndex];
      if (this.merging.has(first.body.id)) continue;
      for (
        let secondIndex = firstIndex + 1;
        secondIndex < fruits.length;
        secondIndex += 1
      ) {
        const second = fruits[secondIndex];
        if (first.tier !== second.tier || this.merging.has(second.body.id))
          continue;
        if (first.tier >= FRUITS.length - 1) continue;
        const dx = second.body.position.x - first.body.position.x;
        const dy = second.body.position.y - first.body.position.y;
        const distance = Math.hypot(dx, dy);
        // 已经贴上的交给碰撞合成,刚出生的先落稳再吸
        if (distance < 1 || distance < this.fruitRadius(first.tier) * 2 + 2)
          continue;
        if (
          this.elapsed - Number(first.body.plugin.birth || 0) < 0.5 ||
          this.elapsed - Number(second.body.plugin.birth || 0) < 0.5
        )
          continue;
        // 越近吸力越强(150~430 px/s²,换算为 Matter 速度单位 px/tick);
        // 基础吸力需大于地面静摩擦(约 108 px/s²),否则远处的同级水果拉不动
        const pull =
          ((150 + Math.max(0, 1 - distance / 150) * 280) *
            this.magnetMultiplier *
            (this.mutator.magnet || 1) *
            (this.feverActive ? 1.8 : 1) *
            seconds) /
          60;
        const pullX = (dx / distance) * pull;
        const pullY = 0;
        Body.setVelocity(first.body, {
          x: first.body.velocity.x + pullX,
          y: first.body.velocity.y + pullY,
        });
        Body.setVelocity(second.body, {
          x: second.body.velocity.x - pullX,
          y: second.body.velocity.y - pullY,
        });
        // 被夹住时改为强力横向滚动，不再自动向上跳。
        const stuck =
          Math.abs(first.body.velocity.x) + Math.abs(first.body.velocity.y) <
            0.67 &&
          Math.abs(second.body.velocity.x) + Math.abs(second.body.velocity.y) <
            0.67;
        const plugin = first.body.plugin as { pairT?: number };
        if (stuck) {
          plugin.pairT = (plugin.pairT || 0) + seconds;
          if (plugin.pairT > 1.1) {
            plugin.pairT = 0;
            const direction = dx > 0 ? 1 : -1;
            Body.setVelocity(first.body, {
              x: (direction * (210 + distance * 1.1)) / 60,
              y: Math.max(0, first.body.velocity.y),
            });
            Body.setAngularVelocity(first.body, direction * 0.12);
          }
        } else {
          plugin.pairT = 0;
        }
      }
    }
  }

  // 狂热倒计时与能量条渲染:激活时能量随剩余时间流失,结束归零重新充能
  private updateFever() {
    if (this.feverUntil > 0) {
      const remaining = this.feverUntil - this.elapsed;
      if (remaining <= 0) {
        this.feverUntil = -1;
        this.feverEnergy = 0;
        if (this.feverLabel) this.feverLabel.visible = false;
        if (this.status === "playing")
          this.callbacks.onToast("狂热结束 · 继续充能", "pink");
        this.emitSnapshot();
      } else {
        this.feverEnergy = (100 * remaining) / 9;
      }
    }
    if (this.feverFill) {
      this.feverFill.scale.x = this.feverEnergy / 100;
      this.feverFill.tint = this.feverActive
        ? Math.sin(this.elapsed * 10) > 0
          ? 0xffd85e
          : 0xffb13d
        : 0xff4f9a;
    }
    if (this.feverLabel?.visible) {
      this.feverLabel.alpha = 0.7 + Math.sin(this.elapsed * 8) * 0.3;
    }
  }

  private updateDanger() {
    if (this.status !== "playing" || this.winPending) return;
    const overflowing = [...this.fruits.values()].some((fruit) => {
      const birth = Number(fruit.body.plugin.birth || 0);
      return (
        this.elapsed - birth > 1.35 && fruit.body.bounds.min.y < WORLD.dangerY
      );
    });
    if (overflowing) {
      if (this.dangerSince < 0) this.dangerSince = this.elapsed;
      this.dangerProgress = Math.min(
        1,
        (this.elapsed - this.dangerSince) /
          Math.max(1, this.dangerLimit + (this.mutator.danger || 0)),
      );
      const line = this.ambientLayer.getChildByLabel("danger-line");
      if (line) line.alpha = 0.45 + Math.sin(this.elapsed * 13) * 0.4;
      if (this.dangerProgress >= 1)
        this.finish("lost", "甜度冲破警戒线，果箱爆满了");
    } else {
      this.dangerSince = -1;
      this.dangerProgress = Math.max(0, this.dangerProgress - 0.035);
    }
  }

  // 把同级两两合并推演到顶,看剩余水果能否达到目标(合成只增不减,降级道具救不了火,判负安全)
  private canReachTarget() {
    const counts = new Array(FRUITS.length).fill(0);
    this.fruits.forEach((fruit) => {
      counts[fruit.tier] += 1;
    });
    for (let tier = 0; tier < FRUITS.length - 1; tier += 1)
      counts[tier + 1] += counts[tier] >> 1;
    for (
      let tier = LEVELS[this.levelIndex].target;
      tier < FRUITS.length;
      tier += 1
    )
      if (counts[tier] > 0) return true;
    return false;
  }

  private checkExhausted() {
    if (this.mode === "endless") {
      if (
        this.status !== "playing" ||
        this.winPending ||
        this.cards.some((card) => card.active) ||
        this.pendingDrops.length > 0 ||
        this.merging.size > 0 ||
        this.wavePending
      ) {
        this.exhaustedSince = -1;
        return;
      }
      if (this.tray.length === 0) {
        this.maybeAdvanceEndless();
        this.exhaustedSince = -1;
        return;
      }
      if (this.exhaustedSince < 0) this.exhaustedSince = this.elapsed;
      if (this.elapsed - this.exhaustedSince > 2.6)
        this.finish("lost", `无尽第 ${this.wave} 波 · 卡槽残牌无法消除`);
      return;
    }
    if (
      this.status !== "playing" ||
      this.winPending ||
      this.cards.some((card) => card.active) ||
      this.tray.length > 0 ||
      this.pendingDrops.length > 0 ||
      this.merging.size > 0 ||
      this.canReachTarget()
    ) {
      this.exhaustedSince = -1;
      return;
    }
    if (this.exhaustedSince < 0) this.exhaustedSince = this.elapsed;
    if (this.elapsed - this.exhaustedSince > 2.6)
      this.finish("lost", "水果不够继续合成目标，再来一局吧");
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
      hammerLeft: this.hammerLeft,
      magnetLeft: this.magnetLeft,
      wildLeft: this.wildLeft,
      bubbleLeft: this.bubbleLeft,
      sunLeft: this.sunLeft,
      wave: this.wave,
      mode: this.mode,
      relics: [...this.relics],
      feverEnergy: Math.round(this.feverEnergy),
      feverActive: this.feverActive,
      mutator:
        this.mode !== "story" && this.mutator.id !== "calm"
          ? `${this.mutator.icon} ${this.mutator.name}`
          : "",
    };
  }

  private finish(status: "won" | "lost", reason: string) {
    if (this.status !== "playing") return;
    this.status = status;
    this.pendingDrops = [];
    this.aimX = null;
    this.dropToken += 1;
    this.renderDropPreview();
    this.shake = status === "won" ? 18 : 7;
    if (status === "won") {
      const bonus = Math.max(
        0,
        this.cards.filter((card) => card.active).length * 150 +
          (this.trayLimit - this.tray.length) * 300,
      );
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
    this.setTimer(
      () => this.callbacks.onFinish(result),
      status === "won" ? 900 : 350,
    );
  }

  undo = () => {
    if (
      this.paused ||
      this.status !== "playing" ||
      this.undoLeft <= 0 ||
      !this.lastPick
    )
      return;
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
    if (this.paused || this.status !== "playing" || this.shuffleLeft <= 0)
      return;
    const active = this.cards.filter((card) => card.active);
    const positions = shuffle(
      active.map(({ x, y, layer }) => ({ x, y, layer })),
    );
    active.forEach((card, index) => {
      card.x = positions[index].x;
      card.y = positions[index].y;
      card.layer = positions[index].layer;
      card.view.zIndex = card.layer * 100 + index;
      card.view.position.set(card.x, card.y);
      card.view.rotation = (Math.random() - 0.5) * 0.14;
    });
    this.shuffleLeft -= 1;
    this.lastPick = null;
    this.updateCardAccess();
    this.burst(
      WORLD.width / 2,
      WORLD.stack.y + WORLD.stack.height / 2,
      0xb88cff,
      34,
    );
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

  hammer = () => {
    if (this.paused || this.status !== "playing" || this.hammerLeft <= 0)
      return;
    const exposed = this.cards.filter(
      (card) => card.active && !this.isCovered(card),
    );
    const preferredTier = [...this.tray]
      .map((tier) => ({
        tier,
        count: this.tray.filter((value) => value === tier).length,
      }))
      .sort((a, b) => b.count - a.count)[0]?.tier;
    const target =
      exposed.find((card) => card.tier === preferredTier) || exposed[0];
    if (!target) {
      this.callbacks.onToast("没有可敲开的卡片", "cyan");
      return;
    }
    this.hammerLeft -= 1;
    target.locked = false;
    target.special = "normal";
    target.view.getChildByLabel("lock")?.destroy();
    target.view.getChildByLabel("special-icon")?.destroy();
    this.burst(target.x, target.y, 0xffd85e, 20);
    this.callbacks.onToast(
      `清顶锤 · 自动收取 ${FRUITS[target.tier].emoji}`,
      "gold",
    );
    this.pickCard(target);
    this.emitSnapshot();
  };

  // 万能果:把卡槽里最接近三消的一组直接补齐消除(设计文档"万能三消")
  wild = () => {
    if (this.paused || this.status !== "playing" || this.wildLeft <= 0) return;
    if (this.tray.length === 0) {
      this.callbacks.onToast("卡槽还是空的，先拿几张卡", "cyan");
      return;
    }
    const counts = new Map<number, number>();
    this.tray.forEach((tier) => counts.set(tier, (counts.get(tier) || 0) + 1));
    const [tier, count] = [...counts.entries()].sort(
      (a, b) => b[1] - a[1] || b[0] - a[0],
    )[0];
    this.wildLeft -= 1;
    this.callbacks.onToast(`万能果 · 补齐 ${FRUITS[tier].emoji} 三消`, "gold");
    this.burst(WORLD.width / 2, WORLD.tray.y + 30, 0xb6f36a, 24);
    haptic([16, 30, 24]);
    for (let missing = 3 - Math.min(count, 3); missing > 0; missing -= 1)
      this.collectTier(tier);
    this.lastPick = null;
    this.drawTray();
    this.emitSnapshot();
  };

  // 泡泡袋:从卡槽弹出两张最难凑成三消的牌,给残局留一次转身空间。
  bubble = () => {
    if (this.paused || this.status !== "playing" || this.bubbleLeft <= 0)
      return;
    if (this.tray.length === 0) {
      this.callbacks.onToast("卡槽还是空的", "cyan");
      return;
    }
    const counts = new Map<number, number>();
    this.tray.forEach((tier) => counts.set(tier, (counts.get(tier) || 0) + 1));
    const ordered = [...this.tray]
      .map((tier, index) => ({ index, count: counts.get(tier) || 0 }))
      .sort((a, b) => a.count - b.count || b.index - a.index)
      .slice(0, Math.min(2, this.tray.length))
      .sort((a, b) => b.index - a.index);
    ordered.forEach(({ index }) => this.tray.splice(index, 1));
    this.bubbleLeft -= 1;
    this.lastPick = null;
    this.drawTray();
    this.burst(WORLD.width / 2, WORLD.tray.y + 30, 0x8be9fd, 30);
    this.callbacks.onToast(`🫧 弹出 ${ordered.length} 张`, "cyan");
    haptic([12, 25, 12]);
    this.emitSnapshot();
  };

  // 阳光净化:一次清掉整副牌堆上的冰晶和藤蔓，不改变牌序与遮挡关系。
  sunshine = () => {
    if (this.paused || this.status !== "playing" || this.sunLeft <= 0) return;
    const obstacles = this.cards.filter(
      (card) =>
        card.active &&
        (card.locked || card.special === "frozen" || card.special === "vine"),
    );
    if (obstacles.length === 0) {
      this.callbacks.onToast("牌堆里没有冰晶或藤蔓", "cyan");
      return;
    }
    this.sunLeft -= 1;
    obstacles.forEach((card, index) => {
      card.locked = false;
      card.special = "normal";
      card.view.getChildByLabel("lock")?.destroy();
      card.view.getChildByLabel("special-icon")?.destroy();
      if (index < 12) this.burst(card.x, card.y, 0xffe878, 8);
    });
    this.updateCardAccess();
    this.burst(
      WORLD.width / 2,
      WORLD.stack.y + WORLD.stack.height / 2,
      0xffe878,
      42,
    );
    this.ring(WORLD.width / 2, WORLD.stack.y + 160, 0xfff5b5, 1.25);
    this.callbacks.onToast(`☀️ 净化 ${obstacles.length} 张障碍牌`, "gold");
    haptic([16, 28, 16]);
    this.emitSnapshot();
  };

  magnet = () => {
    if (this.paused || this.status !== "playing" || this.magnetLeft <= 0)
      return;
    const fruits = [...this.fruits.values()];
    let pair: [FruitNode, FruitNode] | null = null;
    let shortest = Number.POSITIVE_INFINITY;
    for (let first = 0; first < fruits.length; first += 1) {
      for (let second = first + 1; second < fruits.length; second += 1) {
        if (
          fruits[first].tier !== fruits[second].tier ||
          fruits[first].tier >= FRUITS.length - 1
        )
          continue;
        const distance = Math.hypot(
          fruits[first].body.position.x - fruits[second].body.position.x,
          fruits[first].body.position.y - fruits[second].body.position.y,
        );
        if (distance < shortest) {
          shortest = distance;
          pair = [fruits[first], fruits[second]];
        }
      }
    }
    if (!pair) {
      this.callbacks.onToast("果箱里还没有同级水果", "cyan");
      return;
    }
    this.magnetLeft -= 1;
    this.callbacks.onToast("引力核启动 · 立即合成！", "pink");
    this.mergeFruits(pair[0], pair[1]);
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
    if (this.destroyed) return;
    this.destroyed = true;
    this.timers.forEach((id) => window.clearTimeout(id));
    this.timers.clear();
    Events.off(this.engine, "collisionStart", this.onCollision);
    this.app.ticker.remove(this.tick);
    if (import.meta.env.DEV)
      delete (window as unknown as { __game?: FruitGame }).__game;
    Composite.clear(this.engine.world, false, true);
    this.app.destroy({ removeView: false }, { children: true, texture: true });
  };
}
