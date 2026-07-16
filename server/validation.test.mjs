import assert from "node:assert/strict";
import test from "node:test";
import { cleanUsername, finishRunSchema, startRunSchema } from "./validation.mjs";

test("accepts a valid story run", () => {
  assert.equal(startRunSchema.safeParse({ mode: "story", level: 3 }).success, true);
});

test("rejects unsupported game modes", () => {
  assert.equal(startRunSchema.safeParse({ mode: "ranked", level: 1 }).success, false);
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
