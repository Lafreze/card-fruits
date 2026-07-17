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

// 19 级合成链:番茄和香蕉加入中段,高阶目标仍以黄金果王收尾。
export const FRUITS: FruitDefinition[] = [
  { name: "蓝莓", emoji: "🫐", radius: 8, color: 0x5c7cfa, glow: 0xa5b4ff },
  { name: "葡萄", emoji: "🍇", radius: 10, color: 0x9b5de5, glow: 0xd8b4fe },
  { name: "樱桃", emoji: "🍒", radius: 12, color: 0xef476f, glow: 0xff9bb1 },
  { name: "草莓", emoji: "🍓", radius: 14, color: 0xff4d6d, glow: 0xffb3c1 },
  { name: "柠檬", emoji: "🍋", radius: 16, color: 0xffd166, glow: 0xffef9f },
  { name: "猕猴桃", emoji: "🥝", radius: 19, color: 0x8ac926, glow: 0xc5f277 },
  { name: "牛油果", emoji: "🥑", radius: 22, color: 0x6f9f3d, glow: 0xc6f68d },
  { name: "番茄", emoji: "🍅", radius: 25, color: 0xf94144, glow: 0xffa3a5 },
  { name: "橙子", emoji: "🍊", radius: 28, color: 0xff9f1c, glow: 0xffc971 },
  { name: "苹果", emoji: "🍎", radius: 31, color: 0xff595e, glow: 0xff9c9f },
  { name: "梨", emoji: "🍐", radius: 34, color: 0xb8d64f, glow: 0xe9f99c },
  { name: "桃子", emoji: "🍑", radius: 37, color: 0xff8fab, glow: 0xffc2d1 },
  { name: "芒果", emoji: "🥭", radius: 40, color: 0xffb703, glow: 0xffd166 },
  { name: "香蕉", emoji: "🍌", radius: 43, color: 0xffd43b, glow: 0xfff19a },
  { name: "椰子", emoji: "🥥", radius: 46, color: 0xa9805b, glow: 0xe6cfb0 },
  { name: "菠萝", emoji: "🍍", radius: 49, color: 0xf7c948, glow: 0xffe69a },
  { name: "哈密瓜", emoji: "🍈", radius: 52, color: 0x90be6d, glow: 0xc7f9b5 },
  { name: "西瓜", emoji: "🍉", radius: 56, color: 0x43aa8b, glow: 0x9bf6cf },
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

// 第 1 关 · 18 张:三层小塔,教学关也从真正的叠层开始
const OPEN_MEADOW = [
  B(0, 215, 242, 3, 3),
  B(1, 215, 242, 3, 2),
  B(2, 215, 242, 3, 1),
];

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

// 第 9 关 · 39 张:深双塔 + 中央四层吊桥 + 顶层三连
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
  B(4, 215, 244, 3, 1),
];

// 第 10 关 · 42 张:十字圣坛 + 四角三叠哨塔 + 中心六层
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
  B(5, 215, 244, 3, 2, 72, 66),
];

// 第 11 关 · 45 张:六层横向瀑布 + 顶层九宫
const CASCADE = [
  B(0, 143, 244, 2, 3, 72, 74),
  B(1, 179, 244, 2, 3, 72, 74),
  B(2, 215, 244, 2, 3, 72, 74),
  B(3, 251, 244, 2, 3, 72, 74),
  B(4, 287, 244, 2, 3, 72, 74),
  B(5, 323, 244, 2, 3, 72, 74),
  B(6, 215, 244, 3, 3, 72, 66),
];

// 第 12 关 · 48 张:王冠——三座尖塔、两颗宝石、四层冠底 + 双层冠心
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
  B(5, 215, 244, 5, 3, 72, 66),
  B(6, 215, 244, 3, 2, 72, 66),
];

// 第 13 关 · 51 张:五层旋涡,高层会在每局随机偏向一侧
const SPIRAL = [
  B(0, 215, 244, 5, 3),
  B(1, 215, 244, 5, 3),
  B(2, 215, 244, 4, 3),
  B(3, 215, 244, 3, 2),
  B(4, 215, 244, 3, 1),
];

// 第 14 关 · 54 张:五层王座,三张塔尖保证开局可点
const FRUIT_THRONE = [
  B(0, 215, 244, 5, 3),
  B(1, 215, 244, 5, 3),
  B(2, 215, 244, 4, 3),
  B(3, 215, 244, 3, 3),
  B(4, 215, 244, 3, 1),
];

// 第 15 关 · 57 张:六层树冠,顶层双排错开
const CANOPY = [
  B(0, 215, 244, 5, 3),
  B(1, 215, 244, 5, 3),
  B(2, 215, 244, 4, 3),
  B(3, 215, 244, 3, 3),
  B(4, 179, 244, 3, 1),
  B(5, 251, 244, 3, 1),
];

// 第 16 关 · 60 张:六层果王宫殿,三张塔尖作为开局入口
const KING_PALACE = [
  B(0, 215, 244, 5, 3),
  B(1, 215, 244, 5, 3),
  B(2, 215, 244, 4, 3),
  B(3, 215, 244, 3, 3),
  B(4, 215, 244, 3, 2),
  B(5, 215, 244, 3, 1),
];

// 每关都从蓝莓开始，并包含从 0 到目标前一级的完整合成阶梯。
// 蓝莓至少提供两颗，其余每级至少一颗；多余卡位继续补蓝莓，确保逐级碰撞必达目标。
function ladderCards(target: number, totalCards: number) {
  const minimum = 3 * (target + 1);
  const extra = totalCards - minimum;
  if (extra < 0 || extra % 3 !== 0)
    throw new Error(`关卡卡位 ${totalCards} 无法构成目标 ${target} 的完整阶梯`);
  const cards = Array.from({ length: target }, (_, tier) => ({
    tier,
    count: tier === 0 ? 6 : 3,
  }));
  // 冗余三消组轮流分配到各级，避免满屏同一种水果；蓝莓仍至少两组，保证阶梯起步。
  for (let group = 0; group < extra / 3; group += 1)
    cards[group % target].count += 3;
  return cards;
}

export const LEVELS: LevelDefinition[] = [
  {
    name: "晨露初甜",
    target: 3,
    cards: ladderCards(3, 18),
    specialRate: 0,
    layout: OPEN_MEADOW,
  },
  {
    name: "青柠电波",
    target: 4,
    cards: ladderCards(4, 24),
    specialRate: 0.04,
    layout: BRICK_WALL,
  },
  {
    name: "奇异风暴",
    target: 5,
    cards: ladderCards(5, 33),
    specialRate: 0.06,
    layout: PYRAMID,
  },
  {
    name: "牛油果湾",
    target: 6,
    cards: ladderCards(6, 33),
    specialRate: 0.08,
    layout: TWIN_TOWERS,
  },
  {
    name: "番茄派对",
    target: 7,
    cards: ladderCards(7, 36),
    specialRate: 0.1,
    layout: DIAMOND,
  },
  {
    name: "橙光派对",
    target: 8,
    cards: ladderCards(8, 36),
    specialRate: 0.12,
    layout: RING_WELL,
  },
  {
    name: "苹果心跳",
    target: 9,
    cards: ladderCards(9, 36),
    specialRate: 0.14,
    layout: GRAND_PYRAMID,
  },
  {
    name: "香梨花园",
    target: 10,
    cards: ladderCards(10, 36),
    specialRate: 0.16,
    layout: HEAVY_BRICKS,
  },
  {
    name: "蜜桃星云",
    target: 11,
    cards: ladderCards(11, 39),
    specialRate: 0.18,
    layout: DEEP_TOWERS,
  },
  {
    name: "热带引力",
    target: 12,
    cards: ladderCards(12, 42),
    specialRate: 0.2,
    layout: CROSS_ALTAR,
  },
  {
    name: "香蕉海岸",
    target: 13,
    cards: ladderCards(13, 45),
    specialRate: 0.22,
    layout: CASCADE,
  },
  {
    name: "椰风海岸",
    target: 14,
    cards: ladderCards(14, 48),
    specialRate: 0.25,
    layout: CROWN,
  },
  {
    name: "菠萝脉冲",
    target: 15,
    cards: ladderCards(15, 51),
    specialRate: 0.27,
    layout: SPIRAL,
  },
  {
    name: "瓜田月色",
    target: 16,
    cards: ladderCards(16, 54),
    specialRate: 0.29,
    layout: FRUIT_THRONE,
  },
  {
    name: "西瓜音浪",
    target: 17,
    cards: ladderCards(17, 57),
    specialRate: 0.31,
    layout: CANOPY,
  },
  {
    name: "果王降临",
    target: 18,
    cards: ladderCards(18, 60),
    specialRate: 0.33,
    layout: KING_PALACE,
  },
];

// 竖屏分带:顶部 0-68 / 卡片区 76-418 / 卡槽 426-490 / 合成区 500-842
export const WORLD = {
  width: 430,
  height: 860,
  stack: { x: 15, y: 76, width: 400, height: 342 },
  tray: { x: 18, y: 426, width: 394, height: 64 },
  box: { x: 17, y: 500, width: 396, height: 342 },
  dangerY: 550,
};
