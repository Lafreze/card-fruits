import assert from "node:assert/strict";
import test from "node:test";
import { FRUITS, LEVELS, WORLD, type LayoutBlock } from "./data.ts";
import {
  MODE_INFO,
  MUTATORS,
  RELICS,
  UPGRADES,
  pickRelics,
  rollMutator,
} from "./modes.ts";

const CARD_WIDTH = 58;
const CARD_HEIGHT = 66;

function expandLayout(layout: LayoutBlock[]) {
  return layout.flatMap((block) =>
    Array.from({ length: block.cols * block.rows }, (_, cell) => ({
      layer: block.layer,
      x: block.x + ((cell % block.cols) - (block.cols - 1) / 2) * block.sx,
      y:
        block.y +
        (Math.floor(cell / block.cols) - (block.rows - 1) / 2) * block.sy,
    })),
  );
}

function isCovered(
  slot: ReturnType<typeof expandLayout>[number],
  slots: ReturnType<typeof expandLayout>,
) {
  return slots.some((other) => {
    if (other.layer <= slot.layer) return false;
    const overlapX = Math.max(0, CARD_WIDTH - Math.abs(other.x - slot.x));
    const overlapY = Math.max(0, CARD_HEIGHT - Math.abs(other.y - slot.y));
    return overlapX * overlapY > 300;
  });
}

test("all story levels have valid, playable layouts", () => {
  assert.equal(LEVELS.length, 14);

  LEVELS.forEach((level, index) => {
    const slots = expandLayout(level.layout);
    const cardCount = level.cards.reduce((sum, card) => sum + card.count, 0);
    const exposedCount = slots.filter((slot) => !isCovered(slot, slots)).length;
    const maxCardTier = Math.max(...level.cards.map((card) => card.tier));
    const layerCount = new Set(slots.map((slot) => slot.layer)).size;
    const synthesis = new Array(FRUITS.length).fill(0);
    level.cards.forEach((card) => {
      synthesis[card.tier] += card.count / 3;
    });
    if (index === 0) synthesis[0] += 2;
    for (let tier = 0; tier < level.target; tier += 1)
      synthesis[tier + 1] += Math.floor(synthesis[tier] / 2);

    assert.equal(slots.length, cardCount, `第 ${index + 1} 关卡位数必须等于卡片数`);
    assert.ok(exposedCount >= 3, `第 ${index + 1} 关开局至少需要三张可点卡`);
    assert.ok(layerCount >= 3, `第 ${index + 1} 关必须有明显堆叠`);
    assert.equal(level.target, index + 3, `第 ${index + 1} 关目标必须逐级 +1`);
    assert.equal(level.target, maxCardTier + 1, `第 ${index + 1} 关必须通过碰撞合成目标`);
    assert.ok(synthesis[level.target] >= 1, `第 ${index + 1} 关水果阶梯不足以合成目标`);
    assert.deepEqual(
      level.cards.map((card) => card.tier),
      Array.from({ length: level.target }, (_, tier) => tier),
      `第 ${index + 1} 关必须从蓝莓开始并包含完整合成链`,
    );

    level.cards.forEach((card) => {
      assert.equal(card.count % 3, 0, `第 ${index + 1} 关每种卡片数量必须是 3 的倍数`);
      assert.ok(card.tier >= 0 && card.tier < FRUITS.length);
    });

    slots.forEach((slot) => {
      assert.ok(slot.x - CARD_WIDTH / 2 >= WORLD.stack.x, `第 ${index + 1} 关卡片超出左边界`);
      assert.ok(slot.x + CARD_WIDTH / 2 <= WORLD.stack.x + WORLD.stack.width, `第 ${index + 1} 关卡片超出右边界`);
      assert.ok(slot.y - CARD_HEIGHT / 2 >= WORLD.stack.y, `第 ${index + 1} 关卡片超出上边界`);
      assert.ok(slot.y + CARD_HEIGHT / 2 <= WORLD.stack.y + WORLD.stack.height, `第 ${index + 1} 关卡片超出下边界`);
    });
  });
});

test("fruit scale and roguelike catalog stay balanced", () => {
  assert.equal(FRUITS.length, 17);
  FRUITS.forEach((fruit, index) => {
    assert.ok(fruit.radius <= 60, `${fruit.name} 不应重新撑满果箱`);
    if (index > 0) assert.ok(fruit.radius > FRUITS[index - 1].radius);
  });
  assert.equal(new Set(RELICS.map((relic) => relic.id)).size, RELICS.length);
  assert.equal(RELICS.length, 16);
  assert.equal(MUTATORS.length, 7);
  assert.equal(UPGRADES.length, 5);
  assert.ok(Array.from({ length: 40 }, () => rollMutator(2)).every((item) => item.id !== "calm"));
  assert.deepEqual(Object.keys(MODE_INFO).sort(), ["endless", "expedition", "story"]);
  assert.equal(new Set(pickRelics([], 3).map((relic) => relic.id)).size, 3);
  assert.equal(
    pickRelics(
      RELICS.slice(0, 14).map((relic) => relic.id),
      3,
    ).length,
    2,
  );
});
