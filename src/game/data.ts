export type FruitDefinition = {
  name: string;
  emoji: string;
  icon?: string;
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

// 50 级合成链:高等级水果保持接近尺寸，黄金果王仍为最终终点。
export const FRUITS: FruitDefinition[] = [
  { name: "蓝莓", emoji: "🫐", radius: 8, color: 0x5c7cfa, glow: 0xa5b4ff },
  { name: "橄榄", emoji: "🫒", radius: 9, color: 0x718c3a, glow: 0xc7df85 },
  { name: "葡萄", emoji: "🍇", radius: 10, color: 0x9b5de5, glow: 0xd8b4fe },
  { name: "樱桃", emoji: "🍒", radius: 11.5, color: 0xef476f, glow: 0xff9bb1 },
  { name: "草莓", emoji: "🍓", radius: 13, color: 0xff4d6d, glow: 0xffb3c1 },
  { name: "柠檬", emoji: "🍋", radius: 14.5, color: 0xffd166, glow: 0xffef9f },
  { name: "猕猴桃", emoji: "🥝", radius: 16, color: 0x8ac926, glow: 0xc5f277 },
  { name: "番茄", emoji: "🍅", radius: 17.5, color: 0xf94144, glow: 0xffa3a5 },
  {
    name: "牛油果",
    emoji: "🥑",
    radius: 19,
    color: 0x6f9f3d,
    glow: 0xc6f68d,
  },
  { name: "橙子", emoji: "🍊", radius: 20.5, color: 0xff9f1c, glow: 0xffc971 },
  {
    name: "青苹果",
    emoji: "🍏",
    radius: 22,
    color: 0x78b83f,
    glow: 0xcaf28c,
  },
  { name: "苹果", emoji: "🍎", radius: 23.5, color: 0xff595e, glow: 0xff9c9f },
  { name: "梨", emoji: "🍐", radius: 25, color: 0xb8d64f, glow: 0xe9f99c },
  { name: "桃子", emoji: "🍑", radius: 26.5, color: 0xff8fab, glow: 0xffc2d1 },
  { name: "芒果", emoji: "🥭", radius: 28, color: 0xffb703, glow: 0xffd166 },
  {
    name: "香蕉",
    emoji: "",
    icon: "/fruits/banana-bunch.webp",
    radius: 29.5,
    color: 0xffd43b,
    glow: 0xfff19a,
  },
  { name: "椰子", emoji: "🥥", radius: 31, color: 0xa9805b, glow: 0xe6cfb0 },
  { name: "菠萝", emoji: "🍍", radius: 32.5, color: 0xf7c948, glow: 0xffe69a },
  {
    name: "火龙果",
    emoji: "",
    icon: "/fruits/dragon-fruit.webp",
    radius: 34,
    color: 0xe62b76,
    glow: 0xff8fbc,
  },
  { name: "哈密瓜", emoji: "🍈", radius: 35.5, color: 0x90be6d, glow: 0xc7f9b5 },
  { name: "南瓜", emoji: "🎃", radius: 37, color: 0xe97924, glow: 0xffb56f },
  {
    name: "西瓜",
    emoji: "",
    icon: "/fruits/watermelon-whole.webp",
    radius: 39,
    color: 0x43aa8b,
    glow: 0x9bf6cf,
  },
  {
    name: "石榴",
    emoji: "",
    icon: "/fruits/pomegranate.webp",
    radius: 39.5,
    color: 0xc9184a,
    glow: 0xff8fab,
  },
  {
    name: "木瓜",
    emoji: "",
    icon: "/fruits/papaya.webp",
    radius: 40,
    color: 0xf8961e,
    glow: 0xffcf70,
  },
  {
    name: "菠萝蜜",
    emoji: "",
    icon: "/fruits/jackfruit.webp",
    radius: 40.5,
    color: 0xaacc32,
    glow: 0xe4f58b,
  },
  {
    name: "山竹",
    emoji: "",
    icon: "/fruits/mangosteen.webp",
    radius: 40.625,
    color: 0x6d214f,
    glow: 0xd59bd8,
  },
  {
    name: "杨桃",
    emoji: "",
    icon: "/fruits/starfruit.webp",
    radius: 40.75,
    color: 0xf6bd28,
    glow: 0xffe88a,
  },
  {
    name: "柚子",
    emoji: "",
    icon: "/fruits/pomelo.webp",
    radius: 40.875,
    color: 0xc7d85b,
    glow: 0xf2f5a4,
  },
  {
    name: "无花果",
    emoji: "",
    icon: "/fruits/fig.webp",
    radius: 40.88,
    color: 0x7b2f72,
    glow: 0xe4a5d8,
  },
  {
    name: "莲雾",
    emoji: "",
    icon: "/fruits/wax-apple.webp",
    radius: 40.885,
    color: 0xe53935,
    glow: 0xff9b97,
  },
  {
    name: "荔枝",
    emoji: "",
    icon: "/fruits/lychee.webp",
    radius: 40.89,
    color: 0xeb5b67,
    glow: 0xffb1b8,
  },
  {
    name: "番石榴",
    emoji: "",
    icon: "/fruits/guava.webp",
    radius: 40.895,
    color: 0xa6cf3c,
    glow: 0xe1f58a,
  },
  {
    name: "枇杷",
    emoji: "",
    icon: "/fruits/loquat.webp",
    radius: 40.9,
    color: 0xf5a623,
    glow: 0xffd37a,
  },
  {
    name: "释迦",
    emoji: "",
    icon: "/fruits/sugar-apple.webp",
    radius: 40.905,
    color: 0xa8c86c,
    glow: 0xe3f2b5,
  },
  {
    name: "蛇皮果",
    emoji: "",
    icon: "/fruits/salak.webp",
    radius: 40.91,
    color: 0xa94d28,
    glow: 0xe89a72,
  },
  {
    name: "面包果",
    emoji: "",
    icon: "/fruits/breadfruit.webp",
    radius: 40.915,
    color: 0x84a83f,
    glow: 0xcfe88d,
  },
  {
    name: "可可果",
    emoji: "",
    icon: "/fruits/cacao-pod.webp",
    radius: 40.92,
    color: 0xe76128,
    glow: 0xffac75,
  },
  {
    name: "酸角",
    emoji: "",
    icon: "/fruits/tamarind.webp",
    radius: 40.925,
    color: 0xb86f32,
    glow: 0xe7b482,
  },
  {
    name: "柿子",
    emoji: "",
    icon: "/fruits/persimmon.webp",
    radius: 40.931,
    color: 0xf47b20,
    glow: 0xffbd78,
  },
  {
    name: "李子",
    emoji: "",
    icon: "/fruits/plum.webp",
    radius: 40.937,
    color: 0x6f3aa8,
    glow: 0xc0a0ef,
  },
  {
    name: "金桔",
    emoji: "",
    icon: "/fruits/kumquat.webp",
    radius: 40.943,
    color: 0xf6a10a,
    glow: 0xffd36c,
  },
  {
    name: "百香果",
    emoji: "",
    icon: "/fruits/passion-fruit.webp",
    radius: 40.949,
    color: 0x8b2f62,
    glow: 0xd895bc,
  },
  {
    name: "龙眼",
    emoji: "",
    icon: "/fruits/longan.webp",
    radius: 40.955,
    color: 0xc79142,
    glow: 0xefd09a,
  },
  {
    name: "杨梅",
    emoji: "",
    icon: "/fruits/yangmei.webp",
    radius: 40.961,
    color: 0xb8183f,
    glow: 0xf47a96,
  },
  {
    name: "人参果",
    emoji: "",
    icon: "/fruits/pepino-melon.webp",
    radius: 40.967,
    color: 0xe8c766,
    glow: 0xf9e6a0,
  },
  {
    name: "蛋黄果",
    emoji: "",
    icon: "/fruits/canistel.webp",
    radius: 40.973,
    color: 0xe9a814,
    glow: 0xffdb73,
  },
  {
    name: "刺角瓜",
    emoji: "",
    icon: "/fruits/kiwano.webp",
    radius: 40.979,
    color: 0xf27a15,
    glow: 0xffb762,
  },
  {
    name: "佛手柑",
    emoji: "",
    icon: "/fruits/buddhas-hand.webp",
    radius: 40.985,
    color: 0xe8c414,
    glow: 0xffed79,
  },
  {
    name: "仙人掌果",
    emoji: "",
    icon: "/fruits/prickly-pear.webp",
    radius: 40.991,
    color: 0xd82768,
    glow: 0xff8fb3,
  },
  {
    name: "黄金果王",
    emoji: "",
    icon: "/fruits/durian-king.webp",
    radius: 41,
    color: 0xc9a21f,
    glow: 0xffdc67,
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

// 第 16 关 · 60 张:六层龙果宫殿,三张塔尖作为开局入口
const KING_PALACE = [
  B(0, 215, 244, 5, 3),
  B(1, 215, 244, 5, 3),
  B(2, 215, 244, 4, 3),
  B(3, 215, 244, 3, 3),
  B(4, 215, 244, 3, 2),
  B(5, 215, 244, 3, 1),
];

// 第 17 关 · 63 张:七层月庭,双塔尖制造不对称入口
const MOON_GARDEN = [
  B(0, 215, 244, 5, 3),
  B(1, 215, 244, 5, 3),
  B(2, 215, 244, 4, 3),
  B(3, 215, 244, 3, 3),
  B(4, 215, 244, 3, 2),
  B(5, 179, 244, 3, 1),
  B(6, 251, 244, 3, 1),
];

// 第 18 关 · 66 张:南瓜地窖,厚实双层核心 + 顶部三连
const PUMPKIN_VAULT = [
  B(0, 215, 244, 5, 3),
  B(1, 215, 244, 5, 3),
  B(2, 215, 244, 4, 3),
  B(3, 215, 244, 3, 3),
  B(4, 179, 244, 3, 2),
  B(5, 251, 244, 3, 2),
  B(6, 215, 244, 3, 1),
];

// 第 19 关 · 69 张:西瓜星环,三层宽底托起四层果核
const WATERMELON_ORBIT = [
  B(0, 215, 244, 5, 3),
  B(1, 215, 244, 5, 3),
  B(2, 215, 244, 5, 3),
  B(3, 215, 244, 3, 3),
  B(4, 179, 244, 3, 2),
  B(5, 251, 244, 3, 2),
  B(6, 215, 244, 3, 1),
];

// 第 20 关 · 72 张:七层黄金圣殿,最终三张王冠牌守住顶层
const GOLDEN_SANCTUM = [
  B(0, 215, 244, 5, 3),
  B(1, 215, 244, 5, 3),
  B(2, 215, 244, 5, 3),
  B(3, 215, 244, 4, 3),
  B(4, 215, 244, 3, 3),
  B(5, 179, 244, 3, 1),
  B(6, 251, 244, 3, 1),
];

// 后期关卡改为三张一层的高塔：层内始终有足够间距，跨层遮挡则形成
// 稳定、清晰的逐层揭牌节奏。层心上下错开，避免视觉上像一摞死板直线。
function crownTower(rows: number) {
  return Array.from({ length: rows }, (_, layer) =>
    B(layer, 215, 206 + (layer % 3) * 38, 3, 1),
  );
}

const PAPAYA_TERRACE = crownTower(25);
const JACKFRUIT_GROVE = crownTower(26);
const MANGOSTEEN_CROWN = crownTower(27);
const STARFRUIT_SKYWAY = crownTower(28);
const POMELO_HORIZON = crownTower(29);
const FIG_COURT = crownTower(30);
const WAX_APPLE_RAINFOREST = crownTower(31);
const LYCHEE_LIGHTS = crownTower(32);
const GUAVA_OASIS = crownTower(33);
const LOQUAT_VALLEY = crownTower(34);
const SUGAR_APPLE_CASTLE = crownTower(35);
const SALAK_DUNES = crownTower(36);
const BREADFRUIT_ISLAND = crownTower(37);
const CACAO_REALM = crownTower(38);
const TAMARIND_BRIDGE = crownTower(39);
const PERSIMMON_COURT = crownTower(40);
const PLUM_NIGHT = crownTower(41);
const KUMQUAT_LIGHTS = crownTower(42);
const PASSION_MAZE = crownTower(43);
const LONGAN_MOON = crownTower(44);
const YANGMEI_CROWN = crownTower(45);
const PEPINO_GARDEN = crownTower(46);
const CANISTEL_VAULT = crownTower(47);
const KIWANO_FORT = crownTower(48);
const BUDDHAS_HAND_TEMPLE = crownTower(49);
const PRICKLY_PEAR_MIRAGE = crownTower(50);
const KING_ASCENSION = crownTower(51);

// 把一颗目标果递归拆成与卡位数量相同的果实组，保持总合成质量严格守恒。
// 因此普通关卡不会再靠几组高阶牌提前结束，玩家需要处理绝大多数牌才能达成目标。
function ladderCards(target: number, totalCards: number) {
  const groupCount = totalCards / 3;
  if (!Number.isInteger(groupCount) || groupCount < 2 || groupCount > 2 ** target)
    throw new Error(`关卡卡位 ${totalCards} 无法拆分成目标 ${target}`);
  const groups = [target - 1, target - 1];
  while (groups.length < groupCount) {
    const splittable = groups
      .map((tier, index) => ({ tier, index }))
      .filter(({ tier }) => tier > 0)
      .sort((a, b) => a.tier - b.tier || a.index - b.index)[0];
    if (!splittable) throw new Error(`目标 ${target} 无法继续拆分`);
    groups.splice(splittable.index, 1, splittable.tier - 1, splittable.tier - 1);
  }
  const counts = new Map<number, number>();
  groups.forEach((tier) => counts.set(tier, (counts.get(tier) || 0) + 3));
  return [...counts.entries()]
    .sort(([first], [second]) => first - second)
    .map(([tier, count]) => ({ tier, count }));
}

export const LEVELS: LevelDefinition[] = [
  {
    name: "樱桃晨露",
    target: 3,
    cards: ladderCards(3, 18),
    specialRate: 0,
    layout: OPEN_MEADOW,
  },
  {
    name: "草莓电波",
    target: 4,
    cards: ladderCards(4, 24),
    specialRate: 0.04,
    layout: BRICK_WALL,
  },
  {
    name: "青柠风暴",
    target: 5,
    cards: ladderCards(5, 33),
    specialRate: 0.06,
    layout: PYRAMID,
  },
  {
    name: "奇异果湾",
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
    name: "牛油果湾",
    target: 8,
    cards: ladderCards(8, 36),
    specialRate: 0.12,
    layout: RING_WELL,
  },
  {
    name: "橙光派对",
    target: 9,
    cards: ladderCards(9, 36),
    specialRate: 0.14,
    layout: GRAND_PYRAMID,
  },
  {
    name: "青苹果园",
    target: 10,
    cards: ladderCards(10, 36),
    specialRate: 0.16,
    layout: HEAVY_BRICKS,
  },
  {
    name: "苹果心跳",
    target: 11,
    cards: ladderCards(11, 39),
    specialRate: 0.18,
    layout: DEEP_TOWERS,
  },
  {
    name: "香梨花园",
    target: 12,
    cards: ladderCards(12, 42),
    specialRate: 0.2,
    layout: CROSS_ALTAR,
  },
  {
    name: "蜜桃星云",
    target: 13,
    cards: ladderCards(13, 45),
    specialRate: 0.22,
    layout: CASCADE,
  },
  {
    name: "芒果引力",
    target: 14,
    cards: ladderCards(14, 48),
    specialRate: 0.25,
    layout: CROWN,
  },
  {
    name: "香蕉海岸",
    target: 15,
    cards: ladderCards(15, 51),
    specialRate: 0.27,
    layout: SPIRAL,
  },
  {
    name: "椰风海岸",
    target: 16,
    cards: ladderCards(16, 54),
    specialRate: 0.29,
    layout: FRUIT_THRONE,
  },
  {
    name: "菠萝脉冲",
    target: 17,
    cards: ladderCards(17, 57),
    specialRate: 0.31,
    layout: CANOPY,
  },
  {
    name: "龙果霓虹",
    target: 18,
    cards: ladderCards(18, 60),
    specialRate: 0.33,
    layout: KING_PALACE,
  },
  {
    name: "瓜田月色",
    target: 19,
    cards: ladderCards(19, 63),
    specialRate: 0.35,
    layout: MOON_GARDEN,
  },
  {
    name: "南瓜秘境",
    target: 20,
    cards: ladderCards(20, 66),
    specialRate: 0.37,
    layout: PUMPKIN_VAULT,
  },
  {
    name: "西瓜星环",
    target: 21,
    cards: ladderCards(21, 69),
    specialRate: 0.39,
    layout: WATERMELON_ORBIT,
  },
  {
    name: "石榴星冠",
    target: 22,
    cards: ladderCards(22, 72),
    specialRate: 0.41,
    layout: GOLDEN_SANCTUM,
  },
  {
    name: "木瓜晚霞",
    target: 23,
    cards: ladderCards(23, 75),
    specialRate: 0.42,
    layout: PAPAYA_TERRACE,
  },
  {
    name: "菠萝蜜巨树",
    target: 24,
    cards: ladderCards(24, 78),
    specialRate: 0.43,
    layout: JACKFRUIT_GROVE,
  },
  {
    name: "山竹月冕",
    target: 25,
    cards: ladderCards(25, 81),
    specialRate: 0.45,
    layout: MANGOSTEEN_CROWN,
  },
  {
    name: "杨桃天路",
    target: 26,
    cards: ladderCards(26, 84),
    specialRate: 0.46,
    layout: STARFRUIT_SKYWAY,
  },
  {
    name: "柚香天际",
    target: 27,
    cards: ladderCards(27, 87),
    specialRate: 0.47,
    layout: POMELO_HORIZON,
  },
  {
    name: "无花果秘庭",
    target: 28,
    cards: ladderCards(28, 90),
    specialRate: 0.48,
    layout: FIG_COURT,
  },
  {
    name: "莲雾雨林",
    target: 29,
    cards: ladderCards(29, 93),
    specialRate: 0.49,
    layout: WAX_APPLE_RAINFOREST,
  },
  {
    name: "荔枝灯海",
    target: 30,
    cards: ladderCards(30, 96),
    specialRate: 0.5,
    layout: LYCHEE_LIGHTS,
  },
  {
    name: "番石榴绿洲",
    target: 31,
    cards: ladderCards(31, 99),
    specialRate: 0.51,
    layout: GUAVA_OASIS,
  },
  {
    name: "枇杷金谷",
    target: 32,
    cards: ladderCards(32, 102),
    specialRate: 0.52,
    layout: LOQUAT_VALLEY,
  },
  {
    name: "释迦星堡",
    target: 33,
    cards: ladderCards(33, 105),
    specialRate: 0.53,
    layout: SUGAR_APPLE_CASTLE,
  },
  {
    name: "蛇皮果沙丘",
    target: 34,
    cards: ladderCards(34, 108),
    specialRate: 0.54,
    layout: SALAK_DUNES,
  },
  {
    name: "面包果巨岛",
    target: 35,
    cards: ladderCards(35, 111),
    specialRate: 0.55,
    layout: BREADFRUIT_ISLAND,
  },
  {
    name: "可可秘境",
    target: 36,
    cards: ladderCards(36, 114),
    specialRate: 0.56,
    layout: CACAO_REALM,
  },
  {
    name: "酸角长桥",
    target: 37,
    cards: ladderCards(37, 117),
    specialRate: 0.57,
    layout: TAMARIND_BRIDGE,
  },
  {
    name: "柿子丹庭",
    target: 38,
    cards: ladderCards(38, 120),
    specialRate: 0.58,
    layout: PERSIMMON_COURT,
  },
  {
    name: "李子夜湾",
    target: 39,
    cards: ladderCards(39, 123),
    specialRate: 0.58,
    layout: PLUM_NIGHT,
  },
  {
    name: "金桔灯塔",
    target: 40,
    cards: ladderCards(40, 126),
    specialRate: 0.59,
    layout: KUMQUAT_LIGHTS,
  },
  {
    name: "百香迷宫",
    target: 41,
    cards: ladderCards(41, 129),
    specialRate: 0.59,
    layout: PASSION_MAZE,
  },
  {
    name: "龙眼月轮",
    target: 42,
    cards: ladderCards(42, 132),
    specialRate: 0.6,
    layout: LONGAN_MOON,
  },
  {
    name: "杨梅星冠",
    target: 43,
    cards: ladderCards(43, 135),
    specialRate: 0.6,
    layout: YANGMEI_CROWN,
  },
  {
    name: "人参果园",
    target: 44,
    cards: ladderCards(44, 138),
    specialRate: 0.61,
    layout: PEPINO_GARDEN,
  },
  {
    name: "蛋黄宝库",
    target: 45,
    cards: ladderCards(45, 141),
    specialRate: 0.61,
    layout: CANISTEL_VAULT,
  },
  {
    name: "刺角要塞",
    target: 46,
    cards: ladderCards(46, 144),
    specialRate: 0.62,
    layout: KIWANO_FORT,
  },
  {
    name: "佛手金殿",
    target: 47,
    cards: ladderCards(47, 147),
    specialRate: 0.62,
    layout: BUDDHAS_HAND_TEMPLE,
  },
  {
    name: "仙果蜃景",
    target: 48,
    cards: ladderCards(48, 150),
    specialRate: 0.63,
    layout: PRICKLY_PEAR_MIRAGE,
  },
  {
    name: "果王圣殿",
    target: 49,
    cards: ladderCards(49, 153),
    specialRate: 0.64,
    layout: KING_ASCENSION,
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
