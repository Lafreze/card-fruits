export type FruitDefinition = {
  name: string;
  emoji: string;
  radius: number;
  color: number;
  glow: number;
};

// 一个布局块 = 同一层里的一片网格卡位;x/y 是块中心,cols/rows 展开成卡位
export type LayoutBlock = {
  layer: number;
  x: number;
  y: number;
  cols: number;
  rows: number;
  sx: number;
  sy: number;
};

export type LevelDefinition = {
  name: string;
  target: number;
  cards: Array<{ tier: number; count: number }>;
  specialRate: number;
  layout: LayoutBlock[];
};

export const FRUITS: FruitDefinition[] = [
  { name: "葡萄", emoji: "🍇", radius: 10, color: 0x9b5de5, glow: 0xd8b4fe },
  { name: "樱桃", emoji: "🍒", radius: 12, color: 0xef476f, glow: 0xff9bb1 },
  { name: "草莓", emoji: "🍓", radius: 15, color: 0xff4d6d, glow: 0xffb3c1 },
  { name: "柠檬", emoji: "🍋", radius: 18, color: 0xffd166, glow: 0xffef9f },
  { name: "猕猴桃", emoji: "🥝", radius: 21, color: 0x8ac926, glow: 0xc5f277 },
  { name: "橙子", emoji: "🍊", radius: 25, color: 0xff9f1c, glow: 0xffc971 },
  { name: "苹果", emoji: "🍎", radius: 29, color: 0xff595e, glow: 0xff9c9f },
  { name: "桃子", emoji: "🍑", radius: 33, color: 0xff8fab, glow: 0xffc2d1 },
  { name: "芒果", emoji: "🥭", radius: 38, color: 0xffb703, glow: 0xffd166 },
  { name: "菠萝", emoji: "🍍", radius: 42, color: 0xf7c948, glow: 0xffe69a },
  { name: "哈密瓜", emoji: "🍈", radius: 47, color: 0x90be6d, glow: 0xc7f9b5 },
  { name: "西瓜", emoji: "🍉", radius: 53, color: 0x43aa8b, glow: 0x9bf6cf },
  {
    name: "黄金果王",
    emoji: "👑",
    radius: 60,
    color: 0xffd60a,
    glow: 0xfff3a3,
  },
];

const B = (
  layer: number,
  x: number,
  y: number,
  cols: number,
  rows: number,
  sx = 72,
  sy = 76,
): LayoutBlock => ({ layer, x, y, cols, rows, sx, sy });

// 布局设计约束(卡片 58×66):同层间距 sx≥68/sy≥66 不互压;
// 上层压下层用半错位 dx=36 或 dy=38(或双向),遮盖面积 ≥616 才算真正盖住。
// 每个布局的卡位总数必须等于该关 cards 数量之和。

// 第 1 关 · 18 张:双层缓坡,教学关,全部露脸只有轻遮
const OPEN_MEADOW = [B(0, 215, 238, 5, 2), B(1, 215, 276, 4, 2)];

// 第 2 关 · 24 张:三层砖墙,上层横向半错位压住下层
const BRICK_WALL = [
  B(0, 215, 244, 4, 3, 84),
  B(1, 215, 244, 3, 3, 84),
  B(2, 215, 244, 3, 1, 84),
];

// 第 3 关 · 33 张:四层金字塔,层层收窄
const PYRAMID = [
  B(0, 215, 244, 5, 3),
  B(1, 215, 244, 4, 2),
  B(2, 215, 244, 3, 2),
  B(3, 215, 244, 2, 2),
];

// 第 4 关 · 33 张:左右双塔 + 中央三叠桥
const TWIN_TOWERS = [
  B(0, 120, 244, 2, 3),
  B(1, 120, 244, 1, 3),
  B(2, 120, 244, 1, 2),
  B(3, 120, 244, 1, 1),
  B(0, 310, 244, 2, 3),
  B(1, 310, 244, 1, 3),
  B(2, 310, 244, 1, 2),
  B(3, 310, 244, 1, 1),
  B(0, 215, 244, 1, 3),
  B(1, 215, 244, 1, 3),
  B(2, 215, 244, 1, 3),
];

// 第 5 关 · 36 张:菱形结晶,四行紧排 + 两翼
const DIAMOND = [
  B(0, 215, 251, 3, 4, 72, 66),
  B(0, 71, 251, 1, 1, 72, 66),
  B(0, 359, 251, 1, 1, 72, 66),
  B(1, 215, 251, 4, 3, 72, 66),
  B(2, 215, 251, 3, 2, 72, 66),
  B(3, 215, 251, 4, 1),
];

// 第 6 关 · 36 张:外环 + 侧翼双叠 + 中心五层深井
const RING_WELL = [
  B(0, 215, 168, 4, 1),
  B(0, 215, 320, 4, 1),
  B(0, 71, 244, 1, 1),
  B(0, 359, 244, 1, 1),
  B(0, 215, 244, 2, 1),
  B(1, 215, 244, 3, 2),
  B(1, 71, 244, 1, 1),
  B(1, 359, 244, 1, 1),
  B(2, 215, 244, 3, 3),
  B(3, 215, 244, 2, 2),
  B(4, 215, 244, 3, 1),
];

// 第 7 关 · 36 张:五层大金字塔,塔尖三连
const GRAND_PYRAMID = [
  B(0, 215, 244, 5, 3),
  B(1, 215, 244, 4, 2),
  B(2, 215, 244, 3, 2),
  B(3, 215, 244, 2, 2),
  B(4, 215, 244, 1, 3),
];

// 第 8 关 · 36 张:四层厚砖墙,交替错缝
const HEAVY_BRICKS = [
  B(0, 215, 244, 4, 3, 84),
  B(1, 215, 244, 3, 3, 84),
  B(2, 215, 244, 2, 3, 84),
  B(3, 215, 244, 3, 3, 84),
];

// 第 9 关 · 36 张:深双塔 + 中央四层吊桥
const DEEP_TOWERS = [
  B(0, 120, 244, 2, 3),
  B(1, 120, 244, 1, 3),
  B(2, 120, 244, 2, 2),
  B(3, 120, 244, 1, 2),
  B(0, 310, 244, 2, 3),
  B(1, 310, 244, 1, 3),
  B(2, 310, 244, 2, 2),
  B(3, 310, 244, 1, 2),
  B(0, 215, 168, 1, 1),
  B(0, 215, 244, 1, 1),
  B(0, 215, 320, 1, 1),
  B(2, 215, 206, 1, 1),
  B(2, 215, 282, 1, 1),
  B(3, 215, 244, 1, 1),
];

// 第 10 关 · 36 张:十字圣坛 + 四角三叠哨塔 + 中心五层
const CROSS_ALTAR = [
  B(0, 215, 244, 5, 1),
  B(0, 215, 168, 1, 1),
  B(0, 215, 320, 1, 1),
  B(1, 215, 244, 4, 1),
  B(1, 215, 178, 1, 1),
  B(1, 215, 310, 1, 1),
  B(2, 215, 244, 3, 1),
  B(2, 215, 168, 1, 1),
  B(2, 215, 320, 1, 1),
  B(0, 107, 168, 1, 1),
  B(1, 113, 174, 1, 1),
  B(2, 119, 180, 1, 1),
  B(0, 323, 168, 1, 1),
  B(1, 317, 174, 1, 1),
  B(2, 311, 180, 1, 1),
  B(0, 107, 320, 1, 1),
  B(1, 113, 314, 1, 1),
  B(2, 119, 308, 1, 1),
  B(0, 323, 320, 1, 1),
  B(1, 317, 314, 1, 1),
  B(2, 311, 308, 1, 1),
  B(3, 215, 244, 2, 2),
  B(4, 215, 244, 1, 2),
];

// 第 11 关 · 36 张:六层横向瀑布,整板逐层向右半错位压叠
const CASCADE = [
  B(0, 143, 244, 2, 3, 72, 74),
  B(1, 179, 244, 2, 3, 72, 74),
  B(2, 215, 244, 2, 3, 72, 74),
  B(3, 251, 244, 2, 3, 72, 74),
  B(4, 287, 244, 2, 3, 72, 74),
  B(5, 323, 244, 2, 3, 72, 74),
];

// 第 12 关 · 27 张:王冠——三座尖塔、两颗宝石、四层冠底
const CROWN = [
  B(0, 107, 196, 1, 1),
  B(1, 112, 190, 1, 1),
  B(2, 117, 184, 1, 1),
  B(0, 323, 196, 1, 1),
  B(1, 318, 190, 1, 1),
  B(2, 313, 184, 1, 1),
  B(0, 215, 172, 1, 1),
  B(1, 220, 166, 1, 1),
  B(2, 225, 160, 1, 1),
  B(3, 215, 166, 1, 1),
  B(0, 171, 236, 1, 1),
  B(0, 259, 236, 1, 1),
  B(0, 215, 308, 5, 1),
  B(1, 215, 289, 4, 1),
  B(2, 215, 308, 3, 1),
  B(3, 215, 289, 2, 1),
  B(4, 215, 299, 1, 1),
];

export const LEVELS: LevelDefinition[] = [
  {
    name: "晨露初甜",
    target: 2,
    cards: [
      { tier: 0, count: 12 },
      { tier: 1, count: 6 },
    ],
    specialRate: 0,
    layout: OPEN_MEADOW,
  },
  {
    name: "莓好时光",
    target: 3,
    cards: [
      { tier: 0, count: 9 },
      { tier: 1, count: 9 },
      { tier: 2, count: 6 },
    ],
    specialRate: 0,
    layout: BRICK_WALL,
  },
  {
    name: "青柠电波",
    target: 4,
    cards: [
      { tier: 0, count: 9 },
      { tier: 1, count: 9 },
      { tier: 2, count: 9 },
      { tier: 3, count: 6 },
    ],
    specialRate: 0.06,
    layout: PYRAMID,
  },
  {
    name: "橙光派对",
    target: 5,
    cards: [
      { tier: 1, count: 9 },
      { tier: 2, count: 9 },
      { tier: 3, count: 9 },
      { tier: 4, count: 6 },
    ],
    specialRate: 0.08,
    layout: TWIN_TOWERS,
  },
  {
    name: "苹果心跳",
    target: 6,
    cards: [
      { tier: 2, count: 12 },
      { tier: 3, count: 9 },
      { tier: 4, count: 9 },
      { tier: 5, count: 6 },
    ],
    specialRate: 0.1,
    layout: DIAMOND,
  },
  {
    name: "蜜桃星云",
    target: 7,
    cards: [
      { tier: 3, count: 12 },
      { tier: 4, count: 9 },
      { tier: 5, count: 9 },
      { tier: 6, count: 6 },
    ],
    specialRate: 0.12,
    layout: RING_WELL,
  },
  {
    name: "热带引力",
    target: 8,
    cards: [
      { tier: 4, count: 12 },
      { tier: 5, count: 9 },
      { tier: 6, count: 9 },
      { tier: 7, count: 6 },
    ],
    specialRate: 0.14,
    layout: GRAND_PYRAMID,
  },
  {
    name: "菠萝脉冲",
    target: 9,
    cards: [
      { tier: 5, count: 12 },
      { tier: 6, count: 9 },
      { tier: 7, count: 9 },
      { tier: 8, count: 6 },
    ],
    specialRate: 0.16,
    layout: HEAVY_BRICKS,
  },
  {
    name: "瓜田月色",
    target: 10,
    cards: [
      { tier: 6, count: 12 },
      { tier: 7, count: 9 },
      { tier: 8, count: 9 },
      { tier: 9, count: 6 },
    ],
    specialRate: 0.18,
    layout: DEEP_TOWERS,
  },
  {
    name: "西瓜音浪",
    target: 11,
    cards: [
      { tier: 7, count: 12 },
      { tier: 8, count: 9 },
      { tier: 9, count: 9 },
      { tier: 10, count: 6 },
    ],
    specialRate: 0.2,
    layout: CROSS_ALTAR,
  },
  {
    name: "王冠前夜",
    target: 12,
    cards: [
      { tier: 8, count: 12 },
      { tier: 9, count: 9 },
      { tier: 10, count: 9 },
      { tier: 11, count: 6 },
    ],
    specialRate: 0.22,
    layout: CASCADE,
  },
  {
    name: "果王降临",
    target: 12,
    cards: [
      { tier: 9, count: 12 },
      { tier: 10, count: 9 },
      { tier: 11, count: 6 },
    ],
    specialRate: 0.25,
    layout: CROWN,
  },
];

// 竖屏分带:HUD 0-96 / 卡区 96-402 / 卡槽 414-480 / 道具 488-532 / 果箱 540-842
export const WORLD = {
  width: 430,
  height: 860,
  stack: { x: 15, y: 96, width: 400, height: 306 },
  tray: { x: 18, y: 414, width: 394, height: 66 },
  box: { x: 17, y: 540, width: 396, height: 302 },
  dangerY: 588,
};
