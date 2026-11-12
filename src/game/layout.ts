export type PlayLayout = {
  width: number;
  height: number;
  stack: { x: number; y: number; width: number; height: number };
  tray: { x: number; y: number; width: number; height: number };
  box: { x: number; y: number; width: number; height: number };
  dangerY: number;
};
export function playLayout(width: number, height: number): PlayLayout {
  const landscape = width / height > 1.15;
  const w = landscape ? 860 : 430;
  const h = (w * height) / width;
  if (landscape)
    return {
      width: w,
      height: h,
      stack: { x: 12, y: 76, width: 406, height: h - 154 },
      tray: { x: 12, y: h - 70, width: 406, height: 60 },
      box: { x: 438, y: 12, width: 410, height: h - 24 },
      dangerY: 68,
    };
  const stackHeight = Math.max(190, Math.min(470, 342 + (h - 860) * 0.48));
  const trayY = 76 + stackHeight + 8;
  const boxY = trayY + 74;
  return {
    width: w,
    height: h,
    stack: { x: 12, y: 76, width: 406, height: stackHeight },
    tray: { x: 12, y: trayY, width: 406, height: 64 },
    box: { x: 12, y: boxY, width: 406, height: h - boxY - 10 },
    dangerY: boxY + 50,
  };
}
