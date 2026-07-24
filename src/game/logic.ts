export type StackSlot = {
  layer: number;
  x: number;
  y: number;
};

export type RotatedRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

export type FusionCandidate = {
  id: number;
  tier: number;
  x: number;
  y: number;
  linkedId?: number;
  blockedIds?: readonly number[];
};

export type FusionPair = {
  firstId: number;
  secondId: number;
  tier: number;
  distance: number;
  bonded: boolean;
};

type RandomSource = () => number;

export type StackScatterBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  cardWidth: number;
  cardHeight: number;
};

const CARD_COVER_WIDTH = 64;
const CARD_COVER_HEIGHT = 72;
const COVER_EPSILON = 0.5;

/**
 * Uses the same rotated card footprint for visual overlap and interaction
 * locking. Axis-aligned checks make a tilted card appear to cover a neighbour
 * it never touches, which is especially noticeable after a shuffle.
 */
export function rotatedRectanglesOverlap(
  first: RotatedRect,
  second: RotatedRect,
  epsilon = COVER_EPSILON,
) {
  const corners = ({ x, y, width, height, rotation }: RotatedRect) => {
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    return [
      [-width / 2, -height / 2],
      [width / 2, -height / 2],
      [width / 2, height / 2],
      [-width / 2, height / 2],
    ].map(([localX, localY]) => ({
      x: x + localX * cosine - localY * sine,
      y: y + localX * sine + localY * cosine,
    }));
  };
  const firstCorners = corners(first);
  const secondCorners = corners(second);
  const polygons = [firstCorners, secondCorners];

  for (const polygon of polygons) {
    for (let index = 0; index < polygon.length; index += 1) {
      const point = polygon[index];
      const next = polygon[(index + 1) % polygon.length];
      const axis = { x: -(next.y - point.y), y: next.x - point.x };
      const magnitude = Math.hypot(axis.x, axis.y);
      const unitAxis = { x: axis.x / magnitude, y: axis.y / magnitude };
      const project = (cornersToProject: typeof firstCorners) => {
        const values = cornersToProject.map(
          (corner) => corner.x * unitAxis.x + corner.y * unitAxis.y,
        );
        return { min: Math.min(...values), max: Math.max(...values) };
      };
      const firstProjection = project(firstCorners);
      const secondProjection = project(secondCorners);
      if (
        firstProjection.max <= secondProjection.min + epsilon ||
        secondProjection.max <= firstProjection.min + epsilon
      )
        return false;
    }
  }
  return true;
}

function shuffled<T>(items: T[], random: RandomSource) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

/**
 * Turns authored grids into one of eight organic stack silhouettes. Variation is
 * correlated by layer (fan, cascade, split, wave, stagger, orbit or broken
 * clusters) instead of being pure per-card noise, so the result feels
 * shuffled but still designed.
 */
export function scatterStackSlots(
  slots: StackSlot[],
  bounds: StackScatterBounds,
  random: RandomSource = Math.random,
) {
  if (slots.length === 0) return slots;
  // 将大平层拆成互相咬合的微层。上层数量增加，但每张牌仍沿可验证的移除路线开放，
  // 视觉上更像真实随手叠起的牌堆，而不是一张铺开的表格。
  const layerCounts = new Map<number, number>();
  const topAuthoredLayer = Math.max(...slots.map((slot) => slot.layer));
  slots.forEach((slot) => {
    const authoredLayer = slot.layer;
    const order = layerCounts.get(slot.layer) || 0;
    layerCounts.set(slot.layer, order + 1);
    const fork = (order + Math.floor(random() * 3)) % 2;
    slot.layer =
      authoredLayer * 2 + (authoredLayer === topAuthoredLayer ? 1 : fork);
  });
  const mirrorX = random() < 0.5;
  const mirrorY = random() < 0.28;
  const motif = Math.floor(random() * 8);
  const maxLayer = Math.max(...slots.map((slot) => slot.layer));
  const centerX = (bounds.left + bounds.right) / 2;
  const centerY = (bounds.top + bounds.bottom) / 2;
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  const intensity = 0.9 + random() * 0.55;
  const rotation = (random() - 0.5) * 0.22;
  const twist = (random() - 0.5) * 0.04;
  const shear = (random() - 0.5) * 0.18;
  const wave = (random() - 0.5) * 22;
  const globalDx = (random() - 0.5) * 30;
  const globalDy = (random() - 0.5) * 20;
  const layerDrift = new Map<
    number,
    {
      dx: number;
      dy: number;
      phase: number;
      scaleX: number;
      scaleY: number;
      ripple: number;
      notch: number;
    }
  >();

  new Set(slots.map((slot) => slot.layer)).forEach((layer) =>
    layerDrift.set(layer, {
      dx: (random() - 0.5) * 48,
      dy: (random() - 0.5) * 34,
      phase: random() * Math.PI * 2,
      scaleX: 0.9 + random() * 0.2,
      scaleY: 0.9 + random() * 0.18,
      ripple: (random() - 0.5) * 20,
      notch: (random() - 0.5) * 18,
    }),
  );

  slots.forEach((slot) => {
    if (mirrorX) slot.x = centerX * 2 - slot.x;
    if (mirrorY) slot.y = centerY * 2 - slot.y;
    const layerOffset = slot.layer - maxLayer / 2;
    const angle = rotation + layerOffset * twist;
    const originalX = slot.x - centerX;
    const originalY = slot.y - centerY;
    slot.x =
      centerX + originalX * Math.cos(angle) - originalY * Math.sin(angle);
    slot.y =
      centerY + originalX * Math.sin(angle) + originalY * Math.cos(angle);
    slot.x += (slot.y - centerY) * shear;
    slot.y += Math.sin(slot.x / 43 + slot.layer * 1.17) * wave;

    const drift = layerDrift.get(slot.layer)!;
    slot.x = centerX + (slot.x - centerX) * drift.scaleX;
    slot.y = centerY + (slot.y - centerY) * drift.scaleY;
    const localX = (slot.x - centerX) / Math.max(1, width / 2);
    const localY = (slot.y - centerY) / Math.max(1, height / 2);
    slot.y += Math.sin(localX * Math.PI * 1.7 + drift.phase) * drift.ripple;
    if (Math.abs(localX) < 0.28)
      slot.x += Math.sign(localY || 1) * drift.notch;

    const side = slot.x < centerX ? -1 : 1;
    switch (motif) {
      case 0: // fan
        slot.x += layerOffset * 13 * intensity;
        slot.y += Math.abs(slot.x - centerX) * 0.045 * intensity;
        break;
      case 1: // cascade
        slot.x += layerOffset * 8 * intensity;
        slot.y += layerOffset * 5.5 * intensity;
        break;
      case 2: // split wings
        slot.x += side * (5 + (slot.layer % 3) * 6) * intensity;
        slot.y -= Math.abs(slot.x - centerX) * 0.035 * intensity;
        break;
      case 3: // ribbon wave
        slot.x += Math.sin(slot.layer * 1.63) * 18 * intensity;
        slot.y += Math.cos(slot.layer * 1.21 + slot.x / 82) * 10 * intensity;
        break;
      case 4: // alternating stair
        slot.x += (slot.layer % 2 ? 1 : -1) * (9 + slot.layer * 2) * intensity;
        slot.y += layerOffset * 3.5 * intensity;
        break;
      case 5: { // loose orbit
        const orbit = (slot.layer % 4) * (Math.PI / 2) + random() * 0.35;
        slot.x += Math.cos(orbit) * (7 + slot.layer * 2.1) * intensity;
        slot.y += Math.sin(orbit) * (5 + slot.layer * 1.4) * intensity;
        break;
      }
      case 6: // broken terraces
        slot.x += (localY > 0 ? 1 : -1) * (8 + Math.abs(layerOffset) * 5);
        slot.y += (localX > 0 ? -1 : 1) * (6 + (slot.layer % 3) * 4);
        break;
      default: // clustered pockets
        slot.x += Math.sign(localX || 1) * (10 + (slot.layer % 2) * 8);
        slot.y += Math.sign(localY || 1) * (5 + (slot.layer % 3) * 3);
        break;
    }

    slot.x +=
      globalDx +
      drift.dx +
      Math.sin(drift.phase + slot.y / Math.max(1, height)) * 5 +
      (random() - 0.5) * 24;
    slot.y += globalDy + drift.dy + (random() - 0.5) * 20;
    slot.x = clamp(slot.x, bounds.left, bounds.right);
    slot.y = clamp(slot.y, bounds.top, bounds.bottom);
  });

  // Keep cards on the same authored layer from visually sitting on each other;
  // cross-layer overlap is intentional and is what creates the puzzle.
  const minX = bounds.cardWidth + 3;
  const minY = bounds.cardHeight + 3;
  for (let pass = 0; pass < 32; pass += 1) {
    let moved = false;
    for (let firstIndex = 0; firstIndex < slots.length; firstIndex += 1)
      for (
        let secondIndex = firstIndex + 1;
        secondIndex < slots.length;
        secondIndex += 1
      ) {
        const first = slots[firstIndex];
        const second = slots[secondIndex];
        if (first.layer !== second.layer) continue;
        const overlapX = minX - Math.abs(first.x - second.x);
        const overlapY = minY - Math.abs(first.y - second.y);
        if (overlapX <= 0 || overlapY <= 0) continue;
        moved = true;
        if (overlapX < overlapY) {
          const direction = first.x <= second.x ? -1 : 1;
          const push = overlapX / 2 + 1;
          first.x += direction * push;
          second.x -= direction * push;
        } else {
          const direction = first.y <= second.y ? -1 : 1;
          const push = overlapY / 2 + 1;
          first.y += direction * push;
          second.y -= direction * push;
        }
        first.x = clamp(first.x, bounds.left, bounds.right);
        first.y = clamp(first.y, bounds.top, bounds.bottom);
        second.x = clamp(second.x, bounds.left, bounds.right);
        second.y = clamp(second.y, bounds.top, bounds.bottom);
      }
    if (!moved) break;
  }

  // 复杂微层仍必须给玩家至少三张开局选择。若随机构图把顶层收得过窄，
  // 从高层挑三张互不重叠的牌提升为一个新的开放冠层。
  const active = new Set(slots.map((_, index) => index));
  const exposed = slots.filter(
    (_, index) => !slotIsCovered(index, slots, active),
  );
  if (exposed.length < 3) {
    const promoted: StackSlot[] = [];
    [...slots]
      .sort((a, b) => b.layer - a.layer)
      .some((slot) => {
        const clear = promoted.every(
          (other) =>
            Math.abs(slot.x - other.x) >= minX ||
            Math.abs(slot.y - other.y) >= minY,
        );
        if (clear) promoted.push(slot);
        return promoted.length === 3;
      });
    if (promoted.length === 3) {
      const crownLayer = Math.max(...slots.map((slot) => slot.layer)) + 2;
      promoted.forEach((slot) => {
        slot.layer = crownLayer;
      });
    }
  }
  return slots;
}

export function slotIsCovered(
  index: number,
  slots: StackSlot[],
  active: ReadonlySet<number>,
) {
  const slot = slots[index];
  return slots.some((other, otherIndex) => {
    if (
      otherIndex === index ||
      !active.has(otherIndex) ||
      other.layer <= slot.layer
    )
      return false;
    const overlapX = Math.max(
      0,
      CARD_COVER_WIDTH - Math.abs(other.x - slot.x),
    );
    const overlapY = Math.max(
      0,
      CARD_COVER_HEIGHT - Math.abs(other.y - slot.y),
    );
    return overlapX > COVER_EPSILON && overlapY > COVER_EPSILON;
  });
}

/**
 * Builds one legal top-to-bottom route through a shuffled stack. The first
 * three picks are all exposed at the start, so the opening match is visible
 * rather than hidden behind a forced tutorial.
 */
export function buildRemovalRoute(
  slots: StackSlot[],
  random: RandomSource = Math.random,
) {
  const active = new Set(slots.map((_, index) => index));
  const route: number[] = [];
  const exposed = () =>
    [...active].filter((index) => !slotIsCovered(index, slots, active));

  const opening = shuffled(exposed(), random).slice(0, 3);
  if (opening.length < 3)
    throw new Error("牌阵开局至少需要三张同时可选的卡片");
  for (const index of opening) {
    active.delete(index);
    route.push(index);
  }

  while (active.size > 0) {
    const choices = exposed();
    if (choices.length === 0)
      throw new Error("牌阵没有可移除的顶层卡，请检查层级布局");
    // 偶尔深入刚揭开的路径，偶尔横向清理；既保留变化，也不制造死局。
    const highestLayer = Math.max(...choices.map((index) => slots[index].layer));
    const focused = choices.filter(
      (index) => slots[index].layer >= highestLayer - (random() < 0.7 ? 0 : 1),
    );
    const index = focused[Math.floor(random() * focused.length)];
    active.delete(index);
    route.push(index);
  }
  return route;
}

/**
 * Weaves match groups in pairs (A B A B A B). Following the verified route
 * never needs more than four tray slots, while visible alternatives still let
 * the player trade safety for a faster reveal.
 */
export function buildSafeMatchSequence(
  groupTiers: number[],
  easyOpening = true,
) {
  if (groupTiers.length === 0) return [];
  const sequence: number[] = [];
  const remaining = [...groupTiers];
  if (easyOpening) {
    const opening = remaining.shift()!;
    sequence.push(opening, opening, opening);
  }
  for (let index = 0; index < remaining.length; index += 2) {
    const first = remaining[index];
    const second = remaining[index + 1];
    if (second === undefined) sequence.push(first, first, first);
    else sequence.push(first, second, first, second, first, second);
  }
  return sequence;
}

export function buildPlayableDeal(
  groupTiers: number[],
  slots: StackSlot[],
  random: RandomSource = Math.random,
  easyOpening = true,
) {
  if (groupTiers.length * 3 !== slots.length)
    throw new Error("三消组数量与牌阵卡位不一致");
  const groups = shuffled(groupTiers, random);
  if (!easyOpening && groups.length > 1 && groups[0] === groups[1]) {
    const different = groups.findIndex((tier, index) => index > 1 && tier !== groups[0]);
    if (different >= 0) [groups[1], groups[different]] = [groups[different], groups[1]];
  }
  const route = buildRemovalRoute(slots, random);
  const sequence = buildSafeMatchSequence(groups, easyOpening);
  const tiers = new Array(slots.length).fill(0);
  route.forEach((slotIndex, order) => {
    tiers[slotIndex] = sequence[order];
  });
  return {
    tiers,
    route,
    openingSlots: new Set(route.slice(0, 3)),
  };
}

export function simulateTray(sequence: number[]) {
  const tray: number[] = [];
  let maxSize = 0;
  for (const tier of sequence) {
    const groupIndex = tray.lastIndexOf(tier);
    if (groupIndex >= 0) tray.splice(groupIndex + 1, 0, tier);
    else tray.push(tier);
    const count = tray.filter((item) => item === tier).length;
    if (count >= 3) {
      let removed = 0;
      for (let index = tray.length - 1; index >= 0 && removed < 3; index -= 1)
        if (tray[index] === tier) {
          tray.splice(index, 1);
          removed += 1;
        }
    }
    maxSize = Math.max(maxSize, tray.length);
  }
  return { remaining: tray, maxSize };
}

export function fruitBatchCount(
  greenhouseLevel = 0,
  bonus = 0,
) {
  return Math.max(
    1,
    Math.min(3, 1 + Math.floor(greenhouseLevel) + Math.floor(bonus)),
  );
}

export function endlessSeedTier(wave: number, fruitCount: number) {
  const safeWave = Math.max(1, Math.floor(wave));
  const safeFruitCount = Math.max(1, Math.floor(fruitCount));
  if (safeWave < 3 || safeFruitCount < 4) return null;
  return Math.min(safeFruitCount - 3, 2 + Math.floor(safeWave * 0.9));
}

export function fusionRevealScale(progress: number) {
  const reveal = Math.max(0, Math.min(1, progress));
  const eased = 1 - (1 - reveal) ** 3;
  return 0.72 + eased * 0.28;
}

export function fusionResultScale(progress: number, usesImage: boolean) {
  return usesImage ? 1 : fusionRevealScale(progress);
}

export function fruitVisualDiameter(radius: number, usesImage: boolean) {
  return Math.max(18, radius * (usesImage ? 1.58 : 1.72));
}

export function storyHarvestComplete({
  targetAchieved,
  remainingCards,
  trayCount,
  trayLimit,
}: {
  targetAchieved: boolean;
  remainingCards: number;
  trayCount: number;
  trayLimit: number;
}) {
  return (
    targetAchieved &&
    (Math.max(0, remainingCards) === 0 ||
      Math.max(0, trayCount) >= Math.max(1, trayLimit))
  );
}

export function dropLaneX(
  lane: -1 | 0 | 1,
  center = 215,
  laneGap = 92,
) {
  return center + lane * laneGap;
}

export function canMergeAfterLanding(
  firstLandedAt: number | undefined,
  secondLandedAt: number | undefined,
  elapsed: number,
  settleDelay = 0.08,
) {
  return (
    firstLandedAt !== undefined &&
    secondLandedAt !== undefined &&
    elapsed - firstLandedAt >= settleDelay &&
    elapsed - secondLandedAt >= settleDelay
  );
}

export function calculateCoinReward({
  score,
  mode,
  wave,
  won,
  coinLevel = 0,
  goldRain = false,
}: {
  score: number;
  mode: "story" | "endless" | "expedition";
  wave: number;
  won: boolean;
  coinLevel?: number;
  goldRain?: boolean;
}) {
  // 分数随高阶水果指数增长，果币改用对数曲线，避免后期一局跳过整段养成。
  const scoreCoins = Math.min(
    24,
    Math.floor(Math.log10(Math.max(0, score) + 1) * 3),
  );
  const progress =
    mode === "endless" ? wave * 3 : mode === "expedition" ? wave * 5 : 0;
  const base = scoreCoins + progress + (won ? 8 : 2);
  const bonus =
    (1 + 0.12 * Math.max(0, Math.min(3, coinLevel))) *
    (goldRain ? 1.25 : 1);
  return Math.max(1, Math.round(base * bonus));
}

export function comboScoreMultiplier(combo: number) {
  const safeCombo = Math.max(1, Math.floor(combo));
  const earlySteps = Math.min(5, safeCombo - 1);
  const longChainSteps = Math.min(5, Math.max(0, safeCombo - 6));
  const masterySteps = Math.max(0, safeCombo - 11);
  return Math.min(
    2.6,
    1 + earlySteps * 0.18 + longChainSteps * 0.1 + masterySteps * 0.04,
  );
}

export function challengeScoreMultiplier({
  mode,
  level,
  wave = 1,
}: {
  mode: "story" | "endless" | "expedition";
  level: number;
  wave?: number;
}) {
  if (mode === "story") return 1 + Math.max(0, level) * 0.055;
  if (mode === "endless")
    return 1 + Math.min(24, Math.max(0, wave - 1)) * 0.035;
  return 1 + Math.min(7, Math.max(0, wave - 1)) * 0.07;
}

export function cardMatchScore({
  tier,
  combo,
  mode,
  level,
  wave = 1,
}: {
  tier: number;
  combo: number;
  mode: "story" | "endless" | "expedition";
  level: number;
  wave?: number;
}) {
  const safeTier = Math.max(0, tier);
  const fruitValue = 120 + safeTier * 68 + safeTier ** 2 * 10;
  return Math.round(
    fruitValue *
      comboScoreMultiplier(combo) *
      challengeScoreMultiplier({ mode, level, wave }),
  );
}

export function fruitMergeScore({
  tier,
  combo,
  mode,
  level,
  wave = 1,
}: {
  tier: number;
  combo: number;
  mode: "story" | "endless" | "expedition";
  level: number;
  wave?: number;
}) {
  const safeTier = Math.max(1, tier);
  // 50 级链需要持续奖励升级，但指数过高会让末段分数压倒连击与关卡表现。
  const fruitValue = 260 * (safeTier + 1) ** 1.86;
  return Math.round(
    fruitValue *
      comboScoreMultiplier(combo) *
      challengeScoreMultiplier({ mode, level, wave }),
  );
}

export function completionScoreBonus({
  level,
  mode,
  wave,
  remainingCards,
  openTraySlots,
  maxCombo,
  maxFruitTier,
}: {
  level: number;
  mode: "story" | "endless" | "expedition";
  wave: number;
  remainingCards: number;
  openTraySlots: number;
  maxCombo: number;
  maxFruitTier: number;
}) {
  const challenge = challengeScoreMultiplier({ mode, level, wave });
  const clearValue =
    900 +
    (Math.max(0, level) + 1) * 520 +
    Math.max(0, maxFruitTier) * 170;
  const efficiency =
    Math.max(0, remainingCards) * 42 +
    Math.max(0, openTraySlots) * 150 +
    Math.max(0, maxCombo) * 95;
  return Math.round((clearValue + efficiency) * challenge);
}

/**
 * Gives every fruit at most one fusion partner. Explicit card-created bonds
 * win first, then the remaining fruit are paired by shortest distance. This
 * avoids the cancelling forces produced by attracting every equal-tier pair.
 */
export function buildFusionPairs(candidates: FusionCandidate[]) {
  const groups = new Map<number, FusionCandidate[]>();
  candidates.forEach((candidate) => {
    const group = groups.get(candidate.tier) || [];
    group.push(candidate);
    groups.set(candidate.tier, group);
  });

  const result: FusionPair[] = [];
  groups.forEach((group, tier) => {
    const remaining = [...group];
    while (remaining.length >= 2) {
      let bestFirst = 0;
      let bestSecond = -1;
      let bestDistance = Number.POSITIVE_INFINITY;
      let bestBonded = false;
      for (let first = 0; first < remaining.length; first += 1)
        for (let second = first + 1; second < remaining.length; second += 1) {
          const a = remaining[first];
          const b = remaining[second];
          if (a.blockedIds?.includes(b.id) || b.blockedIds?.includes(a.id))
            continue;
          const bonded = a.linkedId === b.id || b.linkedId === a.id;
          const distance = Math.hypot(a.x - b.x, a.y - b.y);
          if (
            (bonded && !bestBonded) ||
            (bonded === bestBonded && distance < bestDistance)
          ) {
            bestFirst = first;
            bestSecond = second;
            bestDistance = distance;
            bestBonded = bonded;
          }
        }
      if (bestSecond < 0) break;
      const first = remaining[bestFirst];
      const second = remaining[bestSecond];
      result.push({
        firstId: first.id,
        secondId: second.id,
        tier,
        distance: bestDistance,
        bonded: bestBonded,
      });
      remaining.splice(bestSecond, 1);
      remaining.splice(bestFirst, 1);
    }
  });
  return result;
}
