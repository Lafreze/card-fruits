import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PlayerStore } from "./store.mjs";
import { createApp } from "./index.mjs";
const setup = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fruit-server-"));
  return {
    dir,
    store: new PlayerStore(dir),
    clean: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
};
const game = (s, p, difficulty = "expert", level = 0) =>
  s.start(p, {
    mode: "story",
    level,
    difficulty,
    requestId: crypto.randomUUID(),
  });
const finish = (s, p, run, status = "won", score = 100) =>
  s.finish(p, {
    ...run,
    status,
    score,
    maxCombo: 4,
    fruitTier: 3,
    durationMs: 30000,
  });
test("same IP has one durable identity; names change without duplicating public rows", () => {
  const { store: s, dir, clean } = setup();
  try {
    const p = s.player("192.0.2.1");
    assert.equal(p, s.player("::ffff:192.0.2.1"));
    assert.equal(p, s.player("::FFFF:c000:201"));
    const run = game(s, p);
    finish(s, p, run);
    finish(s, p, run);
    finish(s, p, game(s, p), "won", 200);
    s.rename(p, "新昵称");
    assert.equal(s.leaderboard("story").length, 1);
    assert.equal(s.leaderboard("story")[0].username, "新昵称");
    const restored = new PlayerStore(dir);
    assert.equal(restored.player("192.0.2.1").id, p.id);
    assert.equal(restored.leaderboard("story")[0].score, 200);
    assert.ok(
      !fs
        .readFileSync(path.join(dir, "players.json"), "utf8")
        .includes("192.0.2.1"),
    );
  } finally {
    clean();
  }
});
test("difficulty stars, per-level hidden gate, result ownership and idempotency", () => {
  const { store: s, clean } = setup();
  try {
    const p = s.player("192.0.2.2"),
      q = s.player("192.0.2.3");
    assert.throws(() => game(s, p, "nightmare"));
    finish(s, p, game(s, p, "relaxed"));
    assert.equal(p.stars[0], 1);
    finish(s, p, game(s, p, "classic"));
    assert.equal(p.stars[0], 2);
    finish(s, p, game(s, p, "expert"), "lost");
    assert.equal(p.stars[0], 2);
    finish(s, p, game(s, p));
    assert.equal(p.stars[0], 3);
    assert.throws(() => game(s, p, "nightmare", 1));
    const hidden = game(s, p, "nightmare");
    assert.throws(() => finish(s, q, hidden));
    assert.throws(() =>
      s.finish(p, {
        ...hidden,
        status: "won",
        score: 1,
        maxCombo: 1,
        fruitTier: 3,
        durationMs: 91000,
      }),
    );
    finish(s, p, hidden);
    assert.equal(p.stars[0], 4);
    finish(s, p, hidden);
    assert.equal(s.leaderboard("story").length, 1);
    assert.throws(() => s.rename(p, "\u0000bad"));
    assert.throws(() => finish(s, p, game(s, p), "won", -1));
  } finally {
    clean();
  }
});
test("HTTP API ignores forged forwarded IP headers by default and publishes saved scores", async () => {
  const { dir, clean } = setup();
  const server = createApp({ directory: dir, trustProxy: false }).listen(
    0,
    "127.0.0.1",
  );
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const request = async (url, method = "GET", body, ip = "203.0.113.1") => {
    const res = await fetch(base + url, {
      method,
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
      body: body && JSON.stringify(body),
    });
    assert.equal(res.status, 200);
    return res.json();
  };
  try {
    const a = await request("/player"),
      b = await request("/player", "GET", undefined, "203.0.113.2");
    assert.equal(a.id, b.id);
    await request("/player", "PATCH", { username: "公开园丁" });
    const run = await request("/runs", "POST", {
      mode: "story",
      level: 0,
      difficulty: "expert",
      requestId: "test-run",
    });
    await request("/scores", "POST", {
      ...run,
      status: "won",
      score: 1234,
      fruitTier: 3,
      maxCombo: 6,
      durationMs: 10000,
    });
    const board = await request("/leaderboard?mode=story");
    assert.equal(board.scores[0].username, "公开园丁");
    assert.equal(board.scores[0].stars, 3);
    assert.ok(!JSON.stringify(board).includes("127.0.0.1"));
  } finally {
    await new Promise((r) => server.close(r));
    clean();
  }
});

test("Railway edge identity uses the supplied real IP only in explicit edge mode", async () => {
  const { dir, clean } = setup();
  const server = createApp({ directory: dir, railwayEdge: true }).listen(
    0,
    "127.0.0.1",
  );
  await new Promise((r) => server.once("listening", r));
  const url = `http://127.0.0.1:${server.address().port}/api/player`;
  try {
    const first = await fetch(url, {
      headers: { "X-Real-IP": "192.0.2.10" },
    }).then((r) => r.json());
    const second = await fetch(url, {
      headers: { "X-Real-IP": "192.0.2.11" },
    }).then((r) => r.json());
    assert.notEqual(first.id, second.id);
    assert.equal(
      (await fetch(url, { headers: { "X-Real-IP": "invalid" } })).status,
      400,
    );
  } finally {
    await new Promise((r) => server.close(r));
    clean();
  }
});
