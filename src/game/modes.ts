export type GameMode = "story" | "endless" | "expedition";

export type RelicId =
  | "mini_orchard"
  | "golden_touch"
  | "deep_tray"
  | "slow_sugar"
  | "tool_belt"
  | "magnet_core"
  | "blast_juice"
  | "lucky_bloom";

export type RelicDefinition = {
  id: RelicId;
  icon: string;
  name: string;
  description: string;
  tone: "gold" | "pink" | "cyan";
};

export const RELICS: RelicDefinition[] = [
  { id: "mini_orchard", icon: "🫧", name: "迷你果园", description: "物理水果缩小 14%，果箱更耐装。", tone: "cyan" },
  { id: "golden_touch", icon: "✨", name: "黄金触感", description: "所有三消与合成得分提高 35%。", tone: "gold" },
  { id: "deep_tray", icon: "🧺", name: "深口果篮", description: "卡槽容量增加 1 格。", tone: "pink" },
  { id: "slow_sugar", icon: "⏳", name: "慢糖结界", description: "警戒线容错时间延长 1.2 秒。", tone: "cyan" },
  { id: "tool_belt", icon: "🎒", name: "园丁腰包", description: "每关额外获得洗牌、锤子各 1 次。", tone: "gold" },
  { id: "magnet_core", icon: "🧲", name: "引力果核", description: "同级水果吸引速度提高 55%。", tone: "pink" },
  { id: "blast_juice", icon: "💥", name: "爆浆配方", description: "炸弹卡出现率和爆炸范围提高。", tone: "gold" },
  { id: "lucky_bloom", icon: "🌸", name: "幸运花期", description: "每波开局额外生成一颗低阶水果。", tone: "pink" },
];

export const MODE_INFO: Record<GameMode, { icon: string; name: string; tagline: string }> = {
  story: { icon: "🗺️", name: "主线果园", tagline: "12 关手工叠层 · 逐级合成果王" },
  endless: { icon: "∞", name: "无尽狂欢", tagline: "无限补牌 · 双果王触发彩虹清场" },
  expedition: { icon: "🧭", name: "果园远征", tagline: "随机奇物构筑 · 一路挑战变异果园" },
};

export function pickRelics(owned: RelicId[], count = 3) {
  const pool = RELICS.filter((relic) => !owned.includes(relic.id));
  return [...pool].sort(() => Math.random() - 0.5).slice(0, count);
}
