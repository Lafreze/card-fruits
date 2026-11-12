import test from "node:test";
import assert from "node:assert/strict";
import { WeatherCycle, WEATHER_EVENTS, insightTargets } from "./events.ts";
import { seededRandom } from "./challenges.ts";

test("weather warns for three seconds, expires cleanly, and never repeats consecutively", () => {
  const cycle = new WeatherCycle(() => 0, 20);
  cycle.tick(16);
  assert.equal(cycle.snapshot(16), null);
  cycle.tick(17);
  assert.equal(cycle.snapshot(17)?.phase, "warning");
  assert.equal(cycle.snapshot(17)?.seconds, 3);
  assert.equal(cycle.active, null);
  cycle.tick(20);
  assert.equal(cycle.snapshot(20)?.id, "breeze");
  assert.equal(cycle.snapshot(20)?.seconds, 10);
  cycle.tick(30);
  assert.equal(cycle.active, null);
  assert.equal(cycle.snapshot(30), null);
  cycle.tick(47);
  assert.notEqual(cycle.snapshot(47)?.id, "breeze");
});

test("paused clock preserves weather and a delayed frame still receives the full warning", () => {
  const cycle = new WeatherCycle(() => 0.5, 30);
  cycle.tick(80);
  assert.equal(cycle.snapshot(80)?.phase, "warning");
  assert.equal(cycle.snapshot(80)?.seconds, 3);
  for (let frame = 0; frame < 120; frame++) cycle.tick(80);
  assert.equal(cycle.snapshot(80)?.seconds, 3);
  cycle.tick(83);
  assert.equal(cycle.snapshot(83)?.phase, "active");
});

test("daily weather is reproducible, isolated from deal randomness, and includes every event", () => {
  const a = new WeatherCycle(seededRandom("daily:weather"), 18);
  const b = new WeatherCycle(seededRandom("daily:weather"), 18);
  const unrelated = seededRandom("daily");
  const seen = new Set();
  for (let second = 0; second < 1000; second++) {
    unrelated();
    unrelated();
    a.tick(second);
    b.tick(second);
    assert.deepEqual(a.snapshot(second), b.snapshot(second));
    if (a.active) seen.add(a.active.id);
  }
  assert.equal(seen.size, WEATHER_EVENTS.length);
});

test("insight prioritizes completing the tray and avoids locked or buried alternatives", () => {
  const cards = [
    { id: 1, tier: 0, covered: 0, locked: false },
    { id: 2, tier: 0, covered: 0, locked: false },
    { id: 3, tier: 0, covered: 0, locked: false },
    { id: 4, tier: 1, covered: 0, locked: false },
    { id: 5, tier: 1, covered: 3, locked: false },
    { id: 6, tier: 1, covered: 0, locked: true },
  ];
  assert.deepEqual(insightTargets(cards, [1, 1]), [4]);
  assert.deepEqual(insightTargets(cards, []), [1, 2, 3]);
  assert.deepEqual(insightTargets(cards.slice(4), []), []);
  assert.deepEqual(insightTargets([], [0, 0]), []);
});
