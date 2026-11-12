export type Difficulty = "relaxed" | "classic" | "expert" | "nightmare";
export const DIFFICULTIES = {
  relaxed: {
    name: "简单",
    stars: 1,
    slots: 8,
    danger: 3.5,
    score: 0.8,
    special: -0.12,
    size: 0.94,
    hint: "通关 1 星 · 8 格",
  },
  classic: {
    name: "普通",
    stars: 2,
    slots: 7,
    danger: 1.8,
    score: 1,
    special: 0.04,
    size: 1,
    hint: "通关 2 星 · 7 格",
  },
  expert: {
    name: "困难",
    stars: 3,
    slots: 6,
    danger: 1.4,
    score: 1.4,
    special: 0.16,
    size: 1.04,
    hint: "通关 3 星 · 6 格",
  },
  nightmare: {
    name: "隐藏四星",
    stars: 4,
    slots: 5,
    danger: 1.05,
    score: 2.4,
    special: 0.48,
    size: 1.08,
    hint: "通关 4 星 · 90 秒 · 随机阻碍",
  },
} as const;
export const NIGHTMARE_SECONDS = 90;
export const awardStars = (difficulty: Difficulty, won: boolean) =>
  won ? DIFFICULTIES[difficulty].stars : 0;
export const normalizeDifficulty = (value: string): Difficulty =>
  value === "master" || value === "extreme"
    ? "expert"
    : value in DIFFICULTIES
      ? (value as Difficulty)
      : "classic";
export function seededRandom(seed: string) {
  let value = 2166136261;
  for (const char of seed)
    value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return () => {
    value += 0x6d2b79f5;
    let n = Math.imul(value ^ (value >>> 15), 1 | value);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
// One UTC calendar day for every player, regardless of device timezone.
export function dailyChallenge(date = new Date()) {
  const key = date.toISOString().slice(0, 10);
  const random = seededRandom(key);
  return {
    key,
    level: 3 + Math.floor(random() * 9),
    seed: `orchard-v6-${key}`,
    difficulty: "expert" as const,
  };
}
export const SPRINT_SECONDS = 120;
export function secondsRemaining(elapsed: number, limit: number) {
  return Math.max(0, Math.ceil(limit - elapsed));
}
