import test from "node:test";
import assert from "node:assert/strict";
import { cardFacesOverlap, touchingFruit } from "./geometry.ts";
import {
  slotIsCovered,
  buildPlayableDeal,
  ensureExposedOpening,
  scatterStackSlots,
} from "./logic.ts";
import { playLayout } from "./layout.ts";
import { LEVELS } from "./data.ts";
import { seededRandom } from "./challenges.ts";

test("only the rounded face blocks: no shadow, padding, corner or tangent coverage", () => {
  const origin = { x: 0, y: 0 };
  assert.equal(cardFacesOverlap(origin, { x: 60, y: 0 }), false);
  assert.equal(cardFacesOverlap(origin, { x: 58, y: 0 }), false);
  assert.equal(cardFacesOverlap(origin, { x: 57.999, y: 0 }), true);
  assert.equal(cardFacesOverlap(origin, { x: 51, y: 59 }), false);
  assert.equal(cardFacesOverlap(origin, { x: 49, y: 56 }), true);
  assert.equal(cardFacesOverlap(origin, { x: 0, y: 66 }), false);
  assert.equal(cardFacesOverlap(origin, { x: 0, y: 65.999 }), true);
});

test("coverage is symmetric under rotations and uses actual drawing order", () => {
  const a = { x: 10, y: 20, rotation: 0.08 },
    b = { x: 67, y: 20, rotation: -0.08 };
  assert.equal(cardFacesOverlap(a, b), true);
  for (let angle = -Math.PI; angle < Math.PI; angle += 0.2) {
    const rotate = (p: typeof a) => ({
      x: p.x * Math.cos(angle) - p.y * Math.sin(angle),
      y: p.x * Math.sin(angle) + p.y * Math.cos(angle),
      rotation: p.rotation + angle,
    });
    assert.equal(
      cardFacesOverlap(rotate(a), rotate(b)),
      cardFacesOverlap(a, b),
    );
    assert.equal(cardFacesOverlap(a, b), cardFacesOverlap(b, a));
  }
  const slots = [
      { ...a, layer: 2 },
      { ...b, layer: 2 },
    ],
    active = new Set([0, 1]);
  assert.equal(slotIsCovered(0, slots, active), true);
  assert.equal(slotIsCovered(1, slots, active), false);
  active.delete(1);
  assert.equal(slotIsCovered(0, slots, active), false);
});

test("automatic fusion requires physical contact, never a nearby or stalled pair", () => {
  assert.equal(
    touchingFruit({ x: 0, y: 0, radius: 20 }, { x: 40, y: 0, radius: 20 }),
    true,
  );
  assert.equal(
    touchingFruit({ x: 0, y: 0, radius: 20 }, { x: 40.1, y: 0, radius: 20 }),
    false,
  );
  assert.equal(
    touchingFruit({ x: 0, y: 0, radius: 20 }, { x: 70, y: 0, radius: 20 }),
    false,
  );
});

test("phone layouts fill their aspect ratio and keep every region inside the canvas", () => {
  for (const [w, h] of [
    [320, 510],
    [390, 786],
    [430, 874],
    [844, 332],
    [568, 262],
    [1024, 768],
  ]) {
    const layout = playLayout(w, h);
    assert.ok(Math.abs(layout.width / layout.height - w / h) < 1e-9);
    for (const region of [layout.stack, layout.tray, layout.box]) {
      assert.ok(
        (region.width > 0 && region.height > 100) || region === layout.tray,
      );
      assert.ok(region.x >= 0 && region.y >= 0);
      assert.ok(
        region.x + region.width <= layout.width &&
          region.y + region.height <= layout.height,
      );
    }
  }
});

test("tilted generated cards keep a legal removal route at compact and tall sizes", () => {
  for (const [w, h] of [
    [320, 510],
    [390, 786],
    [844, 332],
  ]) {
    const layout = playLayout(w, h);
    for (const index of [0, 10, 25, 46])
      for (let seed = 0; seed < 5; seed++) {
        const def = LEVELS[index],
          random = seededRandom(`rotated:${w}:${index}:${seed}`);
        const slots = def.layout
          .flatMap((b) =>
            Array.from({ length: b.rows * b.cols }, (_, i) => ({
              x: b.x + ((i % b.cols) - (b.cols - 1) / 2) * b.sx,
              y: b.y + (Math.floor(i / b.cols) - (b.rows - 1) / 2) * b.sy,
              layer: b.layer,
              rotation: 0,
            })),
          )
          .sort((a, b) => a.layer - b.layer);
        scatterStackSlots(
          slots,
          {
            left: layout.stack.x + 31,
            right: layout.stack.x + layout.stack.width - 31,
            top: layout.stack.y + 52,
            bottom: layout.stack.y + layout.stack.height - 38,
            cardWidth: 58,
            cardHeight: 66,
          },
          random,
        );
        slots.sort((a, b) => a.layer - b.layer);
        slots.forEach((slot) => (slot.rotation = (random() - 0.5) * 0.15));
        const deal = buildPlayableDeal(
          def.cards.flatMap((c) => Array(c.count / 3).fill(c.tier)),
          slots,
          random,
        );
        const active = new Set(slots.map((_, i) => i));
        for (const id of deal.route) {
          assert.equal(slotIsCovered(id, slots, active), false);
          active.delete(id);
        }
        assert.equal(active.size, 0);
      }
  }
});

test("a compact opening never loses its three accessible choices after rotation", () => {
  const slots = Array.from({ length: 6 }, (_, i) => ({
    x: 200,
    y: 140,
    layer: i,
    rotation: 0.08,
  }));
  ensureExposedOpening(slots, {
    left: 43,
    right: 387,
    top: 128,
    bottom: 240,
    cardWidth: 58,
    cardHeight: 66,
  });
  const active = new Set(slots.map((_, i) => i));
  assert.ok(
    slots.filter((_, i) => !slotIsCovered(i, slots, active)).length >= 3,
  );
});
