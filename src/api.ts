import type { GameMode } from "./game/modes";

export type LeaderboardEntry = {
  username: string;
  score: number;
  level: number;
  maxCombo: number;
  fruitTier: number;
  createdAt: string;
};

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "网络开小差了");
  return body as T;
}

export async function startRun(mode: GameMode, level: number) {
  return api<{ runId: string }>("/api/runs", {
    method: "POST",
    body: JSON.stringify({ mode, level }),
  });
}

export async function saveScore(payload: {
  runId: string;
  username: string;
  score: number;
  maxCombo: number;
  fruitTier: number;
}) {
  return api<{ score: LeaderboardEntry }>("/api/scores", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getLeaderboard(mode: GameMode = "story") {
  return api<{ scores: LeaderboardEntry[]; offline?: boolean }>(
    `/api/leaderboard?mode=${mode}`,
  );
}
