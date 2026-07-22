export type StackSlot = {
  layer: number;
  x: number;
  y: number;
};

type RandomSource = () => number;

const CARD_COVER_WIDTH = 64;
const CARD_COVER_HEIGHT = 72;
const COVER_EPSILON = 0.5;

function shuffled<T>(items: T[], random: RandomSource) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
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
export function buildSafeMatchSequence(groupTiers: number[]) {
  if (groupTiers.length === 0) return [];
  const sequence: number[] = [];
  const [opening, ...remaining] = groupTiers;
  sequence.push(opening, opening, opening);
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
) {
  if (groupTiers.length * 3 !== slots.length)
    throw new Error("三消组数量与牌阵卡位不一致");
  const groups = shuffled(groupTiers, random);
  const route = buildRemovalRoute(slots, random);
  const sequence = buildSafeMatchSequence(groups);
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
