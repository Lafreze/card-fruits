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
import {
  buildFusionPairs,
  buildPlayableDeal,
  evaluateDropPlacement,
  forecastFusionChain,
  scatterStackSlots,
} from "./logic";
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
  targetX: number;
  tier: number;
  power: number;
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

type FruitPluginState = {
  tier: number;
  birth: number;
  noMergeUntil?: number;
  splitGroup?: number;
  splitUntil?: number;
  linkTargetId?: number;
  linkUntil?: number;
  resonanceUntil?: number;
  bondPower?: number;
  dropPower?: number;
  impactPending?: boolean;
};

type PendingDrop = {
  tier: number;
  power: number;
};

type FusionPairState = {
  pairedFor: number;
  stalledFor: number;
  lastDistance: number;
};

const { Engine, Bodies, Body, Composite, Events } = Matter;
const CARD_W = 58;
const CARD_H = 66;
const CARD_COVER_W = CARD_W + 6;
const CARD_COVER_H = CARD_H + 6;
const COVER_EPSILON = 0.5;
const DROP_GATE_RATIOS = [0.22, 0.5, 0.78] as const;

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
  private pendingDrops: PendingDrop[] = [];
  private fruitFocusUntil = 0;
  private focusedFruitIds = new Set<number>();
  private lastCardPhaseReady = true;
  private merging = new Set<number>();
  private fusionPairStates = new Map<string, FusionPairState>();
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
  private splitGroupCounter = 0;
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
  private ripenLeft = 1;
  private splitLeft = 1;
  private shieldLeft = 1;
  private sugarShieldUntil = -1;
  private aimX: number | null = null;
  private laneChain = 0;
  private previewPartnerId: number | null = null;
  private mutator: WaveMutator = rollMutator(1);
  private feverEnergy = 0;
  private feverUntil = -1;
  private feverFill: Graphics | null = null;
  private feverLabel: Text | null = null;
  private dangerLabel: Text | null = null;
  private dangerGlow: Graphics | null = null;
  private mutatorTag: Text | null = null;
  private phaseLabel: Text | null = null;
  private dropTarget: Graphics | null = null;
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
      this.splitLeft += 1;
    }
    if (this.hasRelic("crystal_seed")) {
      this.wildLeft += 1;
      this.juiceLeft += 1;
      this.ripenLeft += 1;
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

  private get sugarShieldActive() {
    return this.sugarShieldUntil > 0 && this.elapsed < this.sugarShieldUntil;
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
      this.setTimer(
        () =>
          this.callbacks.onToast("三消蓄果压 · 选择三果位", "cyan"),
        360,
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
    // 深色桌游底台：紫黑丝绒承载卡片与水果，金色只用在关键交互上。
    const background = new Graphics()
      .rect(0, 0, WORLD.width, WORLD.height)
      .fill({ color: 0x0e0b18 });
    this.ambientLayer.addChild(background);

    const haloA = new Graphics()
      .circle(62, 170, 138)
      .fill({ color: 0x5f3f89, alpha: 0.24 });
    const haloB = new Graphics()
      .circle(388, 590, 164)
      .fill({ color: 0x253f73, alpha: 0.25 });
    const haloC = new Graphics()
      .circle(204, 842, 145)
      .fill({ color: 0x5b4226, alpha: 0.16 });
    haloA.filters = [new BlurFilter({ strength: 64 })];
    haloB.filters = [new BlurFilter({ strength: 72 })];
    haloC.filters = [new BlurFilter({ strength: 68 })];
    this.ambientLayer.addChild(haloA, haloB, haloC);

    const dotPalette = [0xbba4ec, 0xd8b878, 0x7895c5];
    for (let index = 0; index < 22; index += 1) {
      const star = new Graphics().circle(0, 0, 0.65 + Math.random() * 1.05).fill({
        color: dotPalette[index % dotPalette.length],
        alpha: 0.12 + Math.random() * 0.2,
      });
      star.position.set(
        Math.random() * WORLD.width,
        Math.random() * WORLD.height,
      );
      star.label = `star-${Math.random() * 10}`;
      this.ambientLayer.addChild(star);
    }

    // 三块区域采用同一套深色玻璃、内描边与底部厚度。
    const panel = (
      x: number,
      y: number,
      width: number,
      height: number,
      radius: number,
      tint = 0x171321,
      border = 0x7f6aa9,
    ) => {
      const shadow = new Graphics()
        .roundRect(x + 2, y + 8, width - 4, height, radius + 2)
        .fill({ color: 0x05040a, alpha: 0.58 });
      const edge = new Graphics()
        .roundRect(x, y + 3, width, height, radius)
        .fill({ color: 0x251c35, alpha: 0.94 })
        .stroke({ color: border, alpha: 0.2, width: 1 });
      const face = new Graphics()
        .roundRect(x, y, width, height, radius)
        .fill({ color: tint, alpha: 0.965 })
        .stroke({ color: border, alpha: 0.46, width: 1.15 });
      const inner = new Graphics()
        .roundRect(x + 4, y + 4, width - 8, height - 8, Math.max(8, radius - 4))
        .stroke({ color: 0xffffff, alpha: 0.045, width: 1 });
      const highlight = new Graphics()
        .roundRect(x + 16, y + 8, width - 32, 1.5, 1)
        .fill({ color: 0xd7c9f2, alpha: 0.16 });
      this.ambientLayer.addChild(shadow, edge, face, inner, highlight);
    };
    panel(
      WORLD.stack.x,
      WORLD.stack.y,
      WORLD.stack.width,
      WORLD.stack.height,
      30,
      0x171321,
      0x826aaf,
    );
    panel(
      WORLD.tray.x,
      WORLD.tray.y,
      WORLD.tray.width,
      WORLD.tray.height,
      22,
      0x15111f,
      0x9b81c3,
    );
    panel(
      WORLD.box.x,
      WORLD.box.y,
      WORLD.box.width,
      WORLD.box.height,
      28,
      0x101722,
      0x537aa3,
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
      .fill({ color: 0xf05f67, alpha: 1 });
    this.dangerGlow.alpha = 0;
    const danger = new Graphics()
      .roundRect(
        WORLD.box.x + 16,
        WORLD.dangerY - 2,
        WORLD.box.width - 32,
        4,
        2,
      )
      .fill({ color: 0xf17a77, alpha: 0.25 });
    danger.label = "danger-line";
    this.ambientLayer.addChild(this.dangerGlow, danger);

    const zoneLabel = (text: string, x: number, y: number, anchorX = 0) => {
      const label = new Text({
        text,
        style: {
          fontFamily: "system-ui",
          fontSize: 10,
          fontWeight: "800",
          fill: 0x8f87a8,
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

    DROP_GATE_RATIOS.forEach((ratio, index) => {
      const gate = new Graphics()
        .circle(0, 0, 18)
        .fill({ color: 0xa890dc, alpha: 0.025 })
        .stroke({ color: 0x8e83ad, alpha: 0.17, width: 1 });
      gate.position.set(
        WORLD.box.x + WORLD.box.width * ratio,
        WORLD.box.y + 29,
      );
      gate.label = `drop-gate-base-${index}`;
      this.ambientLayer.addChild(gate);
    });

    this.dangerLabel = new Text({
      text: "甜度线",
      style: {
        fontFamily: "system-ui",
        fontSize: 9,
        fontWeight: "800",
        fill: 0xc0787d,
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
      .fill({ color: 0x282135, alpha: 1 });
    this.feverFill = new Graphics()
      .roundRect(0, 0, WORLD.tray.width - 28, 4, 2)
      .fill({ color: 0xffffff });
    this.feverFill.position.set(
      WORLD.tray.x + 14,
      WORLD.tray.y + WORLD.tray.height - 9,
    );
    this.feverFill.tint = 0xc2a5ff;
    this.feverFill.scale.x = this.feverEnergy / 100;
    this.feverLabel = new Text({
      text: "FEVER ×2",
      style: {
        fontFamily: "system-ui",
        fontSize: 9,
        fontWeight: "900",
        fill: 0xd7c3ff,
        stroke: { color: 0x171120, width: 3 },
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
        fill: 0x948cab,
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

    this.phaseLabel = new Text({
      text: "",
      style: {
        fontFamily: "system-ui",
        fontSize: 10,
        fontWeight: "900",
        fill: 0xe0bd74,
        letterSpacing: 0.5,
        stroke: { color: 0x171120, width: 4 },
      },
    });
    this.phaseLabel.anchor.set(0.5, 0);
    this.phaseLabel.position.set(WORLD.width / 2, WORLD.stack.y + 9);
    this.phaseLabel.visible = false;
    this.fxLayer.addChild(this.phaseLabel);

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
    this.dropTarget = dropTarget;
    // 有待投水果：三果位间拖动选择；没有待投时点水果轻推向同级伙伴。
    dropTarget.on("pointerdown", (event: FederatedPointerEvent) => {
      if (this.status !== "playing" || this.paused) return;
      if (this.pendingDrops.length > 0) {
        this.aimX = event.global.x;
        this.renderDropPreview();
      } else {
        this.pokeFruit(event.global.x, event.global.y);
      }
    });
    dropTarget.on("pointermove", (event: FederatedPointerEvent) => {
      if (this.aimX !== null && this.pendingDrops.length > 0) {
        this.aimX = event.global.x;
        this.renderDropPreview();
      }
    });
    const releaseAim = () => {
      if (this.aimX !== null) {
        const x = this.aimX;
        this.aimX = null;
        this.dropPending(x);
      }
    };
    dropTarget.on("pointerup", releaseAim);
    dropTarget.on("pointerupoutside", releaseAim);
    dropTarget.on("pointercancel", releaseAim);
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
      Math.random,
      this.levelIndex < 2,
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
      card.view.rotation = Math.max(
        -0.087,
        Math.min(
          0.087,
          (Math.random() - 0.5) * 0.15 + Math.sin(x / 47 + slot.layer) * 0.018,
        ),
      );
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

  // 六种有机牌阵轮廓 + 层间漂移；随机性来自整体构图，而不是单纯把卡抖乱。
  private scatterSlots(slots: Array<{ layer: number; x: number; y: number }>) {
    scatterStackSlots(slots, {
      left: 46,
      right: WORLD.width - 46,
      top: WORLD.stack.y + 52,
      bottom: WORLD.stack.y + WORLD.stack.height - 38,
      cardWidth: CARD_W,
      cardHeight: CARD_H,
    });
  }

  private makeCard(tier: number, special: CardSpecial, layer = 0) {
    const fruit = FRUITS[tier];
    const view = new Container();
    // 实体收藏卡：深色厚边、暖象牙纸、双层压印框和克制的烫金细节。
    const farShadow = new Graphics()
      .roundRect(
        -CARD_W / 2 - 1,
        -CARD_H / 2 + 7 + Math.min(3, layer * 0.38),
        CARD_W + 4,
        CARD_H + 3,
        13.5,
      )
      .fill({ color: 0x030208, alpha: 0.48 + Math.min(0.12, layer * 0.014) });
    const cardEdge = new Graphics()
      .roundRect(-CARD_W / 2, -CARD_H / 2 + 3, CARD_W, CARD_H, 12.5)
      .fill({ color: 0x312641, alpha: 1 })
      .stroke({ color: 0x6d5a86, alpha: 0.78, width: 1 });
    const glow = new Container();
    glow.label = "access-glow";
    const glowOuter = new Graphics()
      .roundRect(
        -CARD_W / 2 - 4.5,
        -CARD_H / 2 - 4.5,
        CARD_W + 9,
        CARD_H + 9,
        17,
      )
      .fill({ color: 0xa887df, alpha: 0.18 });
    const glowInner = new Graphics()
      .roundRect(
        -CARD_W / 2 - 2,
        -CARD_H / 2 - 2,
        CARD_W + 4,
        CARD_H + 4,
        14.5,
      )
      .stroke({ color: 0xd2b86f, alpha: 0.72, width: 1.35 });
    glow.addChild(glowOuter, glowInner);
    const face = new Graphics()
      .roundRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 12.5)
      .fill({ color: 0xf0ece4 })
      .stroke({ color: 0xcfc5d4, alpha: 0.96, width: 1 });
    face.label = "card-face";
    const paperWash = new Graphics()
      .roundRect(
        -CARD_W / 2 + 2,
        -CARD_H / 2 + 2,
        CARD_W - 4,
        CARD_H - 4,
        10.5,
      )
      .fill({ color: 0xfffcf5, alpha: 0.48 });
    const innerFrame = new Graphics()
      .roundRect(
        -CARD_W / 2 + 4.5,
        -CARD_H / 2 + 4.5,
        CARD_W - 9,
        CARD_H - 9,
        8.5,
      )
      .stroke({ color: 0x77688c, alpha: 0.26, width: 0.8 });
    innerFrame.label = "card-rim";
    const topGlint = new Graphics()
      .roundRect(-CARD_W / 2 + 9, -CARD_H / 2 + 5.5, CARD_W - 18, 1.25, 1)
      .fill({ color: 0xffffff, alpha: 0.82 });
    const medallion = new Graphics()
      .circle(0, -2, 19.5)
      .fill({ color: 0x6f6383, alpha: 0.055 })
      .stroke({ color: 0xa895bb, alpha: 0.18, width: 0.75 });
    const sheen = new Graphics()
      .roundRect(-13, -23, 26, 5.5, 2.75)
      .fill({ color: 0xffffff, alpha: 0.28 });
    sheen.label = "card-sheen";
    const emoji = new Text({
      text: fruit.emoji,
      style: {
        fontSize: 31,
        align: "center",
        dropShadow: { color: 0x251b35, alpha: 0.24, blur: 4, distance: 2 },
      },
    });
    emoji.anchor.set(0.5);
    emoji.position.set(0, -2.5);
    emoji.label = "card-symbol";
    const serial = new Text({
      text: String(tier + 1).padStart(2, "0"),
      style: {
        fontFamily: "Georgia, serif",
        fontSize: 6.5,
        fontWeight: "700",
        fill: 0x655876,
        letterSpacing: 0.4,
      },
    });
    serial.position.set(-CARD_W / 2 + 7, -CARD_H / 2 + 7);
    const collection = new Text({
      text: "ORCHARD",
      style: {
        fontFamily: "system-ui",
        fontSize: 5.5,
        fontWeight: "800",
        fill: 0x796d83,
        letterSpacing: 1.05,
      },
    });
    collection.anchor.set(0.5, 1);
    collection.position.set(0, CARD_H / 2 - 5.5);
    const resonanceDot = new Graphics()
      .star(0, 0, 4, 3, 1.25)
      .fill({ color: 0xd8b55f, alpha: 0.95 })
      .stroke({ color: 0xffedac, alpha: 0.72, width: 0.6 });
    resonanceDot.position.set(-20.5, 23);
    resonanceDot.label = "resonance-dot";
    resonanceDot.visible = false;
    const shade = new Graphics()
      .roundRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 12.5)
      .fill({ color: 0x171220, alpha: 0.72 })
      .stroke({ color: 0x71677f, alpha: 0.36, width: 1 });
    shade.label = "shade";
    shade.visible = false;
    view.addChild(
      farShadow,
      cardEdge,
      glow,
      face,
      paperWash,
      innerFrame,
      topGlint,
      medallion,
      sheen,
      emoji,
      serial,
      collection,
      resonanceDot,
      shade,
    );
    if (special === "frozen") {
      this.addCardBadge(view, "❄", 0x6c91b5, "lock");
    } else if (special === "bomb") {
      this.addCardBadge(view, "●", 0xa35663, "special-icon");
    } else if (special === "vine") {
      this.addCardBadge(view, "✦", 0x4f8b72, "special-icon");
    } else if (special === "sugar") {
      this.addCardBadge(view, "ϟ", 0xb88937, "special-icon");
    }
    return view;
  }

  private addCardBadge(
    view: Container,
    glyph: string,
    color: number,
    label: "lock" | "special-icon",
  ) {
    const badge = new Container();
    badge.label = label;
    badge.position.set(20, -25);
    const shadow = new Graphics()
      .circle(0, 1.4, 7.2)
      .fill({ color: 0x110d17, alpha: 0.34 });
    const seal = new Graphics()
      .circle(0, 0, 7)
      .fill({ color, alpha: 0.96 })
      .stroke({ color: 0xfff0ce, alpha: 0.74, width: 0.8 });
    const icon = new Text({
      text: glyph,
      style: {
        fontFamily: "system-ui",
        fontSize: glyph === "❄" ? 9 : 10,
        fontWeight: "900",
        fill: 0xffffff,
      },
    });
    icon.anchor.set(0.5);
    icon.position.set(0, -0.4);
    badge.addChild(shadow, seal, icon);
    view.addChild(badge);
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

  private isCardPhaseReady() {
    return (
      this.status === "playing" &&
      this.conversions.length === 0 &&
      this.fusionEchoes.length === 0 &&
      this.merging.size === 0 &&
      this.focusedFruitIds.size === 0 &&
      this.elapsed >= this.fruitFocusUntil
    );
  }

  private releaseSettledFruitFocus() {
    this.focusedFruitIds.forEach((id) => {
      const fruit = this.fruits.get(id);
      if (!fruit) {
        this.focusedFruitIds.delete(id);
        return;
      }
      const birth = Number(fruit.body.plugin.birth ?? this.elapsed);
      const age = this.elapsed - birth;
      const hasSettled =
        age >= 0.45 &&
        fruit.body.speed <= 0.55 &&
        Math.abs(fruit.body.angularVelocity) <= 0.055;
      // 磁吸或拥挤可能让水果一直轻微移动，最长观察 2.6 秒后交还卡牌操作。
      if (hasSettled || age >= 2.6) this.focusedFruitIds.delete(id);
    });
  }

  private refreshCardPhase() {
    const ready = this.isCardPhaseReady();
    if (ready !== this.lastCardPhaseReady) this.updateCardAccess();
  }

  private cardToolBlocked() {
    if (this.isCardPhaseReady()) return false;
    this.callbacks.onToast(
      this.conversions.length > 0 ? "水果正在生成" : "等水果落稳再选牌",
      "gold",
    );
    haptic([7, 18, 7]);
    return true;
  }

  private updateCardAccess() {
    const active = this.cards.filter((card) => card.active);
    const phaseReady = this.isCardPhaseReady();
    this.lastCardPhaseReady = phaseReady;
    if (this.phaseLabel) {
      this.phaseLabel.visible = this.status === "playing" && !phaseReady;
      this.phaseLabel.text =
        this.conversions.length > 0 ? "正在转成果实…" : "果箱结算中…";
    }
    if (this.dropTarget)
      this.dropTarget.cursor = this.pendingDrops.length > 0 ? "crosshair" : "grab";
    const accessible = active.filter((card) => !this.isCovered(card));
    const boxTiers = new Set(
      [...this.fruits.values()].map((fruit) => fruit.tier),
    );
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
      card.view.eventMode = phaseReady ? "static" : "none";
      card.view.cursor = phaseReady && usable ? "pointer" : "default";
      const shade = card.view.getChildByLabel("shade");
      const accessGlow = card.view.getChildByLabel("access-glow");
      const resonanceDot = card.view.getChildByLabel("resonance-dot");
      if (shade) {
        shade.visible = !usable;
        // 被遮挡牌保留水果轮廓与纸边，层级清楚但不会与可点牌争夺焦点。
        shade.alpha = covered ? 0.7 : 0.48;
      }
      if (accessGlow) accessGlow.visible = usable && phaseReady;
      if (resonanceDot)
        resonanceDot.visible = usable && phaseReady && boxTiers.has(card.tier);
      card.view.alpha = phaseReady ? 1 : usable ? 0.82 : 0.9;
      card.view.scale.set(usable ? (phaseReady ? 1 : 0.988) : 0.982);
    });
  }

  private pickCard(card: CardNode) {
    if (this.status !== "playing" || this.paused || !card.active) return;
    if (!this.isCardPhaseReady()) return;
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
      this.pendingDrops.length > 0 ||
      this.elapsed < this.fruitFocusUntil
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
    if (this.wave % 4 === 0) {
      this.wildLeft += 1;
      this.ripenLeft += 1;
    }
    if (this.wave % 5 === 0) {
      this.bubbleLeft += 1;
      this.shieldLeft += 1;
    }
    if (this.wave % 6 === 0) {
      this.sunLeft += 1;
      this.splitLeft += 1;
    }
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
      .roundRect(-21, -21, 42, 48, 10)
      .fill({ color: 0x050308, alpha: 0.46 });
    const edge = new Graphics()
      .roundRect(-20, -23, 40, 48, 9)
      .fill({ color: 0x332641 })
      .stroke({ color: 0x806c9c, alpha: 0.6, width: 1 });
    const face = new Graphics()
      .roundRect(-20, -25, 40, 48, 12)
      .fill({ color: 0xf0ece4 })
      .stroke({ color: 0xd6c6ad, alpha: 0.8, width: 0.8 });
    const frame = new Graphics()
      .roundRect(-16.5, -21.5, 33, 41, 8)
      .stroke({ color: 0x756581, alpha: 0.3, width: 0.7 });
    const icon = new Text({
      text: FRUITS[card.tier].emoji,
      style: { fontSize: 23 },
    });
    icon.anchor.set(0.5);
    icon.position.set(0, -1);
    view.addChild(shadow, edge, face, frame, icon);
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
            ? 0x302543
            : index < this.tray.length
              ? 0x241c31
              : pressure && lastOpen
                ? 0x3a202b
                : 0x211a2b,
          alpha: 1,
        })
        .stroke({
          color: pairReady
            ? 0xc0a0ef
            : pressure && lastOpen
              ? 0xea7d82
              : 0x59496c,
          alpha: pairReady || (pressure && lastOpen) ? 0.82 : 0.6,
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
    const power = this.dropPowerForTier(tier);
    this.activateCardResonance(tier);
    const transferX =
      this.findDropPartner(tier)?.body.position.x ?? WORLD.width / 2;
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
      targetX: transferX,
      tier,
      power,
      elapsed: -0.2,
      condensed: false,
    });
  }

  private updateConversions(seconds: number) {
    const transferY = WORLD.box.y - 2;
    this.conversions = this.conversions.filter((sequence) => {
      const transferX = sequence.targetX;
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
      this.queueDrop(sequence.tier, sequence.power);
      return false;
    });
  }

  private dropPowerForTier(tier: number) {
    const hasSameFruit = [...this.fruits.values()].some(
      (fruit) => fruit.tier === tier && !this.merging.has(fruit.body.id),
    );
    const sameFruitWaiting = this.pendingDrops.some(
      (pending) => pending.tier === tier,
    );
    return Math.min(
      3,
      1 +
        Number(hasSameFruit || sameFruitWaiting) +
        Number(this.combo >= 3 || this.feverActive),
    );
  }

  private queueDrop(tier: number, power = this.dropPowerForTier(tier)) {
    if (this.destroyed || this.status !== "playing") return;
    const wasEmpty = this.pendingDrops.length === 0;
    this.pendingDrops.push({ tier, power });
    this.renderDropPreview();
    this.updateCardAccess();
    if (wasEmpty) {
      haptic([10, 26, 12]);
    }
  }

  private fruitPlugin(fruit: FruitNode) {
    return fruit.body.plugin as FruitPluginState;
  }

  private activeBondTarget(fruit: FruitNode) {
    const plugin = this.fruitPlugin(fruit);
    if (!plugin.linkTargetId || Number(plugin.linkUntil || 0) <= this.elapsed)
      return;
    const target = this.fruits.get(plugin.linkTargetId);
    if (
      !target ||
      target.tier !== fruit.tier ||
      this.merging.has(target.body.id) ||
      this.fruitsShareSplitGroup(fruit, target)
    )
      return;
    return target;
  }

  private dropGateXs() {
    return DROP_GATE_RATIOS.map(
      (ratio) => WORLD.box.x + WORLD.box.width * ratio,
    );
  }

  private snapDropX(x: number) {
    return this.dropGateXs().reduce((best, gate) =>
      Math.abs(gate - x) < Math.abs(best - x) ? gate : best,
    );
  }

  private gateLoad(x: number) {
    return [...this.fruits.values()].reduce((load, fruit) => {
      const horizontal = Math.max(
        0,
        1 - Math.abs(fruit.body.position.x - x) / 92,
      );
      const heightPressure = Math.max(
        0,
        1 - (fruit.body.position.y - WORLD.box.y) / WORLD.box.height,
      );
      return load + horizontal * (1 + heightPressure * 1.6);
    }, 0);
  }

  // 选择与当前果位最接近且没有被其他共鸣占用的同级水果。
  private findDropPartner(tier: number, gateX?: number) {
    const candidates = [...this.fruits.values()]
      .filter(
        (fruit) =>
          fruit.tier === tier &&
          !this.merging.has(fruit.body.id) &&
          !this.fruitMergeCoolingDown(fruit),
      )
      .sort((a, b) => {
        const score = (fruit: FruitNode) =>
          Math.abs(fruit.body.position.x - (gateX ?? WORLD.width / 2)) +
          (fruit.body.position.y - WORLD.box.y) * 0.12;
        return score(a) - score(b);
      });
    return candidates.find((fruit) => !this.activeBondTarget(fruit));
  }

  private fusionPairKey(firstId: number, secondId: number) {
    return firstId < secondId
      ? `${firstId}:${secondId}`
      : `${secondId}:${firstId}`;
  }

  private linkFusionPair(
    first: FruitNode,
    second: FruitNode,
    power = 1,
  ) {
    if (
      first === second ||
      first.tier !== second.tier ||
      this.merging.has(first.body.id) ||
      this.merging.has(second.body.id)
    )
      return;
    const until = this.elapsed + 4.2;
    const firstPlugin = this.fruitPlugin(first);
    const secondPlugin = this.fruitPlugin(second);
    firstPlugin.linkTargetId = second.body.id;
    firstPlugin.linkUntil = until;
    firstPlugin.resonanceUntil = until;
    firstPlugin.bondPower = power;
    secondPlugin.linkTargetId = first.body.id;
    secondPlugin.linkUntil = until;
    secondPlugin.resonanceUntil = until;
    secondPlugin.bondPower = power;
    this.fusionPairStates.delete(
      this.fusionPairKey(first.body.id, second.body.id),
    );
    this.ring(first.body.position.x, first.body.position.y, 0xd8a94f, 0.5);
    this.ring(second.body.position.x, second.body.position.y, 0xd8a94f, 0.5);
  }

  // 三消先标亮箱内同果；真正的配对由玩家选择果位并完成投放后触发。
  private activateCardResonance(tier: number) {
    const matches = [...this.fruits.values()].filter(
      (fruit) =>
        fruit.tier === tier &&
        !this.merging.has(fruit.body.id) &&
        !this.fruitMergeCoolingDown(fruit),
    );
    matches.forEach((fruit) => {
      this.fruitPlugin(fruit).resonanceUntil = this.elapsed + 3.8;
      this.ring(
        fruit.body.position.x,
        fruit.body.position.y,
        FRUITS[tier].glow,
        0.52,
      );
    });
  }

  private preferredDropX(tier: number) {
    const partner = this.findDropPartner(tier);
    if (partner) return this.snapDropX(partner.body.position.x);
    return this.dropGateXs().sort(
      (first, second) => this.gateLoad(first) - this.gateLoad(second),
    )[0];
  }

  private renderDropPreview() {
    this.dropPreviewLayer
      .removeChildren()
      .forEach((child) => child.destroy({ children: true }));
    this.previewPartnerId = null;
    const pending = this.pendingDrops[0];
    if (!pending || this.status !== "playing") return;
    const { tier, power } = pending;
    const radius = this.fruitRadius(tier);
    const gates = this.dropGateXs();
    const x = this.snapDropX(this.aimX ?? this.preferredDropX(tier));
    const partner = this.findDropPartner(tier, x);
    const forecast = forecastFusionChain(
      [...this.fruits.values()].map((fruit) => fruit.tier),
      tier,
      FRUITS.length - 1,
    );
    const placement = evaluateDropPlacement(
      x,
      partner?.body.position.x,
      radius,
    );
    const willChain = forecast.merges > 0 && placement.precision;
    const displayPower = willChain && this.laneChain >= 2 ? 3 : power;

    gates.forEach((gateX) => {
      const selected = gateX === x;
      const gate = new Graphics()
        .circle(0, 0, selected ? 22 : 18)
        .fill({
          color: selected ? 0xe0b75d : 0x9c8bdd,
          alpha: selected ? 0.12 + displayPower * 0.035 : 0.035,
        })
        .stroke({
          color: selected ? 0xc8912c : 0xb8acd0,
          alpha: selected ? 0.48 : 0.16,
          width: selected ? 1.8 : 1,
        });
      gate.position.set(gateX, WORLD.box.y + 29);
      this.dropPreviewLayer.addChild(gate);
    });

    const landing = new Graphics()
      .circle(0, 0, radius + 5)
      .fill({ color: FRUITS[tier].glow, alpha: 0.09 })
      .stroke({ color: FRUITS[tier].glow, alpha: 0.46, width: 1.5 });
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

    for (let index = 0; index < 3; index += 1) {
      const pip = new Graphics().circle(0, 0, 2.2).fill({
        color: 0xd4a64b,
        alpha: index < displayPower ? 0.86 : 0.17,
      });
      pip.position.set(x + (index - 1) * 8, WORLD.box.y + 55);
      this.dropPreviewLayer.addChild(pip);
    }

    const chainText =
      willChain
        ? `${displayPower >= 3 ? "强震 · " : ""}连锁 ×${forecast.merges}  ${FRUITS[forecast.finalTier].emoji}`
        : this.pendingDrops.length > 1
          ? `待投 ${this.pendingDrops.length}`
          : "选择果位";
    const hint = new Text({
      text: chainText,
      style: {
        fontFamily: "system-ui",
        fontSize: 9,
        fontWeight: "900",
        fill: 0xffffff,
      },
    });
    hint.anchor.set(0.5);
    hint.position.set(WORLD.width / 2, WORLD.box.y + 78);
    const hintWidth = willChain ? (displayPower >= 3 ? 122 : 92) : 72;
    const hintBack = new Graphics()
      .roundRect(-hintWidth / 2, -10, hintWidth, 20, 10)
      .fill({ color: 0x40384e, alpha: 0.82 });
    hintBack.position.set(WORLD.width / 2, WORLD.box.y + 78);
    this.dropPreviewLayer.addChild(landing, emoji, hintBack, hint);
    if (partner) {
      const target = new Graphics()
        .circle(0, 0, this.fruitRadius(tier) + 7)
        .stroke({ color: FRUITS[tier].glow, alpha: 0.38, width: 2 });
      target.position.copyFrom(partner.body.position);
      target.label = "merge-target";
      this.previewPartnerId = partner.body.id;
      this.dropPreviewLayer.addChildAt(target, 0);
    }
    // 排队中的后续水果缩略显示
    this.pendingDrops.slice(1, 5).forEach((queued, index) => {
      const mini = new Text({
        text: FRUITS[queued.tier].emoji,
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

  private dropPending(chosenX?: number) {
    if (this.status !== "playing") return;
    const pending = this.pendingDrops.shift();
    if (!pending) return;
    const { tier } = pending;
    let power = pending.power;
    const x = this.snapDropX(chosenX ?? this.preferredDropX(tier));
    const partner = this.findDropPartner(tier, x);
    const placement = evaluateDropPlacement(
      x,
      partner?.body.position.x,
      this.fruitRadius(tier),
    );
    const forecast = forecastFusionChain(
      [...this.fruits.values()].map((fruit) => fruit.tier),
      tier,
      FRUITS.length - 1,
    );
    const plannedChain = placement.precision && forecast.merges > 0;
    this.laneChain = plannedChain ? this.laneChain + 1 : 0;
    const chainBurst = this.laneChain >= 3;
    if (chainBurst) {
      power = 3;
      this.laneChain = 0;
    }
    const dropped = this.spawnFruit(tier, x, WORLD.box.y + 18);
    if (dropped) {
      this.focusedFruitIds.add(dropped.body.id);
      const plugin = this.fruitPlugin(dropped);
      plugin.dropPower = power;
      plugin.impactPending = true;
      if (partner) this.linkFusionPair(dropped, partner, power);
    }
    // 手动投放不消耗连击窗口；玩家可以先观察果箱，再从容操作。
    if (this.combo > 0) this.comboAt = this.elapsed;
    this.fruitFocusUntil = Math.max(
      this.fruitFocusUntil,
      this.elapsed + 0.62,
    );
    const precisionBonus = placement.precision
      ? Math.round(
          (tier + 1) * 35 * power * this.effectiveScoreMultiplier(),
        )
      : 0;
    if (precisionBonus > 0)
      this.addScore(precisionBonus, x, WORLD.box.y + 76);
    if (placement.precision) {
      this.gainFever(2 + power * 2);
      this.burst(x, WORLD.box.y + 34, FRUITS[tier].glow, 12);
      this.ring(x, WORLD.box.y + 32, FRUITS[tier].glow, 0.48);
      haptic([12, 22, 18]);
    }
    if (chainBurst)
      this.callbacks.onToast("三连果位 · 强震落果", "gold");
    else if (plannedChain && forecast.merges > 1)
      this.callbacks.onToast(`预判连锁 ×${forecast.merges}`, "gold");
    else if (placement.precision)
      this.callbacks.onToast(`共鸣果位 · +${precisionBonus}`, "cyan");
    this.renderDropPreview();
    this.updateCardAccess();
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
    body.plugin = { tier, birth: this.elapsed } satisfies FruitPluginState;
    const view = this.makeFruit(tier);
    view.position.set(x, y);
    this.fruitLayer.addChild(view);
    const node = { body, tier, view };
    this.fruits.set(body.id, node);
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
    this.updateCardAccess();
    this.emitSnapshot();
    return node;
  }

  private makeFruit(tier: number) {
    const definition = FRUITS[tier];
    const radius = this.fruitRadius(tier);
    const view = new Container();
    const resonanceHalo = new Graphics()
      .circle(0, 0, radius + 5)
      .stroke({ color: 0xd8a94f, alpha: 0.72, width: 1.6 });
    resonanceHalo.label = "resonance-halo";
    resonanceHalo.visible = false;
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
    view.addChild(resonanceHalo, emoji);
    view.scale.set(0.2);
    return view;
  }

  private fruitMergeCoolingDown(fruit: FruitNode) {
    const plugin = fruit.body.plugin as { noMergeUntil?: number };
    return Number(plugin.noMergeUntil || 0) > this.elapsed;
  }

  private fruitsShareSplitGroup(first: FruitNode, second: FruitNode) {
    const firstPlugin = first.body.plugin as {
      splitGroup?: number;
      splitUntil?: number;
    };
    const secondPlugin = second.body.plugin as {
      splitGroup?: number;
      splitUntil?: number;
    };
    const firstGroup = Number(firstPlugin.splitGroup || 0);
    const secondGroup = Number(secondPlugin.splitGroup || 0);
    return (
      firstGroup > 0 &&
      firstGroup === secondGroup &&
      Math.min(
        Number(firstPlugin.splitUntil || 0),
        Number(secondPlugin.splitUntil || 0),
      ) > this.elapsed
    );
  }

  private triggerDropImpact(node: FruitNode) {
    const plugin = this.fruitPlugin(node);
    if (!plugin.impactPending) return;
    plugin.impactPending = false;
    const power = Math.max(1, Math.min(3, Number(plugin.dropPower || 1)));
    const radius =
      (72 + power * 34) * (this.hasRelic("storm_stir") ? 1.25 : 1);
    const nearby = [...this.fruits.values()].filter(
      (fruit) =>
        fruit !== node &&
        !this.merging.has(fruit.body.id) &&
        Math.hypot(
          fruit.body.position.x - node.body.position.x,
          fruit.body.position.y - node.body.position.y,
        ) <= radius,
    );
    nearby.forEach((fruit) => {
      if (fruit.tier === node.tier) return;
      const dx = fruit.body.position.x - node.body.position.x;
      const dy = fruit.body.position.y - node.body.position.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const falloff = Math.max(0.18, 1 - distance / radius);
      const direction = Math.sign(dx || (Math.random() - 0.5)) || 1;
      Body.setVelocity(fruit.body, {
        x: Math.max(
          -4.6,
          Math.min(
            4.6,
            fruit.body.velocity.x + direction * (0.62 + power * 0.42) * falloff,
          ),
        ),
        y: Math.max(0, fruit.body.velocity.y),
      });
      Body.setAngularVelocity(fruit.body, direction * 0.08 * power);
    });

    if (power >= 3) {
      const sameTier = [...this.fruits.values()].filter(
        (fruit) =>
          fruit.tier === node.tier &&
          !this.merging.has(fruit.body.id) &&
          !this.fruitMergeCoolingDown(fruit),
      );
      const pairs = buildFusionPairs(
        sameTier.map((fruit) => ({
          id: fruit.body.id,
          tier: fruit.tier,
          x: fruit.body.position.x,
          y: fruit.body.position.y,
          linkedId: this.activeBondTarget(fruit)?.body.id,
          blockedIds: sameTier
            .filter((other) => this.fruitsShareSplitGroup(fruit, other))
            .map((other) => other.body.id),
        })),
      );
      pairs.forEach((pair) => {
        const first = this.fruits.get(pair.firstId);
        const second = this.fruits.get(pair.secondId);
        if (first && second) this.linkFusionPair(first, second, power);
      });
    }

    this.ring(
      node.body.position.x,
      node.body.position.y,
      power >= 3 ? 0xd8a94f : FRUITS[node.tier].glow,
      0.62 + power * 0.22,
    );
    this.burst(
      node.body.position.x,
      node.body.position.y,
      FRUITS[node.tier].glow,
      8 + power * 7,
    );
    this.shake = Math.max(this.shake, 2 + power * 1.5);
    haptic(power >= 3 ? [18, 24, 34] : [10, 18]);
  }

  private onCollision = (event: Matter.IEventCollision<Matter.Engine>) => {
    if (this.status !== "playing") return;
    for (const pair of event.pairs) {
      const nodeA = this.fruits.get(pair.bodyA.id);
      const nodeB = this.fruits.get(pair.bodyB.id);
      if (nodeA) this.triggerDropImpact(nodeA);
      if (nodeB) this.triggerDropImpact(nodeB);
      if (!nodeA || !nodeB || nodeA.tier !== nodeB.tier) continue;
      if (
        this.fruitMergeCoolingDown(nodeA) ||
        this.fruitMergeCoolingDown(nodeB) ||
        this.fruitsShareSplitGroup(nodeA, nodeB)
      )
        continue;
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
    this.fruitFocusUntil = Math.max(this.fruitFocusUntil, this.elapsed + 0.52);
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
      const result = this.spawnFruit(
        echo.tier,
        echo.center.x,
        echo.center.y - 5,
      );
      if (result) {
        Body.setVelocity(result.body, { x: echo.velocityX, y: -2.45 });
        this.focusedFruitIds.add(result.body.id);
      }
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
    this.focusedFruitIds.delete(node.body.id);
    this.fruits.forEach((fruit) => {
      const plugin = this.fruitPlugin(fruit);
      if (plugin.linkTargetId !== node.body.id) return;
      delete plugin.linkTargetId;
      delete plugin.linkUntil;
      delete plugin.bondPower;
      plugin.resonanceUntil = Math.min(
        Number(plugin.resonanceUntil || this.elapsed),
        this.elapsed + 0.42,
      );
    });
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
    const seconds = deltaMs / 1000;
    this.elapsed += seconds;
    Engine.update(this.engine, deltaMs);

    this.fruits.forEach((fruit) => {
      fruit.view.position.copyFrom(fruit.body.position);
      fruit.view.rotation = fruit.body.angle;
      if (fruit.view.scale.x < 0.99) {
        const next = Math.min(1, fruit.view.scale.x + 0.11 * delta);
        fruit.view.scale.set(next);
      }
      const plugin = this.fruitPlugin(fruit);
      const resonanceHalo = fruit.view.getChildByLabel("resonance-halo");
      if (resonanceHalo) {
        const resonating =
          Number(plugin.linkUntil || 0) > this.elapsed ||
          Number(plugin.resonanceUntil || 0) > this.elapsed;
        resonanceHalo.visible = resonating;
        resonanceHalo.alpha = 0.5 + Math.sin(this.elapsed * 7.2) * 0.28;
        resonanceHalo.rotation = -fruit.body.angle + this.elapsed * 0.35;
      }
    });
    this.attractMatchingFruits(seconds);

    if (this.previewPartnerId !== null) {
      const partner = this.fruits.get(this.previewPartnerId);
      const target = this.dropPreviewLayer.getChildByLabel("merge-target");
      if (partner && target) {
        target.position.copyFrom(partner.body.position);
      } else if (this.pendingDrops.length > 0) this.renderDropPreview();
    }

    if (this.dropPreviewLayer.children.length > 0) {
      this.dropPreviewLayer.alpha = 0.8 + Math.sin(this.elapsed * 5.5) * 0.2;
    }

    this.cards.forEach((card) => {
      if (!card.active) return;
      const glow = card.view.getChildByLabel("access-glow");
      if (glow?.visible) {
        glow.alpha =
          0.62 + Math.sin(this.elapsed * 2.6 + card.id * 0.35) * 0.18;
        const breathe =
          1.0025 + Math.sin(this.elapsed * 2.25 + card.id * 0.27) * 0.0025;
        card.view.scale.set(breathe);
      }
      const sheen = card.view.getChildByLabel("card-sheen");
      if (sheen) {
        sheen.alpha =
          (glow?.visible ? 0.3 : 0.13) +
          Math.sin(this.elapsed * 1.55 + card.id * 0.21) * 0.055;
        sheen.x = Math.sin(this.elapsed * 0.72 + card.id) * 1.5;
      }
      const resonanceDot = card.view.getChildByLabel("resonance-dot");
      if (resonanceDot?.visible) {
        resonanceDot.alpha =
          0.62 + Math.sin(this.elapsed * 5.2 + card.id * 0.2) * 0.28;
        resonanceDot.rotation += seconds * 0.7;
      }
    });

    this.trayLayer.children.forEach((child) => {
      if (child.label === "tray-pair-ready")
        child.alpha = 0.82 + Math.sin(this.elapsed * 4.6) * 0.12;
    });

    this.ambientLayer.children.forEach((child, index) => {
      if (child.label?.startsWith("star-"))
        child.alpha = 0.35 + Math.sin(this.elapsed * 1.7 + index) * 0.25;
    });

    this.updateCardFlights(seconds);
    this.updateConversions(seconds);
    this.updateFusionEchoes(seconds);
    this.releaseSettledFruitFocus();
    this.refreshCardPhase();
    const fruitPhase = this.status === "playing" && !this.isCardPhaseReady();
    // 只在转果与真实落地结算时暂停倒计时；待投期间卡牌仍可继续操作。
    if (fruitPhase) {
      if (this.feverUntil > 0) this.feverUntil += seconds;
      if (this.sugarShieldUntil > 0) this.sugarShieldUntil += seconds;
      if (this.dangerSince >= 0) this.dangerSince += seconds;
    }
    this.updateFever();
    this.updateParticles(delta, seconds);
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
    const available = [...this.fruits.values()].filter(
      (fruit) =>
        !this.merging.has(fruit.body.id) &&
        !this.fruitMergeCoolingDown(fruit) &&
        fruit.tier < FRUITS.length - 1,
    );
    const candidates = available.map((fruit) => ({
      id: fruit.body.id,
      tier: fruit.tier,
      x: fruit.body.position.x,
      y: fruit.body.position.y,
      linkedId: this.activeBondTarget(fruit)?.body.id,
      blockedIds: available
        .filter((other) => this.fruitsShareSplitGroup(fruit, other))
        .map((other) => other.body.id),
    }));
    const plannedPairs = buildFusionPairs(candidates);
    const activeKeys = new Set<string>();

    for (const plan of plannedPairs) {
      const first = this.fruits.get(plan.firstId);
      const second = this.fruits.get(plan.secondId);
      if (
        !first ||
        !second ||
        this.merging.has(first.body.id) ||
        this.merging.has(second.body.id) ||
        this.fruitsShareSplitGroup(first, second)
      )
        continue;
      const key = this.fusionPairKey(first.body.id, second.body.id);
      activeKeys.add(key);
      const dx = second.body.position.x - first.body.position.x;
      const dy = second.body.position.y - first.body.position.y;
      const distance = Math.max(0.001, Math.hypot(dx, dy));
      const contactDistance =
        this.fruitRadius(first.tier) + this.fruitRadius(second.tier);
      const state = this.fusionPairStates.get(key) || {
        pairedFor: 0,
        stalledFor: 0,
        lastDistance: distance,
      };
      state.pairedFor += seconds;
      const progress = state.lastDistance - distance;
      const combinedSpeed = first.body.speed + second.body.speed;
      if (combinedSpeed < 0.58 || Math.abs(progress) < 0.035)
        state.stalledFor += seconds;
      else state.stalledFor = Math.max(0, state.stalledFor - seconds * 0.8);
      state.lastDistance = distance;
      this.fusionPairStates.set(key, state);

      const firstAge = this.elapsed - this.fruitPlugin(first).birth;
      const secondAge = this.elapsed - this.fruitPlugin(second).birth;
      if (firstAge < 0.24 || secondAge < 0.24) continue;
      const bondPower = plan.bonded
        ? Math.max(
            1,
            Number(this.fruitPlugin(first).bondPower || 1),
            Number(this.fruitPlugin(second).bondPower || 1),
          )
        : 0;

      // 轻微擦边、卡牌建立的共鸣、或长时间被小果卡住都会完成合成。
      const closeEnough =
        distance <= contactDistance + (plan.bonded ? 8 + bondPower * 3 : 5);
      const bondedRescue =
        plan.bonded &&
        state.pairedFor >=
          (distance < 180 ? 1.85 : 2.35) - (bondPower - 1) * 0.35;
      const crowdedRescue =
        !plan.bonded &&
        state.stalledFor >= 2.45 &&
        distance <= contactDistance + 58;
      if (closeEnough || bondedRescue || crowdedRescue) {
        this.mergeFruits(first, second);
        continue;
      }

      const pull =
        ((185 + Math.max(0, 1 - distance / 175) * 325) *
          this.magnetMultiplier *
          (this.mutator.magnet || 1) *
          (this.feverActive ? 1.8 : 1) *
          (plan.bonded ? 1.3 + bondPower * 0.24 : 1) *
          seconds) /
        60;
      const pullX = (dx / distance) * pull;
      const clampVelocity = (value: number) =>
        Math.max(-4.8, Math.min(4.8, value));
      Body.setVelocity(first.body, {
        x: clampVelocity(first.body.velocity.x + pullX),
        y: first.body.velocity.y,
      });
      Body.setVelocity(second.body, {
        x: clampVelocity(second.body.velocity.x - pullX),
        y: second.body.velocity.y,
      });

      // 只让较高的水果向下寻找伙伴，不把底部水果自动抛起。
      if (Math.abs(dy) > contactDistance * 0.45) {
        const upper = dy > 0 ? first : second;
        const downward = Math.min(
          plan.bonded ? 0.92 : 0.52,
          Math.abs(dy / distance) * pull * (plan.bonded ? 1.22 : 0.72) +
            (state.stalledFor > 0.72 ? 0.08 : 0),
        );
        Body.setVelocity(upper.body, {
          x: upper.body.velocity.x,
          y: Math.max(0, upper.body.velocity.y) + downward,
        });
      }
      if (state.stalledFor > 0.72) {
        const direction = Math.sign(dx || 1);
        Body.setAngularVelocity(first.body, direction * 0.09);
        Body.setAngularVelocity(second.body, -direction * 0.09);
      }
    }

    for (const key of this.fusionPairStates.keys())
      if (!activeKeys.has(key)) this.fusionPairStates.delete(key);
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
    if (this.sugarShieldActive) {
      this.dangerSince = -1;
      this.dangerProgress = Math.max(0, this.dangerProgress - 0.075);
      const line = this.ambientLayer.getChildByLabel("danger-line");
      if (line) line.alpha = 0.42 + Math.sin(this.elapsed * 4.5) * 0.08;
      if (this.dangerGlow) this.dangerGlow.alpha = 0;
      if (this.dangerLabel) {
        this.dangerLabel.text = `甜度盾 ${Math.ceil(this.sugarShieldUntil - this.elapsed)}s`;
        this.dangerLabel.style.fill = 0xa77b2d;
      }
      return;
    }
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
        this.elapsed < this.fruitFocusUntil ||
        this.focusedFruitIds.size > 0 ||
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
      this.elapsed < this.fruitFocusUntil ||
      this.focusedFruitIds.size > 0 ||
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
      ripenLeft: this.ripenLeft,
      splitLeft: this.splitLeft,
      shieldLeft: this.shieldLeft,
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
    this.focusedFruitIds.clear();
    this.aimX = null;
    this.renderDropPreview();
    this.updateCardAccess();
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
    if (this.paused || this.status !== "playing") return;
    if (this.cardToolBlocked() || this.undoLeft <= 0 || !this.lastPick) return;
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
    if (this.cardToolBlocked()) return;
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
      card.view.rotation = (Math.random() - 0.5) * 0.17;
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
    if (this.cardToolBlocked()) return;
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
    if (this.cardToolBlocked()) return;
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
    if (this.cardToolBlocked()) return;
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
    if (this.cardToolBlocked()) return;
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

  // 催熟露:把果箱中最低阶的一颗水果提升一级，主动补齐长合成链。
  ripen = () => {
    if (this.paused || this.status !== "playing" || this.ripenLeft <= 0) return;
    const target = [...this.fruits.values()]
      .filter(
        (fruit) =>
          fruit.tier < FRUITS.length - 1 && !this.merging.has(fruit.body.id),
      )
      .sort(
        (a, b) =>
          a.tier - b.tier || b.body.position.y - a.body.position.y,
      )[0];
    if (!target) {
      this.callbacks.onToast("果箱里还没有可催熟的水果", "cyan");
      return;
    }
    const { x, y } = target.body.position;
    const nextTier = target.tier + 1;
    this.removeFruit(target);
    const result = this.spawnFruit(nextTier, x, y - 5);
    if (result) {
      Body.setVelocity(result.body, { x: 0, y: -1.35 });
      this.focusedFruitIds.add(result.body.id);
    }
    this.ripenLeft -= 1;
    this.fruitFocusUntil = Math.max(this.fruitFocusUntil, this.elapsed + 0.62);
    this.updateCardAccess();
    this.burst(x, y, FRUITS[nextTier].glow, 30);
    this.ring(x, y, FRUITS[nextTier].glow, 0.9);
    this.callbacks.onToast(`🌱 催熟 · ${FRUITS[nextTier].name}`, "gold");
    haptic([14, 24, 26]);
    this.emitSnapshot();
  };

  // 分果剪:把最高阶水果拆成两颗低一级水果；10 秒内不彼此回吸，但能各自参与新合成。
  split = () => {
    if (this.paused || this.status !== "playing" || this.splitLeft <= 0) return;
    const target = [...this.fruits.values()]
      .filter(
        (fruit) =>
          fruit.tier > 0 &&
          !this.merging.has(fruit.body.id) &&
          !this.fruitMergeCoolingDown(fruit),
      )
      .sort(
        (a, b) =>
          b.tier - a.tier || a.body.position.y - b.body.position.y,
      )[0];
    if (!target) {
      this.callbacks.onToast("果箱里还没有可分开的水果", "cyan");
      return;
    }
    const nextTier = target.tier - 1;
    const { x, y } = target.body.position;
    const radius = this.fruitRadius(nextTier);
    const spread = radius + 6;
    const centerX = Math.max(
      WORLD.box.x + radius + spread,
      Math.min(WORLD.box.x + WORLD.box.width - radius - spread, x),
    );
    this.removeFruit(target);
    const pieces = [
      this.spawnFruit(nextTier, centerX - spread, y - 6),
      this.spawnFruit(nextTier, centerX + spread, y - 6),
    ].filter((fruit): fruit is FruitNode => Boolean(fruit));
    const splitGroup = ++this.splitGroupCounter;
    pieces.forEach((fruit, index) => {
      const plugin = fruit.body.plugin as {
        noMergeUntil?: number;
        splitGroup?: number;
        splitUntil?: number;
      };
      plugin.noMergeUntil = this.elapsed + 0.8;
      plugin.splitGroup = splitGroup;
      plugin.splitUntil = this.elapsed + 10;
      Body.setVelocity(fruit.body, {
        x: index === 0 ? -2.1 : 2.1,
        y: -1.1,
      });
      this.focusedFruitIds.add(fruit.body.id);
    });
    this.splitLeft -= 1;
    this.fruitFocusUntil = Math.max(this.fruitFocusUntil, this.elapsed + 0.78);
    this.updateCardAccess();
    this.burst(x, y, FRUITS[nextTier].glow, 34);
    this.callbacks.onToast("✂️ 分果 · 10 秒分流", "pink");
    haptic([20, 20, 12, 20, 20]);
    this.emitSnapshot();
  };

  // 甜度盾:8 秒内忽略警戒线；投果与合成观察阶段会暂停护盾计时。
  shield = () => {
    if (this.paused || this.status !== "playing" || this.shieldLeft <= 0)
      return;
    this.shieldLeft -= 1;
    this.sugarShieldUntil = Math.max(this.elapsed, this.sugarShieldUntil) + 8;
    this.dangerSince = -1;
    this.dangerProgress = 0;
    this.updateDanger();
    this.burst(WORLD.width / 2, WORLD.dangerY, 0xffd878, 38);
    this.ring(WORLD.width / 2, WORLD.dangerY, 0xffcf6a, 1.35);
    this.callbacks.onToast("🛡️ 甜度盾 · 8 秒免疫警戒", "gold");
    haptic([18, 32, 18, 32, 24]);
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
