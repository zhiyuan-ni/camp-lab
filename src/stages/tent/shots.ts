import { Easing } from "remotion";
import { clamp01, lerp, lerp3, seg, spline } from "../math";
import type { CameraPose, Shot, ShotContext, Vec3 } from "../types";
import type { TentState } from "./state";

/**
 * 每个镜头 = 本段进度 p → 整个舞台的状态。
 * 相端点要和下一段的起点对上，整集才是一镜到底。
 */

const base = (ctx: ShotContext): TentState => ({
  camera: { pos: [5.2, 2.3, 4.4], look: [0, 0.6, 0], fov: 30 },
  day: 0,
  drops: 0,
  bigDrop: { show: false, grow: 0, fall: -1, splash: 0 },
  inner: 1,
  time: ctx.time,
  clock: null,
});

// 帐篷里，从睡袋脚那头望向门口；先盯住挂在屋脊下的大水珠
const HOOK_A: CameraPose = { pos: [-1.0, 0.52, -0.34], look: [0.1, 1.08, 0.2], fov: 50 };
const HOOK_B: CameraPose = { pos: [-0.86, 0.55, -0.29], look: [0.1, 0.55, 0.18], fov: 56 };

const orbit = (a: number, r: number, h: number): Vec3 => [Math.cos(a) * r, h, Math.sin(a) * r];
// 出帐篷：往后退，穿过后墙篷布，到帐篷后方。穿布那一下满屏橙色，就是转场
const EXIT: Vec3[] = [HOOK_B.pos, [-1.25, 0.66, 0.35], [-1.9, 0.9, 0.7], [-3.2, 1.4, 1.2], orbit(2.75, 4.6, 1.7)];
const exitAt = (u: number): CameraPose => ({
  pos: spline(EXIT, u),
  look: lerp3(HOOK_B.look, [0, 0.65, 0], seg(u, 0, 0.35)),
  fov: lerp(HOOK_B.fov, 34, seg(u, 0, 0.6)),
});
/** hook 结束时走到出帐路径的哪里：刚穿出后墙 */
const HOOK_EXIT_END = 0.33;
// s02 的绕行：从帐篷后方经过向阳的一侧，绕到门前 3/4 位置
const ORBIT_FROM = 2.75;
const ORBIT_TO = 0.68;

const hook: Shot<TentState> = {
  headingAt: 0,
  pose: (ctx) => {
    const { p } = ctx;
    // 慢慢推近挂着的大水珠；水珠一落，镜头跟着它往下摇到睡袋
    const push = seg(p, 0, 0.45);
    const follow = seg(p, 0.46, 0.6);
    const exit = seg(p, 0.78, 1, Easing.in(Easing.quad));
    const grow = seg(p, 0, 0.45, Easing.out(Easing.quad));
    const fall = p < 0.47 ? -1 : clamp01((p - 0.47) / 0.07);
    const splash = clamp01((p - 0.54) / 0.2);
    const near: CameraPose = {
      pos: lerp3(HOOK_A.pos, HOOK_B.pos, push),
      look: lerp3(HOOK_A.look, HOOK_B.look, follow),
      fov: lerp(HOOK_A.fov, HOOK_B.fov, follow),
    };
    return {
      ...base(ctx),
      camera: exit > 0 ? exitAt(exit * HOOK_EXIT_END) : near,
      day: 1,
      drops: 1,
      bigDrop: { show: true, grow, fall, splash },
      inner: 0,
    };
  },
};

const rewind: Shot<TentState> = {
  headingAt: 0.3,
  pose: (ctx) => {
    const { p } = ctx;
    const out = seg(p, 0, 0.28, Easing.out(Easing.quad));
    const swing = seg(p, 0.22, 1);
    const back = seg(p, 0.5, 0.97);
    let camera: CameraPose;
    if (p < 0.28) camera = exitAt(lerp(HOOK_EXIT_END, 1, out));
    else {
      camera = {
        pos: orbit(lerp(ORBIT_FROM, ORBIT_TO, swing), lerp(4.6, 6.0, swing), lerp(1.7, 2.1, swing)),
        look: [0, lerp(0.65, 0.6, swing), 0],
        fov: lerp(34, 30, swing),
      };
    }
    return {
      ...base(ctx),
      camera,
      day: 1 - back,
      drops: 1 - back,
      inner: seg(p, 0.05, 0.3),
      clock: p > 0.46 ? { hours: lerp(30 + 40 / 60, 22.5, back), show: seg(p, 0.46, 0.56) } : null,
    };
  },
};

/** 还没做的镜头：先停在夜里帐篷外慢慢绕 */
const fallback = (ctx: ShotContext): TentState => {
  return { ...base(ctx), camera: { pos: orbit(0.68 + ctx.t * 0.02, 6.0, 2.1), look: [0, 0.6, 0], fov: 30 } };
};

export const shots: Record<string, Shot<TentState>> = { hook, rewind };
export { fallback };
