import fs from "node:fs";
import path from "node:path";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { isIP } from "node:net";

export class PlayerStore {
  constructor(directory) {
    fs.mkdirSync(directory, { recursive: true });
    this.file = path.join(directory, "players.json");
    const secretFile = path.join(directory, "identity.key");
    if (!fs.existsSync(secretFile))
      fs.writeFileSync(secretFile, randomBytes(32), {
        mode: 0o600,
        flag: "wx",
      });
    this.secret = fs.readFileSync(secretFile);
    this.data = fs.existsSync(this.file)
      ? JSON.parse(fs.readFileSync(this.file, "utf8"))
      : { version: 1, players: {}, runs: {} };
    if (this.data.version !== 1 || !this.data.players || !this.data.runs)
      throw Error("Invalid player store; refusing to overwrite");
  }
  persist() {
    const temp = this.file + ".tmp";
    const fd = fs.openSync(temp, "w", 0o600);
    try {
      fs.writeFileSync(fd, JSON.stringify(this.data));
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(temp, this.file);
  }
  identify(ip) {
    if (typeof ip !== "string" || !isIP(ip)) throw Error("Invalid IP");
    if (isIP(ip) === 6) {
      ip = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
      const mapped = ip.match(/^::ffff:([0-9a-f]+):([0-9a-f]+)$/);
      if (mapped) {
        const high = parseInt(mapped[1], 16),
          low = parseInt(mapped[2], 16);
        ip = [high >> 8, high & 255, low >> 8, low & 255].join(".");
      }
    }
    return createHmac("sha256", this.secret)
      .update(ip)
      .digest("hex")
      .slice(0, 24);
  }
  player(ip) {
    const id = this.identify(ip);
    if (!this.data.players[id]) {
      this.data.players[id] = {
        id,
        username: `果园旅人${id.slice(0, 4)}`,
        stars: {},
        records: {},
      };
      this.persist();
    }
    return this.data.players[id];
  }
  profile(p) {
    return { id: p.id, username: p.username, stars: p.stars };
  }
  rename(p, name) {
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 20 ||
      /[\p{Cc}\p{Cf}]/u.test(name)
    )
      throw Error("昵称需为 1–20 个可见字符");
    p.username = name.trim();
    this.persist();
    return this.profile(p);
  }
  start(p, body) {
    const { mode, level, difficulty, challengeKey = "", requestId } = body;
    if (
      !["story", "endless", "expedition", "sprint", "daily"].includes(mode) ||
      !["relaxed", "classic", "expert", "nightmare"].includes(difficulty) ||
      !Number.isSafeInteger(level) ||
      level < 0 ||
      level > 100000 ||
      typeof requestId !== "string" ||
      !/^[\w-]{1,100}$/.test(requestId)
    )
      throw Error("对局参数无效");
    if (["story", "daily", "expedition"].includes(mode) && level > 52)
      throw Error("关卡不存在");
    if (
      difficulty === "nightmare" &&
      (mode !== "story" || (p.stars[level] || 0) < 3)
    )
      throw Error("本关三星通关后解锁四星");
    if (
      typeof challengeKey !== "string" ||
      (challengeKey !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(challengeKey))
    )
      throw Error("挑战日期无效");
    if (mode === "daily" && (difficulty !== "expert" || !challengeKey))
      throw Error("每日挑战参数无效");
    const key = p.id + ":" + requestId;
    if (this.data.runs[key]) return { runId: key };
    const now = Date.now();
    for (const [id, run] of Object.entries(this.data.runs))
      if (now - run.started > 7 * 86400000) delete this.data.runs[id];
    if (
      Object.values(this.data.runs).filter(
        (r) => r.playerId === p.id && now - r.started < 3600000,
      ).length >= 120
    )
      throw Error("对局创建过于频繁");
    this.data.runs[key] = {
      playerId: p.id,
      mode,
      level,
      difficulty,
      challengeKey,
      started: now,
    };
    this.persist();
    return { runId: key };
  }
  finish(p, body) {
    const run = this.data.runs[body.runId];
    if (!run || run.playerId !== p.id)
      throw Error("对局不存在或不属于当前玩家");
    if (run.result)
      return {
        score: { ...run.result, username: p.username },
        profile: this.profile(p),
      };
    const integer = (v, max) => Number.isSafeInteger(v) && v >= 0 && v <= max;
    if (
      !integer(body.score, 1e12) ||
      !integer(body.maxCombo, 100000) ||
      !integer(body.fruitTier, 55) ||
      !["won", "lost"].includes(body.status) ||
      !integer(body.durationMs, 86400000)
    )
      throw Error("成绩数据无效");
    if (
      run.difficulty === "nightmare" &&
      body.status === "won" &&
      body.durationMs > 90500
    )
      throw Error("四星限时已结束");
    if (
      run.mode === "story" &&
      body.status === "won" &&
      body.fruitTier < run.level + 3
    )
      throw Error("尚未合成目标水果");
    const stars =
      body.status === "won"
        ? { relaxed: 1, classic: 2, expert: 3, nightmare: 4 }[run.difficulty]
        : 0;
    if (run.mode === "story")
      p.stars[run.level] = Math.max(p.stars[run.level] || 0, stars);
    const level =
      ["endless", "sprint"].includes(run.mode) && integer(body.level, 100000)
        ? Math.max(run.level, body.level)
        : run.level;
    const record = {
      runId: body.runId,
      playerId: p.id,
      mode: run.mode,
      difficulty: run.difficulty,
      challengeKey: run.challengeKey,
      level,
      score: body.score,
      maxCombo: body.maxCombo,
      fruitTier: body.fruitTier,
      stars,
      createdAt: new Date().toISOString(),
    };
    const key = [run.mode, run.difficulty, run.challengeKey].join(":");
    if (!p.records[key] || compare(record, p.records[key]) < 0)
      p.records[key] = record;
    const keys = Object.keys(p.records).sort((a, b) =>
      p.records[b].createdAt.localeCompare(p.records[a].createdAt),
    );
    keys.slice(500).forEach((k) => delete p.records[k]);
    run.result = record;
    this.persist();
    return {
      score: { ...record, username: p.username },
      profile: this.profile(p),
    };
  }
  leaderboard(mode, difficulty) {
    return Object.values(this.data.players)
      .flatMap((p) => {
        const best = Object.values(p.records)
          .filter(
            (r) =>
              r.mode === mode && (!difficulty || r.difficulty === difficulty),
          )
          .sort(compare)[0];
        return best ? [{ ...best, username: p.username }] : [];
      })
      .sort(compare)
      .slice(0, 100);
  }
}
export function compare(a, b) {
  return (
    (a.mode === "daily" ? b.challengeKey.localeCompare(a.challengeKey) : 0) ||
    (a.mode === "story" ? b.level - a.level || b.stars - a.stars : 0) ||
    b.score - a.score ||
    a.createdAt.localeCompare(b.createdAt)
  );
}
