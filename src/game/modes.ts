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
  | "second_wind"
  | "harvest_gene"
  | "launch_coil"
  | "gravity_feather"
  | "shock_core"
  | "wild_graft"
  | "sugar_shell"
  | "rainbow_sprout"
  | "tool_carousel"
  | "confetti_core"
  | "fruit_fountain"
  | "lucky_dice"
  | "royal_echo"
  | "pinball_peel"
  | "bubble_party"
  | "orchard_basket"
  | "sugar_kettle"
  | "triple_crown"
  | "meteor_garden"
  | "choice_branch"
  | "fruit_pinata";

export type RelicDefinition = {
  id: RelicId;
  icon: string;
  name: string;
  description: string;
  tone: "gold" | "pink" | "cyan";
  rarity: "common" | "uncommon" | "rare";
  archetype: string;
};

export const RELICS: RelicDefinition[] = [
  {
    id: "mini_orchard",
    icon: "🫧",
    name: "迷你果园",
    description: "物理水果缩小 14%，果箱更耐装。",
    tone: "cyan",
    rarity: "common",
    archetype: "果箱",
  },
  {
    id: "golden_touch",
    icon: "✨",
    name: "黄金触感",
    description: "所有三消与合成得分提高 35%。",
    tone: "gold",
    rarity: "rare",
    archetype: "得分",
  },
  {
    id: "deep_tray",
    icon: "🧺",
    name: "深口果篮",
    description: "卡槽容量增加 1 格。",
    tone: "pink",
    rarity: "uncommon",
    archetype: "卡槽",
  },
  {
    id: "slow_sugar",
    icon: "⏳",
    name: "慢糖结界",
    description: "警戒线容错时间延长 1.2 秒。",
    tone: "cyan",
    rarity: "common",
    archetype: "生存",
  },
  {
    id: "tool_belt",
    icon: "🎒",
    name: "园丁腰包",
    description: "已配置的洗牌、锤子、泡泡袋、分果每局各 +1 次。",
    tone: "gold",
    rarity: "uncommon",
    archetype: "道具",
  },
  {
    id: "magnet_core",
    icon: "🧲",
    name: "引力果核",
    description: "同级水果吸引速度提高 55%。",
    tone: "pink",
    rarity: "uncommon",
    archetype: "合成",
  },
  {
    id: "blast_juice",
    icon: "💥",
    name: "爆浆配方",
    description: "炸弹卡出现率和爆炸范围提高。",
    tone: "gold",
    rarity: "uncommon",
    archetype: "爆发",
  },
  {
    id: "lucky_bloom",
    icon: "🌸",
    name: "幸运花期",
    description: "每波开局额外生成一颗低阶水果。",
    tone: "pink",
    rarity: "common",
    archetype: "开局",
  },
  {
    id: "honey_glaze",
    icon: "🍯",
    name: "蜜糖涂层",
    description: "每次三消额外获得 6 点狂热能量。",
    tone: "gold",
    rarity: "rare",
    archetype: "狂热",
  },
  {
    id: "combo_engine",
    icon: "🎇",
    name: "连击引擎",
    description: "连击窗口从 2.3 秒延长到 3.4 秒。",
    tone: "pink",
    rarity: "uncommon",
    archetype: "连击",
  },
  {
    id: "crystal_seed",
    icon: "🔮",
    name: "水晶果核",
    description: "已配置的万能果、榨汁、催熟每局各 +1 次。",
    tone: "cyan",
    rarity: "rare",
    archetype: "资源",
  },
  {
    id: "storm_stir",
    icon: "💍",
    name: "共鸣指环",
    description: "弹射无冷却，落地冲击范围提高 25%。",
    tone: "cyan",
    rarity: "common",
    archetype: "操控",
  },
  {
    id: "frost_ward",
    icon: "🌻",
    name: "向阳花田",
    description: "冰冻卡与藤蔓卡出现率减半。",
    tone: "gold",
    rarity: "common",
    archetype: "净化",
  },
  {
    id: "fever_bloom",
    icon: "🌡️",
    name: "甜度沸腾",
    description: "狂热能量获取速度提高 40%。",
    tone: "pink",
    rarity: "uncommon",
    archetype: "狂热",
  },
  {
    id: "gold_rain",
    icon: "🪙",
    name: "果币雨",
    description: "结算果币收益提高 25%。",
    tone: "gold",
    rarity: "common",
    archetype: "收益",
  },
  {
    id: "second_wind",
    icon: "💫",
    name: "回魂果露",
    description: "每局一次：卡槽满时自动弹出两张卡。",
    tone: "cyan",
    rarity: "rare",
    archetype: "救场",
  },
  {
    id: "harvest_gene",
    icon: "🧬",
    name: "丰收基因",
    description: "每次三消额外生成 1 颗水果，满产时转为狂热能量。",
    tone: "gold",
    rarity: "rare",
    archetype: "属性·产量",
  },
  {
    id: "launch_coil",
    icon: "🌀",
    name: "回弹线圈",
    description: "点击水果的弹射强度提高 45%。",
    tone: "cyan",
    rarity: "uncommon",
    archetype: "属性·操控",
  },
  {
    id: "gravity_feather",
    icon: "🪶",
    name: "低重力羽",
    description: "果箱重力降低 14%，更容易调整堆叠。",
    tone: "cyan",
    rarity: "common",
    archetype: "属性·物理",
  },
  {
    id: "shock_core",
    icon: "⚙️",
    name: "冲击果核",
    description: "落果冲击与同果牵引等级 +1。",
    tone: "pink",
    rarity: "uncommon",
    archetype: "属性·合成",
  },
  {
    id: "wild_graft",
    icon: "💠",
    name: "异色嫁接",
    description: "功能牌出现率提高 10%，增益牌更常见。",
    tone: "pink",
    rarity: "uncommon",
    archetype: "属性·牌组",
  },
  {
    id: "sugar_shell",
    icon: "🛡️",
    name: "糖壳强化",
    description: "警戒容错再延长 0.8 秒。",
    tone: "gold",
    rarity: "common",
    archetype: "属性·生存",
  },
  {
    id: "rainbow_sprout",
    icon: "🌈",
    name: "彩虹萌芽",
    description: "每关前 2 次三消，落下的水果直接提高 1 阶。",
    tone: "pink",
    rarity: "rare",
    archetype: "花式·跃迁",
  },
  {
    id: "tool_carousel",
    icon: "🎠",
    name: "道具旋转木马",
    description: "每完成 4 次三消，轮流补充一种基础道具。",
    tone: "gold",
    rarity: "uncommon",
    archetype: "花式·道具",
  },
  {
    id: "confetti_core",
    icon: "🎊",
    name: "彩纸果核",
    description: "每 3 次物理合成触发庆典，甜度 +12 并喷出彩纸。",
    tone: "pink",
    rarity: "common",
    archetype: "娱乐·庆典",
  },
  {
    id: "fruit_fountain",
    icon: "⛲",
    name: "水果喷泉",
    description: "每 4 次三消额外喷出一颗低 1 阶水果。",
    tone: "cyan",
    rarity: "uncommon",
    archetype: "娱乐·产量",
  },
  {
    id: "lucky_dice",
    icon: "🎲",
    name: "幸运果骰",
    description: "每关开局摇出甜度、分数、道具或稀有果种奖励。",
    tone: "gold",
    rarity: "common",
    archetype: "娱乐·随机",
  },
  {
    id: "royal_echo",
    icon: "👑",
    name: "王冠回声",
    description: "每关第一次物理合成会返还一颗合成前水果。",
    tone: "gold",
    rarity: "rare",
    archetype: "花式·复制",
  },
  {
    id: "pinball_peel",
    icon: "🪩",
    name: "弹珠果皮",
    description: "手动弹射更强，并随机向左右偏转，适合花式救球。",
    tone: "cyan",
    rarity: "common",
    archetype: "娱乐·弹射",
  },
  {
    id: "bubble_party",
    icon: "🫧",
    name: "泡泡派对",
    description: "每点击 6 张牌，自动收起卡槽里最孤立的一张。",
    tone: "pink",
    rarity: "uncommon",
    archetype: "花式·卡槽",
  },
  {
    id: "orchard_basket",
    icon: "🧺",
    name: "穿层采摘篮",
    description: "每关获得 1 次采摘篮，直接采收牌堆中的一组三张同果卡。",
    tone: "gold",
    rarity: "rare",
    archetype: "花式·牌组",
  },
  {
    id: "sugar_kettle",
    icon: "🍯",
    name: "狂热糖锅",
    description: "每关获得 1 份甜度糖浆，可快速充能或延长狂热。",
    tone: "pink",
    rarity: "uncommon",
    archetype: "娱乐·狂热",
  },
  {
    id: "triple_crown",
    icon: "👑",
    name: "三消王冠",
    description: "每第 5 次三消，落下的主水果直接提高 1 阶。",
    tone: "gold",
    rarity: "rare",
    archetype: "花式·跃迁",
  },
  {
    id: "meteor_garden",
    icon: "☄️",
    name: "流星果园",
    description: "每第 4 次物理合成触发弹射风暴，并获得 10 点甜度。",
    tone: "cyan",
    rarity: "uncommon",
    archetype: "娱乐·物理",
  },
  {
    id: "choice_branch",
    icon: "🌳",
    name: "选择枝杈",
    description: "之后每次过关的奇物选择从三选一增加为四选一。",
    tone: "cyan",
    rarity: "rare",
    archetype: "构筑·选择",
  },
  {
    id: "fruit_pinata",
    icon: "🪅",
    name: "水果彩罐",
    description: "每点击 10 张卡触发彩罐，获得分数、甜度与彩纸庆典。",
    tone: "pink",
    rarity: "common",
    archetype: "娱乐·庆典",
  },
];

export const MODE_INFO: Record<
  GameMode,
  { icon: string; name: string; tagline: string }
> = {
  story: {
    icon: "🗺️",
    name: "闯关模式",
    tagline: "26 关，逐关合成果王",
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

export function pickRelics(
  owned: RelicId[],
  count = 3,
  wave = 1,
  random: () => number = Math.random,
) {
  const pool = RELICS.filter((relic) => !owned.includes(relic.id));
  const choices: RelicDefinition[] = [];
  const draw = (candidates: RelicDefinition[]) => {
    const available = candidates.filter(
      (candidate) => !choices.some((choice) => choice.id === candidate.id),
    );
    if (available.length === 0) return;
    const weights = available.map((relic) =>
      relic.rarity === "common"
        ? 5
        : relic.rarity === "uncommon"
          ? 3.2
          : 1.1 + wave * 0.18,
    );
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let roll = random() * total;
    const index = weights.findIndex((weight) => (roll -= weight) <= 0);
    choices.push(available[Math.max(0, index)]);
  };
  // 每三关至少出现一件稀有奇物，形成可预期的构筑强度节点。
  if (wave > 1 && wave % 3 === 0)
    draw(pool.filter((relic) => relic.rarity === "rare"));
  while (choices.length < Math.min(count, pool.length)) draw(pool);
  return choices;
}

// 变异波次:无尽/远征从第 2 波起每波随机一种,风险换分数
export type WaveMutator = {
  id: string;
  name: string;
  icon: string;
  description: string;
  radius?: number;
  score?: number;
  frozen?: boolean;
  bomb?: boolean;
  magnet?: number;
  danger?: number;
};

export const MUTATORS: WaveMutator[] = [
  { id: "calm", name: "风平浪静", icon: "🍃", description: "无额外规则" },
  {
    id: "big",
    name: "大果日",
    icon: "🎈",
    description: "水果体积 +15% · 得分 +15%",
    radius: 1.15,
    score: 1.15,
  },
  {
    id: "ice",
    name: "冰河期",
    icon: "🧊",
    description: "冰冻牌增多 · 得分 +20%",
    frozen: true,
    score: 1.2,
  },
  {
    id: "boom",
    name: "炸弹节",
    icon: "🎆",
    description: "炸弹牌增多 · 得分 +10%",
    bomb: true,
    score: 1.1,
  },
  {
    id: "gold",
    name: "黄金雨",
    icon: "✨",
    description: "无额外风险 · 得分 +30%",
    score: 1.3,
  },
  {
    id: "storm",
    name: "磁暴",
    icon: "🧲",
    description: "同级磁吸 +50%",
    magnet: 1.5,
  },
  {
    id: "rush",
    name: "甜度激涌",
    icon: "⚡",
    description: "警戒时间 -0.5 秒 · 得分 +35%",
    danger: -0.5,
    score: 1.35,
  },
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
  | "seed_start"
  | "tray"
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
    name: "补给工坊",
    maxLevel: 3,
    costs: [480, 1400, 3200],
    describe: (level) => (level ? `购买道具价格 -${level * 6}%` : "未装备"),
  },
  {
    id: "fever",
    icon: "🍬",
    name: "甜度储备",
    maxLevel: 3,
    costs: [520, 1500, 3400],
    describe: (level) =>
      level ? `开局自带 ${[0, 20, 35, 50][level]} 点狂热能量` : "未装备",
  },
  {
    id: "danger",
    icon: "🛡️",
    name: "警戒缓冲",
    maxLevel: 3,
    costs: [460, 1320, 3000],
    describe: (level) =>
      level ? `警戒线容错 +${(level * 0.3).toFixed(1)} 秒` : "未装备",
  },
  {
    id: "magnet",
    icon: "🧲",
    name: "磁力温床",
    maxLevel: 3,
    costs: [600, 1700, 3800],
    describe: (level) =>
      level ? `同级水果磁吸永久 +${level * 12}%` : "未装备",
  },
  {
    id: "score",
    icon: "💎",
    name: "分数水晶",
    maxLevel: 3,
    costs: [720, 2100, 4600],
    describe: (level) => (level ? `全部得分永久 +${level * 6}%` : "未装备"),
  },
  {
    id: "combo",
    icon: "🎀",
    name: "连击丝带",
    maxLevel: 3,
    costs: [620, 1800, 4000],
    describe: (level) =>
      level ? `连击窗口 +${(level * 0.2).toFixed(1)} 秒` : "未装备",
  },
  {
    id: "sweet_start",
    icon: "🌾",
    name: "丰收培育",
    maxLevel: 2,
    costs: [850, 2800],
    describe: (level) =>
      level
        ? level === 1
          ? "闯关每 3 次三消额外 +1 果，其他模式固定 +1"
          : "闯关每 2 次三消额外 +1 果，其他模式固定 +2"
        : "每次三消生成 1 颗水果",
  },
  {
    id: "coin",
    icon: "💰",
    name: "果币磁铁",
    maxLevel: 3,
    costs: [680, 1900, 4300],
    describe: (level) => (level ? `结算果币 +${level * 12}%` : "未装备"),
  },
  {
    id: "sun",
    icon: "🌀",
    name: "弹射培育",
    maxLevel: 3,
    costs: [560, 1600, 3600],
    describe: (level) =>
      level ? `点击水果弹射强度 +${level * 15}%` : "未装备",
  },
  {
    id: "seed_start",
    icon: "🪴",
    name: "开局育苗床",
    maxLevel: 2,
    costs: [980, 3200],
    describe: (level) =>
      level ? `每局开场投放 ${level} 颗低阶果种` : "未装备",
  },
  {
    id: "tray",
    icon: "🧺",
    name: "宽口卡槽",
    maxLevel: 2,
    costs: [1450, 4600],
    describe: (level) => (level ? `卡槽永久增加 ${level} 格` : "未装备"),
  },
  {
    id: "relic_start",
    icon: "🎁",
    name: "远征福袋",
    maxLevel: 1,
    costs: [5200],
    describe: (level) => (level ? "远征开局自带 1 件随机奇物" : "未装备"),
  },
];

export type ToolId =
  | "undo"
  | "shuffle"
  | "juice"
  | "hammer"
  | "magnet"
  | "wild"
  | "bubble"
  | "sun"
  | "ripen"
  | "split"
  | "bomb"
  | "shield"
  | "harvest"
  | "quake"
  | "basket"
  | "syrup";

export type ToolDefinition = {
  id: ToolId;
  icon: string;
  name: string;
  maxLevel: number;
  costs: number[];
  description: string;
};

// 道具购买的是“每局可用次数”，不是一次性消耗品；玩家用果币构筑自己的补给方案。
export const TOOLS: ToolDefinition[] = [
  {
    id: "shuffle",
    icon: "🎲",
    name: "洗牌",
    maxLevel: 3,
    costs: [90, 240, 520],
    description: "重排牌堆并露出可三消路线",
  },
  {
    id: "undo",
    icon: "🕰️",
    name: "撤回",
    maxLevel: 2,
    costs: [120, 360],
    description: "撤回上一张普通卡",
  },
  {
    id: "hammer",
    icon: "🔨",
    name: "清顶锤",
    maxLevel: 2,
    costs: [150, 420],
    description: "自动收取一张顶层卡",
  },
  {
    id: "juice",
    icon: "🥤",
    name: "榨汁",
    maxLevel: 2,
    costs: [180, 480],
    description: "最高阶水果降一级，立刻减压",
  },
  {
    id: "bubble",
    icon: "🫧",
    name: "泡泡袋",
    maxLevel: 2,
    costs: [220, 600],
    description: "收起两张散牌，凑满三张仍会转果",
  },
  {
    id: "bomb",
    icon: "💣",
    name: "果箱炸弹",
    maxLevel: 2,
    costs: [260, 760],
    description: "炸掉最拥挤处的低阶水果，快速腾出空间",
  },
  {
    id: "shield",
    icon: "🧊",
    name: "冰冻喷雾",
    maxLevel: 2,
    costs: [240, 660],
    description: "冻结果箱物理与警戒线 6 秒",
  },
  {
    id: "magnet",
    icon: "🧲",
    name: "强磁合并",
    maxLevel: 2,
    costs: [260, 700],
    description: "强制拉近一对同级水果",
  },
  {
    id: "sun",
    icon: "☀️",
    name: "阳光净化",
    maxLevel: 2,
    costs: [260, 720],
    description: "净化全部冰晶与藤蔓卡",
  },
  {
    id: "split",
    icon: "✂️",
    name: "分果剪",
    maxLevel: 2,
    costs: [280, 760],
    description: "把最高阶水果拆成两颗",
  },
  {
    id: "ripen",
    icon: "🌱",
    name: "催熟露",
    maxLevel: 2,
    costs: [300, 820],
    description: "最低阶水果直接升一级",
  },
  {
    id: "wild",
    icon: "🍀",
    name: "万能果",
    maxLevel: 2,
    costs: [320, 900],
    description: "补齐卡槽中最接近的三消",
  },
  {
    id: "quake",
    icon: "⚙️",
    name: "果箱搅拌机",
    maxLevel: 2,
    costs: [360, 980],
    description: "旋转搅动所有水果，拆开死角并创造碰撞",
  },
  {
    id: "harvest",
    icon: "🌾",
    name: "丰收剂",
    maxLevel: 2,
    costs: [420, 1200],
    description: "下一次三消额外生成一颗水果",
  },
  {
    id: "basket",
    icon: "🧺",
    name: "穿层采摘篮",
    maxLevel: 2,
    costs: [520, 1480],
    description: "直接采收牌堆里一组三张同果卡并转成果实",
  },
  {
    id: "syrup",
    icon: "🍯",
    name: "甜度糖浆",
    maxLevel: 2,
    costs: [460, 1320],
    description: "甜度 +45；狂热中使用则延长 2.5 秒",
  },
];
