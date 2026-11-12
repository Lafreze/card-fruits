import test from "node:test";
import assert from "node:assert/strict";
import { storage, exportSave, importSave, validateSave } from "./storage.ts";
import { startRun, saveScore, getLeaderboard } from "./api.ts";
const disk = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (k: string) => disk.get(k) ?? null,
    setItem: (k: string, v: string) => disk.set(k, v),
  },
});
test("finished runs save without a server and retain best by mode and difficulty", async () => {
  const play = async (score: number, difficulty: "classic" | "expert") => {
    const { runId } = startRun("sprint", 2, difficulty);
    await saveScore({
      runId,
      username: "测试园丁",
      score,
      maxCombo: 3,
      fruitTier: 4,
      level: 5,
    });
    await saveScore({
      runId,
      username: "测试园丁",
      score,
      maxCombo: 3,
      fruitTier: 4,
      level: 5,
    });
  };
  await play(500, "classic");
  await play(200, "classic");
  await play(600, "expert");
  const results = await getLeaderboard("sprint");
  assert.equal(results.scores.length, 2);
  assert.equal(results.scores[0].score, 600);
  assert.equal(results.scores[1].score, 500);
  assert.equal(results.scores[0].level, 5);
  assert.equal((await getLeaderboard("sprint", "classic")).scores.length, 1);
});
test("backup roundtrip includes old progress and rejects corrupted data before writing", () => {
  storage.setItem("fruit-king-unlocked", "9");
  storage.setItem("fruit-king-coins", "321");
  const backup = exportSave();
  storage.setItem("fruit-king-coins", "10");
  importSave(backup);
  assert.equal(storage.getItem("fruit-king-coins"), "321");
  const bad = JSON.parse(backup);
  bad.data["fruit-king-coins"] = "-12";
  assert.throws(() => importSave(JSON.stringify(bad)));
  assert.equal(storage.getItem("fruit-king-coins"), "321");
  assert.throws(() => validateSave('{"format":"wrong"}'));
  bad.data["fruit-king-coins"] = "3";
  bad.data["fruit-king-scores-v3"] = '[{"score":99999999}]';
  assert.throws(() => importSave(JSON.stringify(bad)));
  assert.equal(storage.getItem("fruit-king-coins"), "321");
});

test("daily records keep separate dates and show the newest challenge first", async () => {
  for (const [day, score] of [
    ["2026-11-11", 500],
    ["2026-11-12", 100],
  ] as const) {
    const { runId } = startRun("daily", 5, "expert", day);
    await saveScore({
      runId,
      username: "每日园丁",
      score,
      maxCombo: 2,
      fruitTier: 4,
    });
  }
  const result = await getLeaderboard("daily");
  assert.equal(result.scores.length, 2);
  assert.equal(result.scores[0].challengeKey, "2026-11-12");
});

test("blocked browser storage falls back to the session and remains exportable", () => {
  const original = globalThis.localStorage.setItem;
  globalThis.localStorage.setItem = () => {
    throw new Error("quota exceeded");
  };
  storage.setItem("fruit-king-coins", "789");
  assert.equal(storage.persistent, false);
  assert.equal(storage.getItem("fruit-king-coins"), "789");
  assert.equal(JSON.parse(exportSave()).data["fruit-king-coins"], "789");
  globalThis.localStorage.setItem = original;
});

test("extreme records and new skill upgrades survive save export and import", async () => {
  const { runId } = startRun("story", 3, "extreme");
  await saveScore({
    runId,
    username: "极限园丁",
    score: 1400,
    maxCombo: 5,
    fruitTier: 6,
  });
  storage.setItem(
    "fruit-king-tools",
    JSON.stringify({ insight: 2, vortex: 1 }),
  );
  const backup = exportSave();
  importSave(backup);
  assert.equal(
    (await getLeaderboard("story", "extreme")).scores[0].score,
    1400,
  );
  assert.deepEqual(JSON.parse(storage.getItem("fruit-king-tools")!), {
    insight: 2,
    vortex: 1,
  });
});
