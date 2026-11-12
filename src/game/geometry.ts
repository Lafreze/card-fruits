export const CARD_FACE = { width: 58, height: 66, radius: 12.5 };
type Point = { x: number; y: number };
export type CardFace = Point & { rotation?: number };

// A rounded rectangle is its inner rectangle swept by a disk. Comparing the
// exact distance between the two rotated cores excludes transparent corners.
export function cardFacesOverlap(a: CardFace, b: CardFace) {
  const radius = CARD_FACE.radius;
  if (
    Math.hypot(a.x - b.x, a.y - b.y) >
    Math.hypot(CARD_FACE.width, CARD_FACE.height)
  )
    return false;
  const core = (p: CardFace) => {
    const c = Math.cos(p.rotation ?? 0),
      s = Math.sin(p.rotation ?? 0);
    const x = CARD_FACE.width / 2 - radius,
      y = CARD_FACE.height / 2 - radius;
    return [
      [-x, -y],
      [x, -y],
      [x, y],
      [-x, y],
    ].map(([u, v]) => ({ x: p.x + u * c - v * s, y: p.y + u * s + v * c }));
  };
  const first = core(a),
    second = core(b);
  let separated = false;
  for (const polygon of [first, second])
    for (let i = 0; i < 4; i++) {
      const p = polygon[i],
        q = polygon[(i + 1) % 4];
      const axis = { x: p.y - q.y, y: q.x - p.x };
      const project = (points: Point[]) =>
        points.map((v) => v.x * axis.x + v.y * axis.y);
      const u = project(first),
        v = project(second);
      if (Math.max(...u) < Math.min(...v) || Math.max(...v) < Math.min(...u))
        separated = true;
    }
  if (!separated) return true;
  const distanceToSegment = (p: Point, u: Point, v: Point) => {
    const dx = v.x - u.x,
      dy = v.y - u.y;
    const t = Math.max(
      0,
      Math.min(1, ((p.x - u.x) * dx + (p.y - u.y) * dy) / (dx * dx + dy * dy)),
    );
    return (p.x - u.x - t * dx) ** 2 + (p.y - u.y - t * dy) ** 2;
  };
  for (const [points, edges] of [
    [first, second],
    [second, first],
  ])
    for (const p of points)
      for (let i = 0; i < 4; i++)
        if (
          distanceToSegment(p, edges[i], edges[(i + 1) % 4]) <
          (2 * radius) ** 2 - 1e-7
        )
          return true;
  return false;
}

export function touchingFruit(
  a: Point & { radius: number },
  b: Point & { radius: number },
) {
  // Matter's contact slop is 0.05 world pixels; never bridge an empty gap.
  return Math.hypot(a.x - b.x, a.y - b.y) <= a.radius + b.radius + 0.05;
}
