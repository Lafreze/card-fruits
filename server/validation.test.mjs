import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { cleanUsername, finishRunSchema, startRunSchema } from "./validation.mjs";

test("accepts a valid story run", () => {
  assert.equal(startRunSchema.safeParse({ mode: "story", level: 3 }).success, true);
});

test("rejects unsupported game modes", () => {
  assert.equal(startRunSchema.safeParse({ mode: "ranked", level: 1 }).success, false);
});

test("accepts expedition runs and endless-scale scores", () => {
  assert.equal(startRunSchema.safeParse({ mode: "expedition", level: 7 }).success, true);
  assert.equal(
    finishRunSchema.safeParse({
      runId: "8a12c4fd-a84b-4a3d-8e67-66d22f32f375",
      username: "Rogue果王",
      score: 125_000_000,
      maxCombo: 88,
      fruitTier: 12,
    }).success,
    true,
  );
});

test("accepts the expanded late-game fruit tiers", () => {
  const parsed = finishRunSchema.safeParse({
    runId: "bd71b982-f0e3-4aa1-927c-0379724db890",
    username: "Fruit Master",
    score: 880000,
    maxCombo: 12,
    fruitTier: 38,
  });
  assert.equal(parsed.success, true);
});

test("database accepts every server-validated fruit tier", () => {
  const schema = fs.readFileSync(
    new URL("../database/schema.sql", import.meta.url),
    "utf8",
  );
  assert.match(schema, /fruit_tier BETWEEN 0 AND 48/);
  assert.doesNotMatch(schema, /fruit_tier BETWEEN 0 AND 20/);
});

test("normalizes username whitespace", () => {
  assert.equal(cleanUsername("  果王   007 "), "果王 007");
});

test("validates completed score payload", () => {
  const result = finishRunSchema.safeParse({
    runId: "8a12c4fd-a84b-4a3d-8e67-66d22f32f375",
    username: "Lafreze",
    score: 125000,
    maxCombo: 8,
    fruitTier: 10,
  });
  assert.equal(result.success, true);
});
