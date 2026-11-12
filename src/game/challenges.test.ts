import test from "node:test";
import assert from "node:assert/strict";
import {
  dailyChallenge,
  DIFFICULTIES,
  seededRandom,
  secondsRemaining,
} from "./challenges.ts";
import { buildPlayableDeal, scatterStackSlots } from "./logic.ts";
import { LEVELS, FRUITS } from "./data.ts";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
test("daily challenge uses the same UTC date and deal across devices, changes next day", () => {
  const first = dailyChallenge(new Date("2026-11-12T01:00:00Z"));
  const late = dailyChallenge(new Date("2026-11-12T23:59:00Z"));
  const next = dailyChallenge(new Date("2026-11-13T00:00:00Z"));
  assert.deepEqual(first, late);
  assert.notEqual(first.seed, next.seed);
  function deal() {
    const rng = seededRandom(first.seed),
      def = LEVELS[first.level];
    const slots = def.layout.flatMap((b) =>
      Array.from({ length: b.cols * b.rows }, (_, cell) => ({
        layer: b.layer,
        x: b.x + ((cell % b.cols) - (b.cols - 1) / 2) * b.sx,
        y: b.y + (Math.floor(cell / b.cols) - (b.rows - 1) / 2) * b.sy,
      })),
    );
    scatterStackSlots(
      slots,
      {
        left: 46,
        right: 384,
        top: 128,
        bottom: 380,
        cardWidth: 58,
        cardHeight: 66,
      },
      rng,
    );
    return buildPlayableDeal(
      def.cards.flatMap((c) => Array(c.count / 3).fill(c.tier)),
      slots,
      rng,
    );
  }
  assert.deepEqual(deal(), deal());
});
test("four difficulties trade capacity and grace period for score", () => {
  const rules = Object.values(DIFFICULTIES);
  assert.deepEqual(
    rules.map((r) => r.slots),
    [8, 7, 6, 5],
  );
  for (let i = 1; i < rules.length; i++) {
    assert.ok(rules[i].score > rules[i - 1].score);
    assert.ok(rules[i].danger < rules[i - 1].danger);
  }
});
test("sprint clock clamps its final second and cannot go negative", () => {
  assert.equal(secondsRemaining(0, 120), 120);
  assert.equal(secondsRemaining(119.1, 120), 1);
  assert.equal(secondsRemaining(120, 120), 0);
  assert.equal(secondsRemaining(123, 120), 0);
});
test("all 50 fruits have distinct WebP artwork with matching cache fingerprints", () => {
  assert.equal(new Set(FRUITS.map((f) => f.icon)).size, 50);
  FRUITS.forEach((f) => {
    const file = `public${f.icon}`;
    assert.ok(existsSync(file), file);
    const content = readFileSync(file);
    assert.equal(content.toString("ascii", 0, 4), "RIFF");
    assert.equal(content.toString("ascii", 8, 12), "WEBP");
    const digest = createHash("sha256").update(content).digest("hex").slice(0, 12);
    assert.ok(f.icon.endsWith(`.${digest}.webp`), `${f.name}: stale artwork URL`);
    assert.ok(content.length < 150_000, `${f.name}: oversized card artwork`);
  });
});
