import assert from "node:assert/strict";
import test from "node:test";
import { FRUITS, LEVELS, WORLD, type LayoutBlock } from "./data.ts";
import {
  buildFusionPairs,
  buildPlayableDeal,
  calculateCoinReward,
  canMergeAfterLanding,
  cardMatchScore,
  comboScoreMultiplier,
  completionScoreBonus,
  dropLaneX,
  fruitBatchCount,
  fruitMergeScore,
  rotatedRectanglesOverlap,
  scatterStackSlots,
  simulateTray,
  slotIsCovered,
} from "./logic.ts";
import {
  MODE_INFO,
  MUTATORS,
  RELICS,
  TOOLS,
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
    return overlapX > 0.5 && overlapY > 0.5;
  });
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

test("a lower card is locked by even a slight upper overlap", () => {
  const lower = { layer: 0, x: 100, y: 100 };
  assert.equal(
    isCovered(lower, [lower, { layer: 1, x: 100 + CARD_WIDTH - 1, y: 100 }]),
    true,
  );
  assert.equal(
    isCovered(lower, [lower, { layer: 1, x: 100 + CARD_WIDTH, y: 100 }]),
    false,
  );
});

test("rotated card coverage follows the visible footprint", () => {
  assert.equal(
    rotatedRectanglesOverlap(
      { x: 100, y: 100, width: 64, height: 72, rotation: Math.PI / 4 },
      { x: 100, y: 100, width: 64, height: 72, rotation: -Math.PI / 5 },
    ),
    true,
  );
  // 两张倾斜牌的外接矩形仍会相碰，但真实牌面之间留有空隙，不应锁住。
  assert.equal(
    rotatedRectanglesOverlap(
      { x: 100, y: 100, width: 64, height: 72, rotation: Math.PI / 4 },
      { x: 166, y: 166, width: 64, height: 72, rotation: -Math.PI / 4 },
    ),
    false,
  );
});

test("all story levels have valid, playable layouts", () => {
  assert.equal(LEVELS.length, 20);

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
    for (let tier = 0; tier < level.target; tier += 1)
      synthesis[tier + 1] += Math.floor(synthesis[tier] / 2);

    assert.equal(
      slots.length,
      cardCount,
      `第 ${index + 1} 关卡位数必须等于卡片数`,
    );
    assert.ok(exposedCount >= 3, `第 ${index + 1} 关开局至少需要三张可点卡`);
    assert.ok(layerCount >= 3, `第 ${index + 1} 关必须有明显堆叠`);
    assert.equal(level.target, index + 3, `第 ${index + 1} 关目标必须逐级 +1`);
    assert.equal(
      level.target,
      maxCardTier + 1,
      `第 ${index + 1} 关必须通过碰撞合成目标`,
    );
    assert.ok(
      synthesis[level.target] >= 1,
      `第 ${index + 1} 关水果阶梯不足以合成目标`,
    );
    assert.deepEqual(
      level.cards.map((card) => card.tier),
      Array.from({ length: level.target }, (_, tier) => tier),
      `第 ${index + 1} 关必须从蓝莓开始并包含完整合成链`,
    );

    level.cards.forEach((card) => {
      assert.equal(
        card.count % 3,
        0,
        `第 ${index + 1} 关每种卡片数量必须是 3 的倍数`,
      );
      assert.ok(card.tier >= 0 && card.tier < FRUITS.length);
    });

    slots.forEach((slot) => {
      assert.ok(
        slot.x - CARD_WIDTH / 2 >= WORLD.stack.x,
        `第 ${index + 1} 关卡片超出左边界`,
      );
      assert.ok(
        slot.x + CARD_WIDTH / 2 <= WORLD.stack.x + WORLD.stack.width,
        `第 ${index + 1} 关卡片超出右边界`,
      );
      assert.ok(
        slot.y - CARD_HEIGHT / 2 >= WORLD.stack.y,
        `第 ${index + 1} 关卡片超出上边界`,
      );
      assert.ok(
        slot.y + CARD_HEIGHT / 2 <= WORLD.stack.y + WORLD.stack.height,
        `第 ${index + 1} 关卡片超出下边界`,
      );
    });
  });
});

test("every generated stack contains a verified low-risk clear route", () => {
  LEVELS.forEach((level, levelIndex) => {
    const groups = level.cards.flatMap(({ tier, count }) =>
      Array.from({ length: count / 3 }, () => tier),
    );
    for (let seed = 1; seed <= 16; seed += 1) {
      const original = expandLayout(level.layout);
      const slots = original.map((slot) => ({ ...slot }));
      const random = seededRandom(levelIndex * 100 + seed);
      scatterStackSlots(
        slots,
        {
          left: 46,
          right: WORLD.width - 46,
          top: WORLD.stack.y + 52,
          bottom: WORLD.stack.y + WORLD.stack.height - 38,
          cardWidth: CARD_WIDTH,
          cardHeight: CARD_HEIGHT,
        },
        random,
      );
      const deal = buildPlayableDeal(groups, slots, random, levelIndex < 2);
      const averageMovement =
        slots.reduce(
          (total, slot, index) =>
            total +
            Math.hypot(slot.x - original[index].x, slot.y - original[index].y),
          0,
        ) / slots.length;
      const independentlyShifted = slots.filter(
        (slot, index) =>
          Math.abs(slot.x - original[index].x) >= 8 ||
          Math.abs(slot.y - original[index].y) >= 8,
      ).length;
      assert.ok(averageMovement >= 12, "随机牌阵需要形成可感知的构图变化");
      assert.ok(
        independentlyShifted / slots.length >= 0.68,
        "大部分卡片都需要脱离原始网格位置",
      );
      slots.forEach((slot) => {
        assert.ok(slot.x >= 46 && slot.x <= WORLD.width - 46);
        assert.ok(
          slot.y >= WORLD.stack.y + 52 &&
            slot.y <= WORLD.stack.y + WORLD.stack.height - 38,
        );
      });
      for (let firstIndex = 0; firstIndex < slots.length; firstIndex += 1)
        for (
          let secondIndex = firstIndex + 1;
          secondIndex < slots.length;
          secondIndex += 1
        ) {
          const first = slots[firstIndex];
          const second = slots[secondIndex];
          if (first.layer !== second.layer) continue;
          assert.ok(
            Math.abs(first.x - second.x) >= CARD_WIDTH + 2.5 ||
              Math.abs(first.y - second.y) >= CARD_HEIGHT + 2.5,
            `第 ${levelIndex + 1} 关同层卡片不应互相遮挡`,
          );
        }
      const active = new Set(slots.map((_, index) => index));
      deal.route.forEach((slotIndex) => {
        assert.equal(
          slotIsCovered(slotIndex, slots, active),
          false,
          `第 ${levelIndex + 1} 关路线必须只移除顶层卡`,
        );
        active.delete(slotIndex);
      });
      const sequence = deal.route.map((slotIndex) => deal.tiers[slotIndex]);
      const tray = simulateTray(sequence);
      assert.deepEqual(tray.remaining, []);
      assert.ok(tray.maxSize <= 4, "安全路线最多占用四个卡槽");
      assert.equal(
        new Set(sequence.slice(0, 3)).size,
        levelIndex < 2 ? 1 : 2,
        "前两关直接教学三消，后续关卡用双组交织开局",
      );
    }
  });
});

test("greenhouse fruit output is deterministic and capped at three", () => {
  assert.equal(fruitBatchCount(), 1);
  assert.equal(fruitBatchCount(1), 2);
  assert.equal(fruitBatchCount(2), 3);
  assert.equal(fruitBatchCount(4), 3);
  assert.equal(fruitBatchCount(1, 2), 3);
  assert.equal(fruitBatchCount(-2, -2), 1);
});

test("drop lanes are symmetric and stay inside the fruit box", () => {
  assert.deepEqual(
    ([-1, 0, 1] as const).map((lane) => dropLaneX(lane)),
    [123, 215, 307],
  );
  ([-1, 0, 1] as const).forEach((lane) => {
    const x = dropLaneX(lane);
    assert.ok(x - FRUITS.at(-1)!.radius >= WORLD.box.x);
    assert.ok(x + FRUITS.at(-1)!.radius <= WORLD.box.x + WORLD.box.width);
  });
});

test("fruit can only merge after both pieces have landed and settled", () => {
  assert.equal(canMergeAfterLanding(undefined, 0.2, 1), false);
  assert.equal(canMergeAfterLanding(0.2, undefined, 1), false);
  assert.equal(canMergeAfterLanding(0.94, 0.8, 1), false);
  assert.equal(canMergeAfterLanding(0.9, 0.8, 1), true);
});

test("coin rewards grow slowly even when score grows exponentially", () => {
  assert.equal(
    calculateCoinReward({
      score: 0,
      mode: "story",
      wave: 1,
      won: false,
    }),
    2,
  );
  assert.equal(
    calculateCoinReward({
      score: 10_000,
      mode: "story",
      wave: 1,
      won: true,
    }),
    20,
  );
  assert.ok(
    calculateCoinReward({
      score: 10_000_000,
      mode: "story",
      wave: 1,
      won: true,
    }) <= 32,
  );
  assert.equal(
    calculateCoinReward({
      score: 10_000,
      mode: "story",
      wave: 1,
      won: true,
      coinLevel: 3,
      goldRain: true,
    }),
    34,
  );
});

test("score curve rewards fruit progress, challenge and skill without runaway spikes", () => {
  assert.equal(comboScoreMultiplier(1), 1);
  assert.ok(comboScoreMultiplier(6) > comboScoreMultiplier(3));
  assert.ok(comboScoreMultiplier(30) <= 2.6);

  const earlyMatch = cardMatchScore({
    tier: 0,
    combo: 1,
    mode: "story",
    level: 0,
  });
  const lateMatch = cardMatchScore({
    tier: 12,
    combo: 5,
    mode: "story",
    level: 15,
  });
  assert.ok(lateMatch > earlyMatch * 10);

  const mergeScores = Array.from({ length: FRUITS.length - 1 }, (_, index) =>
    fruitMergeScore({
      tier: index + 1,
      combo: 1,
      mode: "story",
      level: 0,
    }),
  );
  mergeScores.forEach((score, index) => {
    if (index > 0) assert.ok(score > mergeScores[index - 1]);
  });
  assert.ok(mergeScores.at(-1)! < mergeScores[0] * 500);

  const cleanFinish = completionScoreBonus({
    level: 8,
    mode: "story",
    wave: 1,
    remainingCards: 9,
    openTraySlots: 6,
    maxCombo: 7,
    maxFruitTier: 11,
  });
  const messyFinish = completionScoreBonus({
    level: 8,
    mode: "story",
    wave: 1,
    remainingCards: 0,
    openTraySlots: 1,
    maxCombo: 2,
    maxFruitTier: 11,
  });
  assert.ok(cleanFinish > messyFinish);
});

test("fusion planning keeps one partner per fruit and prioritizes card bonds", () => {
  const pairs = buildFusionPairs([
    { id: 1, tier: 0, x: 0, y: 0, linkedId: 3 },
    { id: 2, tier: 0, x: 4, y: 0 },
    { id: 3, tier: 0, x: 80, y: 0 },
    { id: 4, tier: 0, x: 84, y: 0 },
    { id: 5, tier: 1, x: 0, y: 0 },
    { id: 6, tier: 1, x: 6, y: 0 },
    { id: 7, tier: 2, x: 0, y: 0, blockedIds: [8] },
    { id: 8, tier: 2, x: 2, y: 0, blockedIds: [7] },
    { id: 9, tier: 2, x: 9, y: 0 },
  ]);
  assert.deepEqual(
    pairs.map(({ firstId, secondId, bonded }) => [firstId, secondId, bonded]),
    [
      [1, 3, true],
      [2, 4, false],
      [5, 6, false],
      [8, 9, false],
    ],
  );
  assert.equal(
    new Set(pairs.flatMap((pair) => [pair.firstId, pair.secondId])).size,
    pairs.length * 2,
  );
});

test("fruit scale and roguelike catalog stay balanced", () => {
  assert.equal(FRUITS.length, 23);
  assert.deepEqual(
    FRUITS.slice(-5).map((fruit) => fruit.name),
    ["火龙果", "哈密瓜", "南瓜", "西瓜", "黄金果王"],
  );
  FRUITS.forEach((fruit, index) => {
    assert.ok(fruit.radius <= 60, `${fruit.name} 不应重新撑满果箱`);
    if (index > 0) assert.ok(fruit.radius > FRUITS[index - 1].radius);
  });
  assert.equal(new Set(RELICS.map((relic) => relic.id)).size, RELICS.length);
  assert.equal(RELICS.length, 22);
  assert.ok(RELICS.some((relic) => relic.rarity === "rare"));
  assert.equal(MUTATORS.length, 7);
  assert.ok(MUTATORS.every((mutator) => mutator.description.length > 0));
  assert.equal(UPGRADES.length, 10);
  assert.equal(TOOLS.length, 14);
  assert.equal(new Set(TOOLS.map((tool) => tool.id)).size, TOOLS.length);
  assert.ok(
    TOOLS.every(
      (tool) =>
        tool.costs.length === tool.maxLevel &&
        tool.costs.every(
          (cost, index) => index === 0 || cost > tool.costs[index - 1],
        ),
    ),
    "道具的每局携带次数必须逐级涨价",
  );
  const harvestUpgrade = UPGRADES.find(
    (upgrade) => upgrade.id === "sweet_start",
  );
  assert.equal(harvestUpgrade?.maxLevel, 2);
  assert.deepEqual(harvestUpgrade?.costs, [850, 2800]);
  assert.ok(
    Array.from({ length: 40 }, () => rollMutator(2)).every(
      (item) => item.id !== "calm",
    ),
  );
  assert.deepEqual(Object.keys(MODE_INFO).sort(), [
    "endless",
    "expedition",
    "story",
  ]);
  assert.equal(new Set(pickRelics([], 3).map((relic) => relic.id)).size, 3);
  assert.ok(
    pickRelics([], 3, 3, () => 0.99).some((relic) => relic.rarity === "rare"),
    "每三关的构筑奖励至少出现一件稀有奇物",
  );
  assert.equal(
    pickRelics(
      RELICS.slice(0, RELICS.length - 2).map((relic) => relic.id),
      3,
    ).length,
    2,
  );
});
