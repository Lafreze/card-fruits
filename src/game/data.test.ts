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
  endlessSeedTier,
  fruitBatchCount,
  fusionRevealScale,
  fruitMergeScore,
  fruitVisualDiameter,
  rotatedRectanglesOverlap,
  scatterStackSlots,
  simulateTray,
  slotIsCovered,
  storyHarvestComplete,
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
  const active = new Set([0, 1]);
  assert.equal(
    isCovered(lower, [lower, { layer: 1, x: 100 + CARD_WIDTH - 1, y: 100 }]),
    true,
  );
  assert.equal(
    isCovered(lower, [lower, { layer: 1, x: 100 + CARD_WIDTH, y: 100 }]),
    false,
  );
  assert.equal(
    slotIsCovered(0, [lower, { layer: 0, x: 100, y: 100 }], active),
    false,
    "同层卡片只并排展示，不能互相锁住",
  );
  assert.equal(
    slotIsCovered(1, [lower, { layer: 1, x: 100, y: 100 }], active),
    false,
    "下层卡片不能反向遮挡上层卡片",
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
  assert.equal(LEVELS.length, 47);

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
    assert.ok(
      maxCardTier < level.target,
      `第 ${index + 1} 关必须通过碰撞合成目标`,
    );
    assert.equal(
      synthesis[level.target],
      1,
      `第 ${index + 1} 关应刚好合成一个目标果，避免提前结束`,
    );
    assert.equal(
      level.cards.reduce(
        (mass, card) => mass + (card.count / 3) * 2 ** card.tier,
        0,
      ),
      2 ** level.target,
      `第 ${index + 1} 关卡片合成质量必须与目标严格守恒`,
    );
    assert.equal(level.cards[0].tier, 0, `第 ${index + 1} 关必须从蓝莓开始`);

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
    for (let seed = 1; seed <= 32; seed += 1) {
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
      const initiallyCovered = slots.filter((_, slotIndex) =>
        slotIsCovered(slotIndex, slots, active),
      ).length;
      assert.ok(
        initiallyCovered > 0,
        `第 ${levelIndex + 1} 关必须存在真实的跨层遮挡`,
      );
      const topLayer = Math.max(...slots.map((slot) => slot.layer));
      slots.forEach((slot, slotIndex) => {
        if (slot.layer !== topLayer) return;
        assert.equal(
          slotIsCovered(slotIndex, slots, active),
          false,
          `第 ${levelIndex + 1} 关最高层卡片必须可点`,
        );
      });
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

test("endless high-tier seeds are progressive", () => {
  assert.equal(endlessSeedTier(1, FRUITS.length), null);
  assert.equal(endlessSeedTier(2, FRUITS.length), null);
  assert.equal(endlessSeedTier(3, FRUITS.length), 4);
  assert.ok(endlessSeedTier(10, FRUITS.length)! >= 11);
  assert.equal(endlessSeedTier(50, FRUITS.length), FRUITS.length - 3);
});

test("fusion reveal stays gentle and story harvest can finish by clear or full tray", () => {
  const revealScales = Array.from({ length: 101 }, (_, index) =>
    fusionRevealScale(index / 100),
  );
  assert.ok(Math.max(...revealScales) <= 1);
  assert.ok(
    revealScales.every(
      (scale, index) => index === 0 || scale >= revealScales[index - 1],
    ),
  );
  assert.equal(fusionRevealScale(1), 1);
  assert.ok(fruitVisualDiameter(40, true) < fruitVisualDiameter(40, false));

  assert.equal(
    storyHarvestComplete({
      targetAchieved: true,
      remainingCards: 0,
      trayCount: 2,
      trayLimit: 7,
    }),
    true,
  );
  assert.equal(
    storyHarvestComplete({
      targetAchieved: true,
      remainingCards: 12,
      trayCount: 7,
      trayLimit: 7,
    }),
    true,
  );
  assert.equal(
    storyHarvestComplete({
      targetAchieved: true,
      remainingCards: 12,
      trayCount: 6,
      trayLimit: 7,
    }),
    false,
  );
  assert.equal(
    storyHarvestComplete({
      targetAchieved: false,
      remainingCards: 0,
      trayCount: 7,
      trayLimit: 7,
    }),
    false,
  );
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
  assert.equal(FRUITS.length, 50);
  assert.deepEqual(
    FRUITS.slice(-12).map((fruit) => fruit.name),
    [
      "柿子",
      "李子",
      "金桔",
      "百香果",
      "龙眼",
      "杨梅",
      "人参果",
      "蛋黄果",
      "刺角瓜",
      "佛手柑",
      "仙人掌果",
      "黄金果王",
    ],
  );
  FRUITS.forEach((fruit, index) => {
    assert.ok(fruit.radius <= 41, `${fruit.name} 不应重新撑满果箱`);
    if (index > 0) {
      assert.ok(fruit.radius > FRUITS[index - 1].radius);
      assert.ok(
        fruit.radius - FRUITS[index - 1].radius <= 2,
        `${fruit.name} 与前一级尺寸差距过大`,
      );
    }
  });
  assert.ok(FRUITS.at(-1)!.radius / FRUITS[0].radius <= 5.2);
  assert.equal(FRUITS.find((fruit) => fruit.name === "香蕉")?.emoji, "");
  assert.equal(
    FRUITS.find((fruit) => fruit.name === "香蕉")?.icon,
    "/fruits/banana-bunch.webp",
  );
  assert.equal(FRUITS.find((fruit) => fruit.name === "西瓜")?.emoji, "");
  assert.equal(
    FRUITS.find((fruit) => fruit.name === "西瓜")?.icon,
    "/fruits/watermelon-whole.webp",
  );
  [
    "石榴",
    "木瓜",
    "菠萝蜜",
    "山竹",
    "杨桃",
    "柚子",
    "无花果",
    "莲雾",
    "荔枝",
    "番石榴",
    "枇杷",
    "释迦",
    "蛇皮果",
    "面包果",
    "可可果",
    "酸角",
    "柿子",
    "李子",
    "金桔",
    "百香果",
    "龙眼",
    "杨梅",
    "人参果",
    "蛋黄果",
    "刺角瓜",
    "佛手柑",
    "仙人掌果",
  ].forEach((name) =>
    assert.ok(FRUITS.find((fruit) => fruit.name === name)?.icon),
  );
  assert.equal(new Set(RELICS.map((relic) => relic.id)).size, RELICS.length);
  assert.equal(RELICS.length, 36);
  assert.ok(RELICS.some((relic) => relic.rarity === "rare"));
  assert.equal(MUTATORS.length, 10);
  assert.ok(MUTATORS.every((mutator) => mutator.description.length > 0));
  assert.equal(UPGRADES.length, 12);
  assert.equal(TOOLS.length, 16);
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
  assert.ok(UPGRADES.some((upgrade) => upgrade.id === "seed_start"));
  assert.ok(UPGRADES.some((upgrade) => upgrade.id === "tray"));
  assert.ok(TOOLS.some((tool) => tool.id === "basket"));
  assert.ok(TOOLS.some((tool) => tool.id === "syrup"));
  [
    "orchard_basket",
    "sugar_kettle",
    "triple_crown",
    "meteor_garden",
    "choice_branch",
    "fruit_pinata",
  ].forEach((id) => assert.ok(RELICS.some((relic) => relic.id === id)));
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
  assert.equal(new Set(pickRelics([], 4).map((relic) => relic.id)).size, 4);
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
