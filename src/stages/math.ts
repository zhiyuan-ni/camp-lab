import { Easing, interpolate } from "remotion";
import type { Vec3 } from "./types";

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const inOut = Easing.inOut(Easing.cubic);
/** 把 p 的 [a, b] 段映射到 0→1，带缓动并 clamp */
export const seg = (p: number, a: number, b: number, easing: (t: number) => number = inOut) =>
  interpolate(p, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });

/** Catmull-Rom：相机沿几个点平滑穿过，不在中间点停顿 */
export const spline = (pts: Vec3[], t: number): Vec3 => {
  const n = pts.length - 1;
  const x = clamp01(t) * n;
  const i = Math.min(Math.floor(x), n - 1);
  const u = x - i;
  const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, n)];
  const f = (k: number) =>
    0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u * u + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u * u * u);
  return [f(0), f(1), f(2)];
};
