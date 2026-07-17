export type GameMode = "story" | "endless" | "expedition";

export type RelicId =
  | "mini_orchard"
  | "golden_touch"
  | "deep_tray"
  | "slow_sugar"
  | "tool_belt"
  | "magnet_core"
  | "blast_juice"
  | "lucky_bloom"
  | "honey_glaze"
  | "combo_engine"
  | "crystal_seed"
  | "storm_stir"
  | "frost_ward"
  | "fever_bloom"
  | "gold_rain"
  | "second_wind";

export type RelicDefinition = {
  id: RelicId;
  icon: string;
  name: string;
  description: string;
  tone: "gold" | "pink" | "cyan";
};

export const RELICS: RelicDefinition[] = [
  {
    id: "mini_orchard",
    icon: "🫧",
    name: "迷你果园",
    description: "物理水果缩小 14%，果箱更耐装。",
    tone: "cyan",
  },
  {
    id: "golden_touch",
    icon: "✨",
    name: "黄金触感",
    description: "所有三消与合成得分提高 35%。",
    tone: "gold",
  },
  {
    id: "deep_tray",
    icon: "🧺",
    name: "深口果篮",
    description: "卡槽容量增加 1 格。",
    tone: "pink",
  },
  {
    id: "slow_sugar",
    icon: "⏳",
    name: "慢糖结界",
    description: "警戒线容错时间延长 1.2 秒。",
    tone: "cyan",
  },
  {
    id: "tool_belt",
    icon: "🎒",
    name: "园丁腰包",
    description: "每关额外获得洗牌、锤子、泡泡袋各 1 次。",
    tone: "gold",
  },
  {
    id: "magnet_core",
    icon: "🧲",
    name: "引力果核",
    description: "同级水果吸引速度提高 55%。",
    tone: "pink",
  },
  {
    id: "blast_juice",
    icon: "💥",
    name: "爆浆配方",
    description: "炸弹卡出现率和爆炸范围提高。",
    tone: "gold",
  },
  {
    id: "lucky_bloom",
    icon: "🌸",
    name: "幸运花期",
    description: "每波开局额外生成一颗低阶水果。",
    tone: "pink",
  },
  {
    id: "honey_glaze",
    icon: "🍯",
    name: "蜜糖涂层",
    description: "三消后 18% 概率掉落双份水果。",
    tone: "gold",
  },
  {
    id: "combo_engine",
    icon: "🎇",
    name: "连击引擎",
    description: "连击窗口从 2.3 秒延长到 3.4 秒。",
    tone: "pink",
  },
  {
    id: "crystal_seed",
    icon: "🔮",
    name: "水晶果核",
    description: "开局额外获得万能果、榨汁各 1 次。",
    tone: "cyan",
  },
  {
    id: "storm_stir",
    icon: "🌪️",
    name: "龙卷搅拌",
    description: "戳水果没有冷却，力道加倍。",
    tone: "cyan",
  },
  {
    id: "frost_ward",
    icon: "🌻",
    name: "向阳花田",
    description: "冰冻卡与藤蔓卡出现率减半。",
    tone: "gold",
  },
  {
    id: "fever_bloom",
    icon: "🌡️",
    name: "甜度沸腾",
    description: "狂热能量获取速度提高 40%。",
    tone: "pink",
  },
  {
    id: "gold_rain",
    icon: "🪙",
    name: "果币雨",
    description: "结算果币收益提高 50%。",
    tone: "gold",
  },
  {
    id: "second_wind",
    icon: "💫",
    name: "回魂果露",
    description: "每局一次：卡槽满时自动弹出两张卡。",
    tone: "cyan",
  },
];

export const MODE_INFO: Record<
  GameMode,
  { icon: string; name: string; tagline: string }
> = {
  story: {
    icon: "🗺️",
    name: "闯关模式",
    tagline: "16 关，逐关合成果王",
  },
  endless: {
    icon: "∞",
    name: "无尽模式",
    tagline: "一直玩，冲最高分",
  },
  expedition: {
    icon: "🧭",
    name: "Rogue 模式",
    tagline: "过关选奇物，失败重来",
  },
};

export function pickRelics(owned: RelicId[], count = 3) {
  const pool = RELICS.filter((relic) => !owned.includes(relic.id));
  return [...pool].sort(() => Math.random() - 0.5).slice(0, count);
}

// 变异波次:无尽/远征从第 2 波起每波随机一种,风险换分数
export type WaveMutator = {
  id: string;
  name: string;
  icon: string;
  radius?: number;
  score?: number;
  frozen?: boolean;
  bomb?: boolean;
  magnet?: number;
  danger?: number;
};

export const MUTATORS: WaveMutator[] = [
  { id: "calm", name: "风平浪静", icon: "🍃" },
  { id: "big", name: "大果日", icon: "🎈", radius: 1.15, score: 1.15 },
  { id: "ice", name: "冰河期", icon: "🧊", frozen: true, score: 1.2 },
  { id: "boom", name: "炸弹节", icon: "🎆", bomb: true, score: 1.1 },
  { id: "gold", name: "黄金雨", icon: "✨", score: 1.3 },
  { id: "storm", name: "磁暴", icon: "🧲", magnet: 1.5 },
  { id: "rush", name: "甜度激涌", icon: "⚡", danger: -0.5, score: 1.35 },
];

export function rollMutator(wave: number): WaveMutator {
  if (wave <= 1) return MUTATORS[0];
  return MUTATORS[1 + Math.floor(Math.random() * (MUTATORS.length - 1))];
}

// 果园温室:果币购买的跨局永久成长
export type UpgradeId =
  | "pack"
  | "fever"
  | "danger"
  | "coin"
  | "sun"
  | "magnet"
  | "score"
  | "combo"
  | "sweet_start"
  | "relic_start";

export type UpgradeDefinition = {
  id: UpgradeId;
  icon: string;
  name: string;
  maxLevel: number;
  costs: number[];
  describe: (level: number) => string;
};

export const UPGRADES: UpgradeDefinition[] = [
  {
    id: "pack",
    icon: "🧰",
    name: "道具背包",
    maxLevel: 3,
    costs: [150, 420, 900],
    describe: (level) =>
      [
        "未装备",
        "开局洗牌 +1",
        "开局洗牌、清顶锤 +1",
        "开局洗牌、清顶锤、万能果 +1",
      ][level],
  },
  {
    id: "fever",
    icon: "🍬",
    name: "甜度储备",
    maxLevel: 3,
    costs: [200, 520, 1100],
    describe: (level) =>
      level ? `开局自带 ${[0, 20, 35, 50][level]} 点狂热能量` : "未装备",
  },
  {
    id: "danger",
    icon: "🛡️",
    name: "警戒缓冲",
    maxLevel: 3,
    costs: [180, 480, 1000],
    describe: (level) =>
      level ? `警戒线容错 +${(level * 0.3).toFixed(1)} 秒` : "未装备",
  },
  {
    id: "magnet",
    icon: "🧲",
    name: "磁力温床",
    maxLevel: 3,
    costs: [220, 560, 1200],
    describe: (level) =>
      level ? `同级水果磁吸永久 +${level * 12}%` : "未装备",
  },
  {
    id: "score",
    icon: "💎",
    name: "分数水晶",
    maxLevel: 3,
    costs: [280, 700, 1500],
    describe: (level) => (level ? `全部得分永久 +${level * 6}%` : "未装备"),
  },
  {
    id: "combo",
    icon: "🎀",
    name: "连击丝带",
    maxLevel: 3,
    costs: [240, 600, 1250],
    describe: (level) =>
      level ? `连击窗口 +${(level * 0.2).toFixed(1)} 秒` : "未装备",
  },
  {
    id: "sweet_start",
    icon: "🍯",
    name: "甜蜜开局",
    maxLevel: 3,
    costs: [300, 750, 1600],
    describe: (level) =>
      level ? `每关开局自动掉落 ${level} 颗低阶水果` : "未装备",
  },
  {
    id: "coin",
    icon: "💰",
    name: "果币磁铁",
    maxLevel: 3,
    costs: [260, 640, 1350],
    describe: (level) => (level ? `结算果币 +${level * 20}%` : "未装备"),
  },
  {
    id: "sun",
    icon: "☀️",
    name: "暖棚日光",
    maxLevel: 2,
    costs: [320, 800],
    describe: (level) => (level ? `开局阳光净化 +${level}` : "未装备"),
  },
  {
    id: "relic_start",
    icon: "🎁",
    name: "远征福袋",
    maxLevel: 1,
    costs: [1400],
    describe: (level) => (level ? "远征开局自带 1 件随机奇物" : "未装备"),
  },
];
