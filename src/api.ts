import type { GameMode } from "./game/modes";
import { normalizeDifficulty, type Difficulty } from "./game/challenges.ts";
import { storage, validScore, mergeStars } from "./storage.ts";
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
      ? (scores
          .filter(validScore)
          .slice(-500)
          .map((s) => ({
            ...s,
            difficulty: normalizeDifficulty(String(s.difficulty)),
          })) as LeaderboardEntry[])
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
  if (typeof window !== "undefined")
    void register(runId, runs.get(runId)!).catch(() => {});
  return { runId };
}
export async function saveScore(payload: {
  runId: string;
  username: string;
  score: number;
  maxCombo: number;
  fruitTier: number;
  level?: number;
  status?: "won" | "lost";
  durationMs?: number;
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
  if (typeof window !== "undefined") {
    const pending = readPending();
    pending[payload.runId] = {
      run,
      payload: {
        ...payload,
        status: payload.status || "lost",
        durationMs: Math.round(payload.durationMs || 0),
      },
    };
    storage.setItem(PENDING, JSON.stringify(pending));
    await upload(payload.runId, pending[payload.runId]);
  }
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
  if (typeof window !== "undefined") {
    try {
      return await request<{ scores: LeaderboardEntry[]; offline: boolean }>(
        `/leaderboard?mode=${mode}${difficulty ? `&difficulty=${difficulty}` : ""}`,
      );
    } catch {
      return {
        scores: readScores()
          .filter(
            (e) =>
              e.mode === mode && (!difficulty || e.difficulty === difficulty),
          )
          .sort(compareScores)
          .slice(0, 50),
        offline: true,
      };
    }
  }
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

export type PlayerProfile = {
  id: string;
  username: string;
  stars: Record<string, number>;
};
const PENDING = "fruit-king-server-pending-v1";
type Run = NonNullable<ReturnType<typeof runs.get>>;
type Pending = { run: Run; payload: Parameters<typeof saveScore>[0] };
const registrations = new Map<string, Promise<{ runId: string }>>();
async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw Error(error.error || "服务器暂时不可用，成绩已暂存");
  }
  return response.json();
}
function readPending(): Record<string, Pending> {
  try {
    return JSON.parse(storage.getItem(PENDING) || "{}");
  } catch {
    return {};
  }
}
function register(id: string, run: Run) {
  if (!registrations.has(id))
    registrations.set(
      id,
      request<{ runId: string }>("/runs", "POST", {
        ...run,
        requestId: id,
      }).catch((error) => {
        registrations.delete(id);
        throw error;
      }),
    );
  return registrations.get(id)!;
}
async function upload(id: string, entry: Pending) {
  const registered = await register(id, entry.run);
  const result = await request<{ profile: PlayerProfile }>("/scores", "POST", {
    ...entry.payload,
    runId: registered.runId,
  });
  mergeStars(result.profile.stars);
  const pending = readPending();
  delete pending[id];
  storage.setItem(PENDING, JSON.stringify(pending));
  window.dispatchEvent(new CustomEvent("fruit-score-synced", { detail: id }));
  return result;
}
export async function syncPending() {
  let failure: unknown;
  for (const [id, entry] of Object.entries(readPending())) {
    try {
      await upload(id, entry);
    } catch (error) {
      failure = error;
    }
  }
  if (failure) throw failure;
}
export async function getPlayer() {
  return request<PlayerProfile>("/player");
}
export async function renamePlayer(username: string) {
  const profile = await request<PlayerProfile>("/player", "PATCH", {
    username,
  });
  storage.setItem("fruit-king-name", profile.username);
  return profile;
}
