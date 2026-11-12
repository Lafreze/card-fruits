export const WEATHER_EVENTS = [
  {
    id: "breeze",
    name: "东风",
    icon: "wind",
    hint: "水果向右漂移 · 得分 ×1.2",
    duration: 10,
    drift: 0.2,
    magnet: 1,
    danger: 1,
    score: 1.2,
    gravity: 1,
    damping: 1,
  },
  {
    id: "heat",
    name: "热浪",
    icon: "sun",
    hint: "警戒加速 · 得分 ×1.5",
    duration: 10,
    drift: 0,
    magnet: 1,
    danger: 1.3,
    score: 1.5,
    gravity: 1,
    damping: 1,
  },
  {
    id: "magnetic",
    name: "磁力潮",
    icon: "magnet",
    hint: "同果吸引 ×2",
    duration: 12,
    drift: 0,
    magnet: 2,
    danger: 1,
    score: 1,
    gravity: 1,
    damping: 1,
  },
  {
    id: "drizzle",
    name: "糖霜雨",
    icon: "cloud",
    hint: "水果减速 · 磁力减半 · 得分 ×1.3",
    duration: 10,
    drift: 0,
    magnet: 0.5,
    danger: 1,
    score: 1.3,
    gravity: 1,
    damping: 0.985,
  },
  {
    id: "moon",
    name: "月光轻飘",
    icon: "spark",
    hint: "重力减半 · 得分 ×1.2",
    duration: 12,
    drift: 0,
    magnet: 1,
    danger: 1,
    score: 1.2,
    gravity: 0.5,
    damping: 1,
  },
  {
    id: "tempest",
    name: "回旋风",
    icon: "wind",
    hint: "风向交替 · 得分 ×1.4",
    duration: 12,
    drift: 0.32,
    magnet: 1,
    danger: 1,
    score: 1.4,
    gravity: 1,
    damping: 1,
  },
  {
    id: "hail",
    name: "跳跳冰雹",
    icon: "ice",
    hint: "果箱弹性增强 · 得分 ×1.3",
    duration: 10,
    drift: 0,
    magnet: 0.8,
    danger: 1,
    score: 1.3,
    gravity: 1,
    damping: 1,
  },
  {
    id: "nectar",
    name: "蜜露",
    icon: "honey",
    hint: "吸引增强 · 得分 ×1.6",
    duration: 10,
    drift: 0,
    magnet: 1.3,
    danger: 1,
    score: 1.6,
    gravity: 0.9,
    damping: 1,
  },
] as const;
export type WeatherEvent = (typeof WEATHER_EVENTS)[number];
export type WeatherSnapshot = {
  id: string;
  name: string;
  icon: string;
  hint: string;
  phase: "warning" | "active";
  seconds: number;
} | null;

// Driven only by the game's unpaused clock; independent RNG preserves daily deals.
export class WeatherCycle {
  active: WeatherEvent | null = null;
  private pending: WeatherEvent | null = null;
  private previous = "";
  private nextAt: number;
  private endsAt = 0;
  private random: () => number;
  private interval: number;
  constructor(random: () => number, interval: number) {
    this.random = random;
    this.interval = interval;
    this.nextAt = interval;
  }
  tick(now: number) {
    if (this.active && now >= this.endsAt) {
      this.active = null;
      this.nextAt = now + this.interval + Math.floor(this.random() * 7);
    }
    if (this.pending && now >= this.nextAt) {
      this.active = this.pending;
      this.pending = null;
      this.endsAt = now + this.active.duration;
    }
    if (!this.active && !this.pending && now >= this.nextAt - 3) {
      const choices = WEATHER_EVENTS.filter(
        (event) => event.id !== this.previous,
      );
      this.pending =
        choices[
          Math.min(
            choices.length - 1,
            Math.floor(this.random() * choices.length),
          )
        ];
      this.previous = this.pending.id;
      // Even after a dropped frame, always give the player three seconds' notice.
      this.nextAt = now + 3;
    }
  }
  clear(now: number) {
    if (!this.active && !this.pending) return false;
    this.active = null;
    this.pending = null;
    this.nextAt = now + this.interval;
    return true;
  }
  snapshot(now: number): WeatherSnapshot {
    const event = this.active ?? this.pending;
    if (!event) return null;
    return {
      id: event.id,
      name: event.name,
      icon: event.icon,
      hint: event.hint,
      phase: this.active ? "active" : "warning",
      seconds: Math.max(
        0,
        Math.ceil((this.active ? this.endsAt : this.nextAt) - now),
      ),
    };
  }
}

export function insightTargets(
  cards: Array<{ id: number; tier: number; covered: number; locked: boolean }>,
  tray: number[],
) {
  const groups = new Map<number, typeof cards>();
  for (const card of cards)
    groups.set(card.tier, [...(groups.get(card.tier) ?? []), card]);
  const candidates = [...groups.entries()]
    .map(([tier, group]) => {
      const held = tray.filter((t) => t === tier).length;
      const needed = 3 - held;
      const chosen = [...group]
        .sort(
          (a, b) =>
            Number(a.locked) - Number(b.locked) ||
            a.covered - b.covered ||
            a.id - b.id,
        )
        .slice(0, needed);
      return {
        chosen,
        needed,
        cost: chosen.reduce(
          (sum, c) => sum + c.covered * 4 + Number(c.locked) * 8 + 1,
          0,
        ),
      };
    })
    .filter((c) => c.needed > 0 && c.chosen.length === c.needed)
    .sort((a, b) => a.cost - b.cost);
  return candidates[0]?.chosen.map((c) => c.id) ?? [];
}
