import type { GameMode } from "./game/modes";
import type { Difficulty } from "./game/challenges";
import { storage, validScore } from "./storage.ts";
export type LeaderboardEntry = {
  runId: string;
  username: string;
  score: number;
  level: number;
  mode: GameMode;
  difficulty: Difficulty;
  challengeKey: string;
  maxCombo: number;
  fruitTier: number;
  createdAt: string;
};
const KEY = "fruit-king-scores-v3";
const runs = new Map<
  string,
  {
    mode: GameMode;
    level: number;
    difficulty: Difficulty;
    challengeKey: string;
  }
>();
export function readScores(): LeaderboardEntry[] {
  try {
    const scores: unknown = JSON.parse(storage.getItem(KEY) || "[]");
    return Array.isArray(scores)
      ? (scores.filter(validScore).slice(-500) as LeaderboardEntry[])
      : [];
  } catch {
    return [];
  }
}
export function startRun(
  mode: GameMode,
  level: number,
  difficulty: Difficulty = "classic",
  challengeKey = "",
) {
  const runId = crypto.randomUUID();
  runs.set(runId, { mode, level, difficulty, challengeKey });
  if (runs.size > 100) runs.delete(runs.keys().next().value!);
  return { runId };
}
export async function saveScore(payload: {
  runId: string;
  username: string;
  score: number;
  maxCombo: number;
  fruitTier: number;
  level?: number;
}) {
  const run = runs.get(payload.runId);
  if (!run) throw new Error("本局记录不存在");
  const score: LeaderboardEntry = {
    ...run,
    ...payload,
    level: payload.level ?? run.level,
    username: payload.username.trim().slice(0, 20) || "果园旅人",
    createdAt: new Date().toISOString(),
  };
  if (!validScore(score)) throw new Error("分数数据无效，未保存");
  const scores = readScores().filter((entry) => entry.runId !== score.runId);
  scores.push(score);
  // Keep the best per player / ruleset so high scores survive long play histories.
  const best = new Map<string, LeaderboardEntry>();
  for (const entry of scores) {
    const key = `${entry.mode}:${entry.difficulty}:${entry.challengeKey}:${entry.username.toLowerCase()}`;
    const previous = best.get(key);
    if (!previous || compareScores(entry, previous) < 0) best.set(key, entry);
  }
  storage.setItem(
    KEY,
    JSON.stringify(
      [...best.values()]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 500),
    ),
  );
  return { score };
}
function compareScores(a: LeaderboardEntry, b: LeaderboardEntry) {
  return (
    (a.mode === "daily" ? b.challengeKey.localeCompare(a.challengeKey) : 0) ||
    (a.mode === "story" ? b.level - a.level : 0) ||
    b.score - a.score ||
    a.createdAt.localeCompare(b.createdAt)
  );
}
export async function getLeaderboard(
  mode: GameMode = "story",
  difficulty?: Difficulty,
) {
  return {
    scores: readScores()
      .filter(
        (entry) =>
          entry.mode === mode &&
          (!difficulty || entry.difficulty === difficulty),
      )
      .sort(compareScores)
      .slice(0, 50),
    offline: !storage.persistent,
  };
}
