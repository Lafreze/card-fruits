// Browser-local storage with a session fallback when private mode/quota blocks writes.
const memory = new Map<string, string>();
let persistent = true;
export const storage = {
  get persistent() {
    return persistent;
  },
  getItem(key: string): string | null {
    if (memory.has(key)) return memory.get(key)!;
    try {
      return localStorage.getItem(key);
    } catch {
      persistent = false;
      return null;
    }
  },
  setItem(key: string, value: string) {
    memory.set(key, value);
    try {
      localStorage.setItem(key, value);
    } catch {
      persistent = false;
    }
  },
};
export const SAVE_KEYS = [
  "fruit-king-unlocked",
  "fruit-king-stars",
  "fruit-king-coins",
  "fruit-king-upgrades",
  "fruit-king-tools",
  "fruit-king-tutorial-v2",
  "fruit-king-starter-gift-v1",
  "fruit-king-scores-v3",
  "fruit-king-name",
  "fruit-king-muted",
] as const;
export function exportSave() {
  return JSON.stringify(
    {
      format: "orchard-club",
      version: 3,
      exportedAt: new Date().toISOString(),
      data: Object.fromEntries(
        SAVE_KEYS.map((key) => [key, storage.getItem(key)]),
      ),
    },
    null,
    2,
  );
}
const integer = (value: unknown, max: number) =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value <= max;
export function validScore(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.runId === "string" &&
    v.runId.length <= 100 &&
    typeof v.username === "string" &&
    v.username.length > 0 &&
    v.username.length <= 20 &&
    ["story", "endless", "expedition", "sprint", "daily"].includes(
      String(v.mode),
    ) &&
    ["relaxed", "classic", "expert", "master", "extreme", "nightmare"].includes(
      String(v.difficulty),
    ) &&
    integer(v.score, 1e12) &&
    integer(v.level, 100000) &&
    integer(v.maxCombo, 100000) &&
    integer(v.fruitTier, 55) &&
    typeof v.createdAt === "string" &&
    Number.isFinite(Date.parse(v.createdAt)) &&
    typeof v.challengeKey === "string" &&
    (v.challengeKey === "" || /^\d{4}-\d{2}-\d{2}$/.test(v.challengeKey))
  );
}
export function validateSave(text: string): Record<string, string> {
  if (text.length > 2_000_000) throw new Error("存档文件过大");
  const value = JSON.parse(text);
  if (
    value?.format !== "orchard-club" ||
    value.version !== 3 ||
    !value.data ||
    Array.isArray(value.data)
  )
    throw new Error("这不是受支持的果园存档");
  const data: Record<string, string> = {};
  for (const key of SAVE_KEYS) {
    const raw = value.data[key];
    if (raw === null || raw === undefined) continue;
    if (typeof raw !== "string") throw new Error("存档数据格式不正确");
    let valid = true;
    if (key === "fruit-king-unlocked")
      valid = raw.trim() !== "" && integer(Number(raw), 52);
    else if (key === "fruit-king-stars") {
      const stars = JSON.parse(raw);
      valid =
        !!stars &&
        typeof stars === "object" &&
        !Array.isArray(stars) &&
        Object.entries(stars).every(
          ([level, stars]) =>
            /^\d+$/.test(level) &&
            integer(Number(level), 52) &&
            integer(stars, 4),
        );
    } else if (key === "fruit-king-coins")
      valid = raw.trim() !== "" && integer(Number(raw), 1e12);
    else if (key === "fruit-king-tools" || key === "fruit-king-upgrades") {
      const levels = JSON.parse(raw);
      valid =
        !!levels &&
        typeof levels === "object" &&
        !Array.isArray(levels) &&
        Object.values(levels).every((v) => integer(v, 3));
    } else if (key === "fruit-king-scores-v3") {
      const scores = JSON.parse(raw);
      valid =
        Array.isArray(scores) &&
        scores.length <= 500 &&
        scores.every(validScore);
    } else if (key === "fruit-king-name") valid = raw.length <= 20;
    else if (key === "fruit-king-tutorial-v2") valid = raw === "done";
    else if (key === "fruit-king-starter-gift-v1") valid = raw === "claimed";
    else if (key === "fruit-king-muted")
      valid = raw === "true" || raw === "false";
    if (!valid) throw new Error("存档包含无效数据，原存档未被改动");
    data[key] = raw;
  }
  if (!Object.keys(data).length) throw new Error("存档没有可恢复的数据");
  return data;
}
export function importSave(text: string) {
  const data = validateSave(text); // Validate everything before changing any key.
  for (const [key, value] of Object.entries(data)) storage.setItem(key, value);
  return storage.persistent;
}

export function readStars(): Record<string, number> {
  try {
    const data = JSON.parse(storage.getItem("fruit-king-stars") || "{}");
    return Object.fromEntries(
      Object.entries(data).filter(
        ([key, value]) =>
          /^\d+$/.test(key) && integer(Number(key), 52) && integer(value, 4),
      ),
    ) as Record<string, number>;
  } catch {
    return {};
  }
}
export function mergeStars(incoming: Record<string, number>) {
  const stars = readStars();
  for (const [level, value] of Object.entries(incoming))
    if (integer(Number(level), 52) && integer(value, 4))
      stars[level] = Math.max(stars[level] || 0, value);
  storage.setItem("fruit-king-stars", JSON.stringify(stars));
  return stars;
}
