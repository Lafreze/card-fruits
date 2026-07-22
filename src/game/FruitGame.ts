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
import { buildPlayableDeal } from "./logic";
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

type Ring = { view: Graphics; life: number; maxLife: number; size: number };
type FloatLabel = { view: Text; life: number; maxLife: number };
type ConversionSequence = {
  cards: Container[];
  fruit: Text;
  starts: Array<{ x: number; y: number }>;
  tier: number;
  elapsed: number;
  condensed: boolean;
};
type CardFlight = {
  view: Container;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  life: number;
  maxLife: number;
};
type FusionEcho = {
  first: Text;
  second: Text;
  result: Text;
  fromA: { x: number; y: number };
  fromB: { x: number; y: number };
  center: { x: number; y: number };
  sourceIds: [number, number];
  tier: number;
  velocityX: number;
  elapsed: number;
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
  private cardFlights: CardFlight[] = [];
  private fusionEchoes: FusionEcho[] = [];
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
  private comboWindowBonus = 0;
  private sweetStart = 0;
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
  private mutator: WaveMutator = rollMutator(1);
  private feverEnergy = 0;
  private feverUntil = -1;
  private feverFill: Graphics | null = null;
  private feverLabel: Text | null = null;
  private dangerLabel: Text | null = null;
  private dangerGlow: Graphics | null = null;
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
    // 温室对局内加成:磁力温床/分数水晶/连击丝带/甜蜜开局
    this.magnetMultiplier *= 1 + 0.12 * Math.min(3, upgrades.magnet || 0);
    this.scoreMultiplier *= 1 + 0.06 * Math.min(3, upgrades.score || 0);
    this.comboWindowBonus = 0.2 * Math.min(3, upgrades.combo || 0);
    this.sweetStart = Math.min(3, upgrades.sweetStart || 0);
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
    // 甜蜜开局(温室):每关开局自动掉落 N 颗本关最低阶水果,直接参与合成
    if (this.sweetStart > 0) {
      const baseTier = Math.min(
        ...LEVELS[this.levelIndex].cards.map((card) => card.tier),
      );
      for (let index = 0; index < this.sweetStart; index += 1) {
        this.setTimer(
          () =>
            this.spawnFruit(
              baseTier,
              WORLD.width / 2 + (index - (this.sweetStart - 1) / 2) * 42,
              WORLD.box.y + 24,
            ),
          640 + index * 200,
        );
      }
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
    // 暖象牙底 + 低饱和紫金光场；高饱和色只留给水果与关键反馈。
    const background = new Graphics()
      .rect(0, 0, WORLD.width, WORLD.height)
      .fill({ color: 0xf4f0ea });
    this.ambientLayer.addChild(background);

    const haloA = new Graphics()
      .circle(70, 175, 125)
      .fill({ color: 0xe8d8ca, alpha: 0.34 });
    const haloB = new Graphics()
      .circle(380, 610, 150)
      .fill({ color: 0xd9d1ed, alpha: 0.38 });
    const haloC = new Graphics()
      .circle(215, 830, 130)
      .fill({ color: 0xd9e1d8, alpha: 0.28 });
    haloA.filters = [new BlurFilter({ strength: 52 })];
    haloB.filters = [new BlurFilter({ strength: 60 })];
    haloC.filters = [new BlurFilter({ strength: 55 })];
    this.ambientLayer.addChild(haloA, haloB, haloC);

    const dotPalette = [0xc4b8d8, 0xd2c3b4, 0xb9c8bd];
    for (let index = 0; index < 18; index += 1) {
      const star = new Graphics().circle(0, 0, 0.8 + Math.random() * 1.2).fill({
        color: dotPalette[index % dotPalette.length],
        alpha: 0.16 + Math.random() * 0.22,
      });
      star.position.set(
        Math.random() * WORLD.width,
        Math.random() * WORLD.height,
      );
      star.label = `star-${Math.random() * 10}`;
      this.ambientLayer.addChild(star);
    }

    // 三块悬浮面板共用同一纸张、细边和阴影体系。
    const panel = (
      x: number,
      y: number,
      width: number,
      height: number,
      radius: number,
      tint = 0xffffff,
    ) => {
      const shadow = new Graphics()
        .roundRect(x + 2, y + 7, width - 4, height, radius + 2)
        .fill({ color: 0x44394f, alpha: 0.13 });
      const face = new Graphics()
        .roundRect(x, y, width, height, radius)
        .fill({ color: tint, alpha: 0.96 })
        .stroke({ color: 0xe5dfe7, alpha: 0.9, width: 1 });
      const highlight = new Graphics()
        .roundRect(x + 13, y + 10, width - 26, 2, 1)
        .fill({ color: 0xffffff, alpha: 0.92 });
      this.ambientLayer.addChild(shadow, face, highlight);
    };
    panel(
      WORLD.stack.x,
      WORLD.stack.y,
      WORLD.stack.width,
      WORLD.stack.height,
      30,
    );
    panel(WORLD.tray.x, WORLD.tray.y, WORLD.tray.width, WORLD.tray.height, 22);
    panel(
      WORLD.box.x,
      WORLD.box.y,
      WORLD.box.width,
      WORLD.box.height,
      28,
      0xfffdf8,
    );

    // 甜度警戒在安全时近乎隐形，真正超线后再逐级显现。
    this.dangerGlow = new Graphics()
      .roundRect(
        WORLD.box.x + 8,
        WORLD.dangerY - 18,
        WORLD.box.width - 16,
        36,
        18,
      )
      .fill({ color: 0xe67d72, alpha: 1 });
    this.dangerGlow.alpha = 0;
    const danger = new Graphics()
      .roundRect(
        WORLD.box.x + 16,
        WORLD.dangerY - 2,
        WORLD.box.width - 32,
        4,
        2,
      )
      .fill({ color: 0xd99186, alpha: 0.28 });
    danger.label = "danger-line";
    this.ambientLayer.addChild(this.dangerGlow, danger);

    const zoneLabel = (text: string, x: number, y: number, anchorX = 0) => {
      const label = new Text({
        text,
        style: {
          fontFamily: "system-ui",
          fontSize: 10,
          fontWeight: "800",
          fill: 0xaaa2b8,
          letterSpacing: 1.4,
        },
      });
      label.anchor.set(anchorX, 0);
      label.position.set(x, y);
      this.ambientLayer.addChild(label);
    };
    zoneLabel("卡片区", 32, WORLD.stack.y + 10);
    zoneLabel(
      "合成区",
      WORLD.box.x + WORLD.box.width - 22,
      WORLD.box.y + 12,
      1,
    );

    this.dangerLabel = new Text({
      text: "甜度线",
      style: {
        fontFamily: "system-ui",
        fontSize: 9,
        fontWeight: "800",
        fill: 0xb98b84,
        letterSpacing: 1,
      },
    });
    this.dangerLabel.position.set(33, WORLD.dangerY - 17);
    this.ambientLayer.addChild(this.dangerLabel);

    // 狂热能量条:贴在卡槽面板底边,充满触发 9 秒狂热
    const feverBack = new Graphics()
      .roundRect(
        WORLD.tray.x + 14,
        WORLD.tray.y + WORLD.tray.height - 9,
        WORLD.tray.width - 28,
        4,
        2,
      )
      .fill({ color: 0xe9e4f0, alpha: 1 });
    this.feverFill = new Graphics()
      .roundRect(0, 0, WORLD.tray.width - 28, 4, 2)
      .fill({ color: 0xffffff });
    this.feverFill.position.set(
      WORLD.tray.x + 14,
      WORLD.tray.y + WORLD.tray.height - 9,
    );
    this.feverFill.tint = 0xa48ef0;
    this.feverFill.scale.x = this.feverEnergy / 100;
    this.feverLabel = new Text({
      text: "FEVER ×2",
      style: {
        fontFamily: "system-ui",
        fontSize: 9,
        fontWeight: "900",
        fill: 0x8a76d8,
        stroke: { color: 0xffffff, width: 3 },
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

    // 变异波次标签(无尽/远征)
    this.mutatorTag = new Text({
      text: "",
      style: {
        fontFamily: "system-ui",
        fontSize: 10,
        fontWeight: "800",
        fill: 0xaaa2b8,
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
  }

  private updateMutatorTag() {
    if (!this.mutatorTag) return;
    const show = this.mode !== "story" && this.mutator.id !== "calm";
    this.mutatorTag.text = show
      ? `${this.mutator.icon} 变异 · ${this.mutator.name}`
      : "";
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
    // 布局块展开成卡位,按层从低到高排序;设计上卡位数 = 卡片数,不足时向上叠补
    const cardCount = definition.cards.reduce((sum, card) => sum + card.count, 0);
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
    while (slots.length < cardCount) {
      const top = slots[slots.length - 1];
      slots.push({ layer: top.layer + 1, x: top.x + 5, y: top.y - 6 });
    }
    this.scatterSlots(slots);
    const maxLayer = slots[slots.length - 1].layer;
    // 生成一条经过牌阵遮挡验证的安全路线。牌面仍有多条可选分支，
    // 但不再出现“开局能消、后续只能靠洗牌”的纯随机死局。
    const deal = buildPlayableDeal(
      definition.cards.flatMap(({ tier, count }) =>
        Array.from({ length: count / 3 }, () => tier),
      ),
      slots,
    );
    const { tiers, openingSlots: protectedOpeningSlots } = deal;

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
        view: this.makeCard(tier, special, slot.layer),
        locked,
        special,
      };
      card.view.position.set(x, y);
      card.view.rotation = (Math.random() - 0.5) * 0.075;
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

  // 同一牌阵保留镜像和层间轻微错位；限制旋转与剪切，让堆叠更像精心摆放的实体卡。
  private scatterSlots(slots: Array<{ layer: number; x: number; y: number }>) {
    const mirrorX = Math.random() < 0.5;
    const mirrorY = Math.random() < 0.35;
    const variant = Math.floor(Math.random() * 4);
    const maxLayer = Math.max(...slots.map((slot) => slot.layer));
    const centerX = WORLD.width / 2;
    const centerY = WORLD.stack.y + WORLD.stack.height / 2;
    const rotation = (Math.random() - 0.5) * 0.075;
    const twist = (Math.random() - 0.5) * 0.012;
    const shear = (Math.random() - 0.5) * 0.07;
    const wave = (Math.random() - 0.5) * 6;
    const globalDx = (Math.random() - 0.5) * 12;
    const globalDy = (Math.random() - 0.5) * 8;
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
      if (variant === 1) slot.x += Math.sin(slot.layer * 1.45) * 9;
      if (variant === 2)
        slot.y += Math.cos(slot.layer * 1.2 + slot.x / 95) * 7;
      if (variant === 3)
        slot.x += (slot.layer % 2 ? 1 : -1) * (4 + slot.layer * 1.2);
      if (!drift.has(slot.layer))
        drift.set(slot.layer, {
          dx: (Math.random() - 0.5) * 18,
          dy: (Math.random() - 0.5) * 12,
        });
      const layerDrift = drift.get(slot.layer)!;
      slot.x += globalDx + layerDrift.dx + (Math.random() - 0.5) * 10;
      slot.y += globalDy + layerDrift.dy + (Math.random() - 0.5) * 8;
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

  private makeCard(tier: number, special: CardSpecial, layer = 0) {
    const fruit = FRUITS[tier];
    const view = new Container();
    // 暖白卡面只用中性的层级阴影与统一紫罗兰选中光，水果是唯一高饱和色。
    const shadow = new Graphics()
      .roundRect(
        -CARD_W / 2 + 1.5,
        -CARD_H / 2 + 4 + Math.min(2.5, layer * 0.35),
        CARD_W,
        CARD_H,
        15,
      )
      .fill({ color: 0x40384e, alpha: 0.13 + Math.min(0.07, layer * 0.01) });
    const glow = new Container();
    glow.label = "access-glow";
    const glowOuter = new Graphics()
      .roundRect(-CARD_W / 2 - 5, -CARD_H / 2 - 5, CARD_W + 10, CARD_H + 10, 20)
      .fill({ color: 0xb9ade9, alpha: 0.26 });
    const glowInner = new Graphics()
      .roundRect(
        -CARD_W / 2 - 2.5,
        -CARD_H / 2 - 2.5,
        CARD_W + 5,
        CARD_H + 5,
        18,
      )
      .fill({ color: 0x9c8bdd, alpha: 0.42 });
    glow.addChild(glowOuter, glowInner);
    const face = new Graphics()
      .roundRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 15)
      .fill({ color: 0xfffefa })
      .stroke({ color: 0xe9e4ec, alpha: 0.9, width: 1 });
    const emoji = new Text({
      text: fruit.emoji,
      style: {
        fontSize: 30,
        align: "center",
        dropShadow: { color: 0x8a7f9e, alpha: 0.16, blur: 3, distance: 2 },
      },
    });
    emoji.anchor.set(0.5);
    emoji.position.set(0, -4);
    const shade = new Graphics()
      .roundRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 15)
      .fill({ color: 0xded9e2, alpha: 0.8 });
    shade.label = "shade";
    shade.visible = false;
    view.addChild(shadow, glow, face, emoji, shade);
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
      const overlapX = Math.max(0, CARD_COVER_W - Math.abs(other.x - card.x));
      const overlapY = Math.max(0, CARD_COVER_H - Math.abs(other.y - card.y));
      // 上层牌只要真实压住就锁住下层牌，避免露出一点边角时误点。
      return overlapX > COVER_EPSILON && overlapY > COVER_EPSILON;
    });
  }

  private coveringCards(card: CardNode) {
    return this.cards.filter((other) => {
      if (!other.active || other.layer <= card.layer || other.id === card.id)
        return false;
      const overlapX = Math.max(0, CARD_COVER_W - Math.abs(other.x - card.x));
      const overlapY = Math.max(0, CARD_COVER_H - Math.abs(other.y - card.y));
      return overlapX > COVER_EPSILON && overlapY > COVER_EPSILON;
    });
  }

  private explainBlocked(card: CardNode) {
    const blockers = card.locked ? [card] : this.coveringCards(card);
    blockers.slice(0, 3).forEach((blocker, index) => {
      this.setTimer(() => {
        if (!blocker.active) return;
        blocker.view.scale.set(1.035);
        this.ring(blocker.x, blocker.y, 0xf3b76a, 0.32);
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
    const matchingIndex = this.tray.lastIndexOf(card.tier);
    const trayDestination =
      matchingIndex >= 0 ? matchingIndex + 1 : this.tray.length;
    this.flyCardToTray(card, trayDestination);
    card.active = false;
    card.view.visible = false;
    card.special = "normal";
    // 炸弹与甜度牌已经产生不可逆效果，不允许撤回造成状态错账。
    this.lastPick = detonates || chargesFever ? null : card;
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
      this.tray.length > 0 ||
      this.cardFlights.length > 0 ||
      this.conversions.length > 0 ||
      this.fusionEchoes.length > 0 ||
      this.pendingDrops.length > 0
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

  private flyCardToTray(card: CardNode, destinationIndex: number) {
    const view = new Container();
    const shadow = new Graphics()
      .roundRect(-20, -23, 40, 48, 12)
      .fill({ color: 0x9186ad, alpha: 0.18 });
    const face = new Graphics()
      .roundRect(-20, -25, 40, 48, 12)
      .fill({ color: 0xffffff });
    const icon = new Text({
      text: FRUITS[card.tier].emoji,
      style: { fontSize: 23 },
    });
    icon.anchor.set(0.5);
    icon.position.set(0, -1);
    view.addChild(shadow, face, icon);
    view.position.set(card.x, card.y);
    view.rotation = card.view.rotation;
    this.fxLayer.addChild(view);
    this.cardFlights.push({
      view,
      fromX: card.x,
      fromY: card.y,
      toX: this.traySlotX(
        Math.max(0, Math.min(destinationIndex, this.trayLimit - 1)),
      ),
      toY: WORLD.tray.y + WORLD.tray.height / 2 - 1,
      life: 0.22,
      maxLife: 0.22,
    });
  }

  private drawTray() {
    this.trayLayer
      .removeChildren()
      .forEach((child) => child.destroy({ children: true }));
    const gap = 4;
    const slotWidth =
      (WORLD.tray.width - 20 - gap * (this.trayLimit - 1)) / this.trayLimit;
    const counts = new Map<number, number>();
    this.tray.forEach((tier) =>
      counts.set(tier, (counts.get(tier) || 0) + 1),
    );
    for (let index = 0; index < this.trayLimit; index += 1) {
      const x = WORLD.tray.x + 10 + slotWidth / 2 + index * (slotWidth + gap);
      const tier = this.tray[index];
      const pairReady = tier !== undefined && counts.get(tier) === 2;
      const pressure = this.tray.length >= this.trayLimit - 2;
      const lastOpen = tier === undefined && index === this.tray.length;
      const slot = new Graphics()
        .roundRect(-slotWidth / 2, -25, slotWidth, 50, 12)
        .fill({
          color: pairReady
            ? 0xe8e3f2
            : index < this.tray.length
              ? 0xf4f0e9
              : pressure && lastOpen
                ? 0xf3dfdc
                : 0xefebef,
          alpha: 1,
        })
        .stroke({
          color: pairReady ? 0xa999d0 : pressure && lastOpen ? 0xd49b92 : 0xe3dde5,
          alpha: pairReady || (pressure && lastOpen) ? 0.78 : 0.5,
          width: 1,
        });
      if (pairReady) slot.label = "tray-pair-ready";
      slot.position.set(x, WORLD.tray.y + WORLD.tray.height / 2);
      this.trayLayer.addChild(slot);
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

  private updateCardFlights(seconds: number) {
    this.cardFlights = this.cardFlights.filter((flight) => {
      flight.life -= seconds;
      const progress = Math.min(1, 1 - flight.life / flight.maxLife);
      const eased = 1 - (1 - progress) ** 3;
      flight.view.position.set(
        flight.fromX + (flight.toX - flight.fromX) * eased,
        flight.fromY +
          (flight.toY - flight.fromY) * eased -
          Math.sin(progress * Math.PI) * 18,
      );
      flight.view.rotation *= 0.82;
      flight.view.scale.set(1 - eased * 0.28);
      flight.view.alpha = 1 - Math.max(0, progress - 0.82) / 0.18;
      if (flight.life > 0) return true;
      this.burst(flight.toX, flight.toY, 0xb8a6ef, 5);
      flight.view.destroy({ children: true });
      return false;
    });
  }

  private startConversion(tier: number, matchedSlots: number[]) {
    const transferX = WORLD.width / 2;
    const transferY = WORLD.box.y - 2;
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
        .fill({ color: 0xffffff });
      const icon = new Text({
        text: FRUITS[tier].emoji,
        style: { fontSize: 16 },
      });
      icon.anchor.set(0.5);
      miniCard.addChild(face, icon);
      miniCard.position.set(x, y);
      miniCard.visible = false;
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
    fruit.position.set(transferX, transferY);
    fruit.visible = false;
    this.fxLayer.addChild(fruit);
    this.conversions.push({
      cards,
      fruit,
      starts,
      tier,
      elapsed: -0.2,
      condensed: false,
    });
  }

  private updateConversions(seconds: number) {
    const transferX = WORLD.width / 2;
    const transferY = WORLD.box.y - 2;
    this.conversions = this.conversions.filter((sequence) => {
      sequence.elapsed += seconds;
      if (sequence.elapsed < 0) return true;
      sequence.cards.forEach((card) => {
        card.visible = true;
      });
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
          start.x + (transferX - start.x) * eased,
          start.y +
            (transferY - start.y) * eased -
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
        this.burst(transferX, transferY, FRUITS[sequence.tier].glow, 24);
        this.ring(transferX, transferY, FRUITS[sequence.tier].glow, 0.75);
      }
      if (sequence.condensed) {
        const progress = Math.max(
          0,
          Math.min(1, (sequence.elapsed - gatherDuration) / 0.38),
        );
        const eased = progress * progress;
        sequence.fruit.position.set(
          transferX,
          transferY + (WORLD.box.y + 27 - transferY) * eased,
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
      this.callbacks.onToast(`获得 ${FRUITS[tier].emoji}`, "gold");
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
    const landing = new Graphics()
      .circle(0, 0, radius + 5)
      .fill({ color: FRUITS[tier].glow, alpha: aiming ? 0.1 : 0.06 })
      .stroke({ color: FRUITS[tier].glow, alpha: aiming ? 0.48 : 0.26, width: 1.5 });
    landing.position.set(x, WORLD.box.y + 28);
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
        : this.pendingDrops.length > 1
          ? `待投 ×${this.pendingDrops.length}`
          : "可拖动落点",
      style: {
        fontFamily: "system-ui",
        fontSize: 10,
        fontWeight: "900",
        fill: 0x6b6280,
        stroke: { color: 0xffffff, width: 4 },
      },
    });
    hint.anchor.set(0.5);
    hint.position.set(WORLD.width / 2, WORLD.box.y + 82);
    this.dropPreviewLayer.addChild(landing, emoji, hint);
    const partner = [...this.fruits.values()]
      .filter(
        (fruit) => fruit.tier === tier && !this.merging.has(fruit.body.id),
      )
      .sort((a, b) => b.body.position.y - a.body.position.y)[0];
    if (partner) {
      const target = new Graphics()
        .circle(0, 0, this.fruitRadius(tier) + 7)
        .stroke({ color: FRUITS[tier].glow, alpha: 0.38, width: 2 });
      target.position.copyFrom(partner.body.position);
      target.label = "merge-target";
      this.dropPreviewLayer.addChildAt(target, 0);
    }
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
    }, 2_400);
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
    const fromA = { x: first.body.position.x, y: first.body.position.y };
    const fromB = { x: second.body.position.x, y: second.body.position.y };
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
    this.burst(x, y, FRUITS[tier].glow, 8 + Math.floor(tier / 2));
    if (tier >= 8) this.ring(x, y, 0xffcf5e, 1.4);
    this.shake = Math.min(14, 4 + tier * 0.58 + this.combo * 0.65);
    sounds.merge(tier);
    haptic(tier >= 8 ? [24, 35, 28, 35, 38] : [18, 28, 18]);
    this.callbacks.onToast(
      tier >= 11 ? "大果合成 · 果汁风暴！" : this.comboMessage(),
      tier >= 8 ? "gold" : "cyan",
    );
    const fusionIcon = (fruitTier: number, fontScale = 1) => {
      const icon = new Text({
        text: FRUITS[fruitTier].emoji,
        style: {
          fontSize: Math.max(18, this.fruitRadius(fruitTier) * 1.72 * fontScale),
          dropShadow: {
            color: FRUITS[fruitTier].glow,
            alpha: 0.55,
            blur: 8,
            distance: 0,
          },
        },
      });
      icon.anchor.set(0.5);
      this.fxLayer.addChild(icon);
      return icon;
    };
    const echoA = fusionIcon(first.tier);
    const echoB = fusionIcon(second.tier);
    const result = fusionIcon(tier, 1.04);
    echoA.position.set(fromA.x, fromA.y);
    echoB.position.set(fromB.x, fromB.y);
    result.position.set(x, y - 4);
    result.visible = false;
    this.fusionEchoes.push({
      first: echoA,
      second: echoB,
      result,
      fromA,
      fromB,
      center: { x, y },
      sourceIds: [first.body.id, second.body.id],
      tier,
      velocityX,
      elapsed: 0,
    });
  }

  private updateFusionEchoes(seconds: number) {
    this.fusionEchoes = this.fusionEchoes.filter((echo) => {
      echo.elapsed += seconds;
      const gather = Math.min(1, echo.elapsed / 0.16);
      const eased = 1 - (1 - gather) ** 3;
      for (const [icon, start, direction] of [
        [echo.first, echo.fromA, -1],
        [echo.second, echo.fromB, 1],
      ] as const) {
        icon.position.set(
          start.x + (echo.center.x - start.x) * eased,
          start.y + (echo.center.y - start.y) * eased - Math.sin(gather * Math.PI) * 6,
        );
        icon.rotation = direction * eased * 0.18;
        icon.scale.set(1 - eased * 0.68);
        icon.alpha = 1 - Math.max(0, gather - 0.72) / 0.28;
      }
      if (echo.elapsed >= 0.13) {
        const reveal = Math.min(1, (echo.elapsed - 0.13) / 0.18);
        echo.result.visible = true;
        echo.result.alpha = Math.min(1, reveal * 2.2);
        echo.result.scale.set(0.32 + Math.sin(reveal * Math.PI) * 0.88 + reveal * 0.68);
        echo.result.rotation = (1 - reveal) * -0.12;
      }
      if (echo.elapsed < 0.32) return true;
      echo.first.destroy();
      echo.second.destroy();
      echo.result.destroy();
      echo.sourceIds.forEach((id) => this.merging.delete(id));
      this.burst(echo.center.x, echo.center.y, FRUITS[echo.tier].color, 18 + echo.tier);
      this.ring(echo.center.x, echo.center.y, FRUITS[echo.tier].glow, 0.9);
      this.spawnFruit(echo.tier, echo.center.x, echo.center.y - 5);
      const newest = [...this.fruits.values()].at(-1);
      if (newest)
        Body.setVelocity(newest.body, { x: echo.velocityX, y: -2.45 });
      return false;
    });
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
    this.burst(x, y, 0xffd166, 76);
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
      (this.hasRelic("combo_engine") ? 3.4 : 2.3) +
      this.comboWindowBonus +
      (this.feverActive ? 1 : 0);
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
        fill: this.combo >= 4 ? 0xe08a00 : 0x5a5170,
        stroke: { color: 0xffffff, width: 4 },
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
          .fill({ color: index % 5 === 0 ? 0xffd166 : color });
      else
        shape
          .circle(0, 0, size)
          .fill({ color: index % 6 === 0 ? 0xffe169 : color });
      shape.position.set(x, y);
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

  // 扩散圈:小半径、细线、短寿命,浅色背景下点到为止
  private ring(x: number, y: number, color: number, size = 1) {
    const ring = new Graphics()
      .circle(0, 0, 14)
      .stroke({ color, alpha: 0.7, width: 2.5 / size });
    ring.position.set(x, y);
    ring.scale.set(size);
    this.fxLayer.addChild(ring);
    this.rings.push({ view: ring, life: 0.42, maxLife: 0.42, size });
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
        glow.alpha =
          0.72 + Math.sin(this.elapsed * 3.2 + card.id * 0.35) * 0.28;
    });

    this.trayLayer.children.forEach((child) => {
      if (child.label === "tray-pair-ready")
        child.alpha = 0.82 + Math.sin(this.elapsed * 4.6) * 0.12;
    });

    this.ambientLayer.children.forEach((child, index) => {
      if (child.label?.startsWith("star-"))
        child.alpha = 0.35 + Math.sin(this.elapsed * 1.7 + index) * 0.25;
    });

    this.updateFever();
    this.updateCardFlights(deltaMs / 1000);
    this.updateConversions(deltaMs / 1000);
    this.updateFusionEchoes(deltaMs / 1000);
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
      ring.view.scale.set(ring.size * (1 + progress * 2.4));
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
          ? 0xffbe4d
          : 0xf3a53a
        : 0xa48ef0;
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
      if (line)
        line.alpha =
          0.34 + this.dangerProgress * 0.4 + Math.sin(this.elapsed * 13) * 0.12;
      if (this.dangerGlow)
        this.dangerGlow.alpha =
          this.dangerProgress * (0.08 + Math.sin(this.elapsed * 9) * 0.025);
      if (this.dangerLabel) {
        this.dangerLabel.text = `甜度警戒 ${Math.round(this.dangerProgress * 100)}%`;
        this.dangerLabel.style.fill = 0xc6685f;
      }
      if (this.dangerProgress >= 1)
        this.finish("lost", "甜度冲破警戒线，果箱爆满了");
    } else {
      this.dangerSince = -1;
      this.dangerProgress = Math.max(0, this.dangerProgress - 0.035);
      const line = this.ambientLayer.getChildByLabel("danger-line");
      if (line) line.alpha = 0.28;
      if (this.dangerGlow) this.dangerGlow.alpha = this.dangerProgress * 0.06;
      if (this.dangerLabel) {
        this.dangerLabel.text = "甜度线";
        this.dangerLabel.style.fill = 0xb98b84;
      }
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
        this.cardFlights.length > 0 ||
        this.conversions.length > 0 ||
        this.fusionEchoes.length > 0 ||
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
      this.cardFlights.length > 0 ||
      this.conversions.length > 0 ||
      this.fusionEchoes.length > 0 ||
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
      mutatorHint:
        this.mode !== "story" && this.mutator.id !== "calm"
          ? this.mutator.description
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
      this.ring(WORLD.width / 2, WORLD.height / 2, 0xffcf5e, 1.6);
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
      card.view.rotation = (Math.random() - 0.5) * 0.075;
    });
    // 洗牌是救场资源：把卡槽中最接近三消的一组放到可选层，
    // 避免消耗道具后仍然只得到一副没有即时决策价值的牌面。
    const trayCounts = new Map<number, number>();
    this.tray.forEach((tier) =>
      trayCounts.set(tier, (trayCounts.get(tier) || 0) + 1),
    );
    const activeCounts = new Map<number, number>();
    active.forEach((card) =>
      activeCounts.set(card.tier, (activeCounts.get(card.tier) || 0) + 1),
    );
    const preferredTier = [...new Set([...trayCounts.keys(), ...activeCounts.keys()])]
      .map((tier) => ({
        tier,
        held: trayCounts.get(tier) || 0,
        available: activeCounts.get(tier) || 0,
      }))
      .filter(({ held, available }) => available >= Math.max(1, 3 - held))
      .sort((a, b) => b.held - a.held || b.available - a.available)[0]?.tier;
    if (preferredTier !== undefined) {
      const exposed = active.filter((card) => !this.isCovered(card));
      const alreadyReady = exposed.filter(
        (card) => card.tier === preferredTier && !card.locked,
      ).length;
      const needed = Math.max(
        0,
        3 - (trayCounts.get(preferredTier) || 0) - alreadyReady,
      );
      const sources = active.filter(
        (card) =>
          card.tier === preferredTier &&
          !card.locked &&
          !exposed.includes(card),
      );
      const targets = exposed.filter((card) => card.tier !== preferredTier);
      for (
        let index = 0;
        index < Math.min(needed, sources.length, targets.length);
        index += 1
      ) {
        const source = sources[index];
        const target = targets[index];
        const sourcePosition = { x: source.x, y: source.y, layer: source.layer };
        source.x = target.x;
        source.y = target.y;
        source.layer = target.layer;
        target.x = sourcePosition.x;
        target.y = sourcePosition.y;
        target.layer = sourcePosition.layer;
        source.view.position.set(source.x, source.y);
        target.view.position.set(target.x, target.y);
        source.view.zIndex = source.layer * 100 + source.id;
        target.view.zIndex = target.layer * 100 + target.id;
      }
    }
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
