export type FruitDefinition = {
  name: string;
  emoji: string;
  radius: number;
  color: number;
  glow: number;
};

export type LevelDefinition = {
  name: string;
  target: number;
  cards: Array<{ tier: number; count: number }>;
  specialRate: number;
};

export const FRUITS: FruitDefinition[] = [
  { name: "葡萄", emoji: "🍇", radius: 13, color: 0x9b5de5, glow: 0xd8b4fe },
  { name: "樱桃", emoji: "🍒", radius: 16, color: 0xef476f, glow: 0xff9bb1 },
  { name: "草莓", emoji: "🍓", radius: 20, color: 0xff4d6d, glow: 0xffb3c1 },
  { name: "柠檬", emoji: "🍋", radius: 24, color: 0xffd166, glow: 0xffef9f },
  { name: "猕猴桃", emoji: "🥝", radius: 28, color: 0x8ac926, glow: 0xc5f277 },
  { name: "橙子", emoji: "🍊", radius: 33, color: 0xff9f1c, glow: 0xffc971 },
  { name: "苹果", emoji: "🍎", radius: 38, color: 0xff595e, glow: 0xff9c9f },
  { name: "桃子", emoji: "🍑", radius: 44, color: 0xff8fab, glow: 0xffc2d1 },
  { name: "芒果", emoji: "🥭", radius: 50, color: 0xffb703, glow: 0xffd166 },
  { name: "菠萝", emoji: "🍍", radius: 56, color: 0xf7c948, glow: 0xffe69a },
  { name: "哈密瓜", emoji: "🍈", radius: 63, color: 0x90be6d, glow: 0xc7f9b5 },
  { name: "西瓜", emoji: "🍉", radius: 70, color: 0x43aa8b, glow: 0x9bf6cf },
  { name: "黄金果王", emoji: "👑", radius: 78, color: 0xffd60a, glow: 0xfff3a3 },
];

export const LEVELS: LevelDefinition[] = [
  { name: "晨露初甜", target: 2, cards: [{ tier: 0, count: 9 }, { tier: 1, count: 6 }, { tier: 2, count: 3 }], specialRate: 0 },
  { name: "莓好时光", target: 3, cards: [{ tier: 0, count: 9 }, { tier: 1, count: 9 }, { tier: 2, count: 6 }], specialRate: 0 },
  { name: "青柠电波", target: 4, cards: [{ tier: 0, count: 9 }, { tier: 1, count: 9 }, { tier: 2, count: 9 }, { tier: 3, count: 6 }], specialRate: 0.06 },
  { name: "橙光派对", target: 5, cards: [{ tier: 1, count: 9 }, { tier: 2, count: 9 }, { tier: 3, count: 9 }, { tier: 4, count: 6 }], specialRate: 0.08 },
  { name: "苹果心跳", target: 6, cards: [{ tier: 2, count: 12 }, { tier: 3, count: 9 }, { tier: 4, count: 9 }, { tier: 5, count: 6 }], specialRate: 0.1 },
  { name: "蜜桃星云", target: 7, cards: [{ tier: 3, count: 12 }, { tier: 4, count: 9 }, { tier: 5, count: 9 }, { tier: 6, count: 6 }], specialRate: 0.12 },
  { name: "热带引力", target: 8, cards: [{ tier: 4, count: 12 }, { tier: 5, count: 9 }, { tier: 6, count: 9 }, { tier: 7, count: 6 }], specialRate: 0.14 },
  { name: "菠萝脉冲", target: 9, cards: [{ tier: 5, count: 12 }, { tier: 6, count: 9 }, { tier: 7, count: 9 }, { tier: 8, count: 6 }], specialRate: 0.16 },
  { name: "瓜田月色", target: 10, cards: [{ tier: 6, count: 12 }, { tier: 7, count: 9 }, { tier: 8, count: 9 }, { tier: 9, count: 6 }], specialRate: 0.18 },
  { name: "西瓜音浪", target: 11, cards: [{ tier: 7, count: 12 }, { tier: 8, count: 9 }, { tier: 9, count: 9 }, { tier: 10, count: 6 }], specialRate: 0.2 },
  { name: "王冠前夜", target: 12, cards: [{ tier: 8, count: 12 }, { tier: 9, count: 9 }, { tier: 10, count: 9 }, { tier: 11, count: 6 }], specialRate: 0.22 },
  { name: "果王降临", target: 12, cards: [{ tier: 9, count: 12 }, { tier: 10, count: 9 }, { tier: 11, count: 6 }], specialRate: 0.25 },
];

export const WORLD = {
  width: 430,
  height: 860,
  stack: { x: 15, y: 102, width: 400, height: 300 },
  tray: { x: 18, y: 418, width: 394, height: 72 },
  box: { x: 17, y: 535, width: 396, height: 312 },
  dangerY: 585,
};
