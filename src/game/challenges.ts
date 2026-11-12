export type Difficulty =
  "relaxed" | "classic" | "expert" | "master" | "extreme";
export const DIFFICULTIES = {
  relaxed: {
    name: "悠闲",
    slots: 8,
    danger: 3.5,
    score: 0.8,
    special: -0.12,
    size: 0.94,
    hint: "8 格 · 得分 ×0.8",
  },
  classic: {
    name: "标准",
    slots: 7,
    danger: 1.8,
    score: 1,
    special: 0.04,
    size: 1,
    hint: "7 格 · 得分 ×1",
  },
  expert: {
    name: "困难",
    slots: 6,
    danger: 1.4,
    score: 1.4,
    special: 0.16,
    size: 1.04,
    hint: "6 格 · 得分 ×1.4",
  },
  master: {
    name: "大师",
    slots: 5,
    danger: 1.1,
    score: 1.8,
    special: 0.26,
    size: 1.08,
    hint: "5 格 · 得分 ×1.8",
  },
  extreme: {
    name: "极限",
    slots: 4,
    danger: 0.9,
    score: 2.4,
    special: 0.34,
    size: 1.12,
    hint: "4 格 · 得分 ×2.4",
  },
} as const;
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
    seed: `orchard-v4-${key}`,
    difficulty: "expert" as const,
  };
}
export const SPRINT_SECONDS = 120;
export function secondsRemaining(elapsed: number, limit: number) {
  return Math.max(0, Math.ceil(limit - elapsed));
}
