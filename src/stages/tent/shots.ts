import { Easing } from "remotion";
import { clamp01, lerp, lerp3, seg, spline } from "../math";
import type { CameraPose, Shot, ShotContext, Vec3 } from "../types";
import { H2, VENT_V, VENT_X, onFly } from "./geometry";
import { HERO_AB, macroPoint } from "./Macro";
import type { Label, TentState } from "./state";
import { POND, groundY, tentY } from "./state";

/**
 * 每个镜头 = 本段进度 → 整个舞台的状态。
 * 相机端点要和下一段的起点对上，整集才是一镜到底。
 * s03 以后的动作都用 ctx.cue(word) 对到旁白的词上，换了配音也不会错位。
 */

const base = (ctx: ShotContext): TentState => ({
  camera: { pos: [5.2, 2.3, 4.4], look: [0, 0.6, 0], fov: 30 },
  day: 0,
  drops: 0,
  bigDrop: { show: false, grow: 0, fall: -1, splash: 0 },
  inner: 1,
  ventOpen: 0,
  time: ctx.time,
  clock: null,
  lab: 0,
  flyTemp: 0.55,
  air: 0,
  vapour: { fill: 0, skin: 0, plume: 0, out: 0, alpha: 1, force: 0 },
  cup: { show: 0, fill: 0 },
  heat: 0,
  macro: { show: 0, vapour: 0, dew: 0, hero: 0 },
  gauge: { show: 0, air: 0.86, fly: 0.55, dew: 0 },
  doors: 0,
  wind: 0.25,
  streams: 0,
  sag: 0,
  dip: 0,
  pond: 0,
  tree: 0,
  breathFog: -1,
  labels: [],
  brand: 0,
});

/** 本段第 a 到 b 秒，0→1，带缓动 */
const sec = (ctx: ShotContext, a: number, b: number, easing?: (t: number) => number) => seg(ctx.t, a, b, easing);
const out = Easing.out(Easing.cubic);
const inn = Easing.in(Easing.cubic);
const pop = Easing.out(Easing.back(1.6));
const blend = (a: CameraPose, b: CameraPose, u: number): CameraPose => ({
  pos: lerp3(a.pos, b.pos, u),
  look: lerp3(a.look, b.look, u),
  fov: lerp(a.fov, b.fov, u),
  near: Math.min(a.near ?? 0.02, b.near ?? 0.02),
});
/** 依次经过几个关键位：每一步 [开始秒, 结束秒, 目标, 缓动] */
const path = (ctx: ShotContext, start: CameraPose, steps: [number, number, CameraPose, ((t: number) => number)?][]) =>
  steps.reduce((pose, [a, b, to, e]) => blend(pose, to, sec(ctx, a, b, e)), start);
/** 进场 / 退场的标注：在 inAt 出现，outAt 消失 */
const showFor = (ctx: ShotContext, inAt: number, outAt?: number) =>
  sec(ctx, inAt, inAt + 0.4, out) * (outAt === undefined ? 1 : 1 - sec(ctx, outAt, outAt + 0.4));

// 帐篷里，从睡袋脚那头望向门口；先盯住挂在屋脊下的大水珠
const HOOK_A: CameraPose = { pos: [-1.0, 0.52, -0.34], look: [0.1, 1.08, 0.2], fov: 50 };
const HOOK_B: CameraPose = { pos: [-0.86, 0.55, -0.29], look: [0.1, 0.55, 0.18], fov: 56 };

const orbit = (a: number, r: number, h: number): Vec3 => [Math.cos(a) * r, h, Math.sin(a) * r];
// 出帐篷：往后退，穿过后墙篷布，到帐篷后方。穿布那一下满屏橙色，就是转场
const EXIT: Vec3[] = [HOOK_B.pos, [-1.3, 0.7, 0.35], [-2.6, 1.4, 1.1], [-3.8, 1.75, 1.55], orbit(2.75, 4.6, 1.7)];
const exitAt = (u: number): CameraPose => ({
  pos: spline(EXIT, u),
  look: lerp3(HOOK_B.look, [0, 0.65, 0], seg(u, 0, 0.35)),
  fov: lerp(HOOK_B.fov, 34, seg(u, 0, 0.6)),
});
/** hook 结束时走到出帐路径的哪里：刚穿出后墙 */
const HOOK_EXIT_END = 0.3;
// s02 的绕行：从帐篷后方经过向阳的一侧，绕到门前 3/4 位置
const ORBIT_FROM = 2.75;
const ORBIT_TO = 0.68;
/** 夜里门前 3/4 的全景：s02 结束、s03 开始的位置 */
const NIGHT_WIDE: CameraPose = { pos: orbit(ORBIT_TO, 6.0, 2.1), look: [0, 0.6, 0], fov: 30 };

const hook: Shot<TentState> = {
  headingAt: 0,
  pose: (ctx) => {
    const { p } = ctx;
    // 慢慢推近挂着的大水珠；水珠一落，镜头跟着它往下摇到睡袋
    const push = seg(p, 0, 0.45);
    const follow = seg(p, 0.46, 0.64);
    const exit = seg(p, 0.78, 1, Easing.in(Easing.quad));
    const grow = seg(p, 0, 0.45, Easing.out(Easing.quad));
    // 下落放慢到约 0.6 秒（真实约 0.4 秒），手机上不会看漏
    const fall = p < 0.47 ? -1 : clamp01((p - 0.47) / 0.11);
    const splash = clamp01((p - 0.58) / 0.18);
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
    // 刚穿出篷布时离后墙很近、满屏橙色：开头快速拉远
    const o = seg(p, 0, 0.2, out);
    const swing = seg(p, 0.16, 1);
    // 倒带等旁白说到 “Let’s rewind” 才开始
    const back = seg(p, 0.7, 0.98);
    let camera: CameraPose;
    if (p < 0.2) camera = exitAt(lerp(HOOK_EXIT_END, 1, o));
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
      clock: p > 0.66 ? { hours: lerp(30 + 40 / 60, 22.5, back), show: seg(p, 0.66, 0.74) } : null,
    };
  },
};

// ---------------------------------------------------------------- s03 水从哪来：扫描线切进 Lab View，呼出的水汽填满帐篷
// 偏到侧面一点，门口那根杆子不挡在脸前；看点放低，给左上角的标题和底部的量杯留位置
const SOURCE_NEAR: CameraPose = { pos: orbit(0.98, 4.3, 1.75), look: [-0.2, 0.6, 0.32], fov: 30 };
/** s03 末尾升到帐篷斜上方，s04 从这里接着升 */
const SOURCE_UP: CameraPose = { pos: [2.3, 3.0, 2.75], look: [0.15, 0.9, 0], fov: 34 };

const source: Shot<TentState> = {
  headingAt: "cup",
  pose: (ctx) => {
    const at = ctx.cue;
    const cupAt = at("cup");
    const labels: Label[] = [
      // 先教观众认这个颜色：青色的点就是水汽
      { id: "vapor", text: "Water vapor", at: [0.42, 0.98, 0.05], show: showFor(ctx, at("vapor") - 0.1, cupAt - 0.5), dx: 150, dy: -150, vdx: 90, vdy: -230, color: "#9FF6FF" },
    ];
    return {
      ...base(ctx),
      camera: path(ctx, NIGHT_WIDE, [
        [0.2, 8.8, SOURCE_NEAR],
        [8.9, ctx.duration, SOURCE_UP, inn],
      ]),
      lab: sec(ctx, 0, 1.4, Easing.inOut(Easing.quad)),
      air: sec(ctx, at("warm") - 0.1, at("warm") + 0.9),
      vapour: {
        fill: 0.9 * sec(ctx, 1.0, ctx.duration - 0.3, Easing.inOut(Easing.quad)),
        skin: 0.9 * sec(ctx, at("skin"), at("skin") + 4.5),
        plume: sec(ctx, 0.3, 1.1),
        out: 0,
        alpha: 1,
        force: 0,
      },
      cup: { show: sec(ctx, at("sleeper") - 0.3, at("sleeper") + 0.5, pop), fill: sec(ctx, cupAt - 0.1, ctx.duration - 0.4, Easing.inOut(Easing.quad)) },
      labels,
    };
  },
};

// ---------------------------------------------------------------- s04 篷布为什么冷：升到帐篷上方，热量散向夜空，篷布由橙变蓝
const COLD_SKY: CameraPose = { pos: [2.9, 3.3, 3.7], look: [-0.1, 1.5, -0.4], fov: 38 };
const COLD_TENT: CameraPose = { pos: [2.05, 3.2, 3.0], look: [0, 0.75, 0], fov: 34 };
/** 外帐那一小块的外侧：镜头要从外面贴着坡面滑进去 */
const PATCH_OUT = (b: number, c: number) => macroPoint(0, b, -c);
const DIVE_START: CameraPose = { pos: PATCH_OUT(-0.32, 0.2), look: macroPoint(0, 0.12, 0), fov: 40, near: 0.002 };

const coldfly: Shot<TentState> = {
  headingAt: "colder",
  pose: (ctx) => {
    const at = ctx.cue;
    const flyTemp = lerp(0.55, 0.08, sec(ctx, at("losing"), at("colder") + 0.6, Easing.inOut(Easing.quad)));
    return {
      ...base(ctx),
      camera: path(ctx, SOURCE_UP, [
        [0, at("sky"), COLD_SKY, out],
        [at("sky") + 0.7, at("air"), COLD_TENT],
        [at("tent"), ctx.duration, DIVE_START, inn],
      ]),
      lab: 1,
      air: 1,
      flyTemp,
      vapour: { fill: 0.9, skin: 0.9, plume: 1, out: 0, alpha: 1, force: 0 },
      cup: { show: 1, fill: 1 },
      heat: sec(ctx, at("losing") - 0.2, at("heat") + 0.4) * (1 - sec(ctx, at("tent"), ctx.duration)),
      gauge: { show: sec(ctx, at("fly") - 0.2, at("fly") + 0.4, out), air: 0.86, fly: flyTemp, dew: 0 },
    };
  },
};

// ---------------------------------------------------------------- s05 露点：钻进布里，水汽撞上冰冷的布面，变回水珠
/** 微观镜头：在布面下面，抬头沿着坡面往屋脊方向看 */
const MACRO_CAM: CameraPose = { pos: macroPoint(0, -0.075, 0.035), look: macroPoint(HERO_AB.a, 0.03, 0.002), fov: 50, near: 0.002 };
const MACRO_PUSH: CameraPose = { pos: macroPoint(0.003, -0.058, 0.03), look: macroPoint(HERO_AB.a, HERO_AB.b, 0.006), fov: 48, near: 0.002 };
// 拉回：在内帐和外帐之间顺着坡往下退，从檐口底下钻出去，退到全景
const PULL: Vec3[] = [MACRO_PUSH.pos, [0.03, 0.45, 0.86], [0.1, 0.16, 1.02], [0.25, 0.06, 1.5], [1.6, 0.9, 3.4], [3.0, 1.9, 5.0]];
const WIDE_FRONT: CameraPose = { pos: [3.0, 1.9, 5.0], look: [0, 0.6, 0], fov: 30 };

const dew: Shot<TentState> = {
  headingAt: "turns",
  pose: (ctx) => {
    const at = ctx.cue;
    const pullA = at("thats") - 0.3;
    const pull = sec(ctx, pullA, ctx.duration, Easing.inOut(Easing.quad));
    let camera: CameraPose;
    if (ctx.t < pullA) {
      // 从外面贴着坡面滑进布里，穿过去以后抬头
      const dive = sec(ctx, 0, 1.6, Easing.out(Easing.quad));
      const pos = spline([DIVE_START.pos, PATCH_OUT(-0.17, 0.05), macroPoint(0, -0.1, 0.02), MACRO_CAM.pos], dive);
      const near: CameraPose = { pos, look: lerp3(DIVE_START.look, MACRO_CAM.look, dive), fov: lerp(DIVE_START.fov, MACRO_CAM.fov, dive), near: 0.002 };
      camera = blend(near, MACRO_PUSH, sec(ctx, 1.8, pullA));
    } else {
      camera = {
        pos: spline(PULL, pull),
        look: lerp3(MACRO_PUSH.look, WIDE_FRONT.look, seg(pull, 0.25, 0.85)),
        fov: lerp(MACRO_PUSH.fov, WIDE_FRONT.fov, seg(pull, 0.3, 0.9)),
        near: pull < 0.5 ? 0.002 : 0.02,
      };
    }
    return {
      ...base(ctx),
      camera,
      lab: 1,
      air: 1,
      flyTemp: 0.08,
      // 帐篷上的水珠等镜头退出布面再长出来，免得大颗的挤进微观镜头
      drops: 0.75 * sec(ctx, pullA + 0.4, ctx.duration),
      // 大颗的帐篷水汽粒子贴到镜头上会糊成一片：钻进布里时先藏起来，退出来再出现（少了一些，变成水了）
      vapour: { fill: 0.65, skin: 0.65, plume: 1, out: 0, alpha: 1 - sec(ctx, 0.2, 1.0) + sec(ctx, pullA + 1.2, ctx.duration) * 0.85, force: 0 },
      cup: { show: 1 - sec(ctx, pullA + 0.6, pullA + 1.4), fill: 1 },
      macro: {
        show: 1 - sec(ctx, pullA + 1.4, pullA + 1.6),
        vapour: sec(ctx, 0.6, 1.6),
        dew: sec(ctx, at("dew") + 0.1, at("water") + 0.6, Easing.inOut(Easing.quad)),
        hero: sec(ctx, at("water"), pullA + 0.6, Easing.inOut(Easing.quad)),
      },
      gauge: { show: 1 - sec(ctx, pullA + 0.6, pullA + 1.2), air: 0.86, fly: 0.08, dew: sec(ctx, at("dew") - 0.2, at("point") + 0.2, out) },
    };
  },
};

// ---------------------------------------------------------------- s06 什么时候最糟：无风、低洼水边、门拉上
const CALM_LOOK: CameraPose = { pos: orbit(0.62, 6.4, 2.3), look: [0.55, 0.7, 0.25], fov: 28 };
const POND_LOOK: CameraPose = { pos: orbit(0.98, 7.8, 3.7), look: [0.45, -0.15, 0.85], fov: 30 };
const DOOR_LOOK: CameraPose = { pos: orbit(0.34, 6.2, 2.05), look: [0.95, 0.2, 0.15], fov: 28 };

const worst: Shot<TentState> = {
  pose: (ctx) => {
    const at = ctx.cue;
    const dip = sec(ctx, at("low") - 0.1, at("water") + 0.2, Easing.inOut(Easing.quad));
    const pond = sec(ctx, at("spots"), at("water") + 0.5);
    const ty = tentY({ dip });
    const labels: Label[] = [
      { id: "calm", text: "Calm air", at: [1.2, H2 - 0.35 + ty, 0.02], show: showFor(ctx, at("calm") - 0.1, at("every")), dx: 80, dy: -120, vdx: 50, vdy: -170 },
      { id: "low", text: "Low, damp ground", at: [POND.x + 0.1, groundY(POND.x, POND.z, dip, 0) - 0.04, POND.z + 0.15], show: showFor(ctx, at("low")), dx: -120, dy: -110, vdx: 60, vdy: 120 },
      { id: "doors", text: "Doors shut", at: [1.37, 0.55 + ty, 0.3], show: showFor(ctx, at("door") - 0.1), dx: 130, dy: -90, vdx: 40, vdy: -240 },
    ];
    return {
      ...base(ctx),
      camera: path(ctx, WIDE_FRONT, [
        [0.3, at("nights") + 0.4, CALM_LOOK, Easing.inOut(Easing.quad)],
        [at("low") - 0.2, at("water") + 0.6, POND_LOOK],
        [at("every") - 0.2, ctx.duration, DOOR_LOOK],
      ]),
      lab: 1 - sec(ctx, 0, 1.4, Easing.inOut(Easing.quad)),
      air: 1,
      flyTemp: 0.08,
      drops: lerp(0.75, 1, sec(ctx, 1, ctx.duration)),
      vapour: { fill: 0.65, skin: 0.65, plume: 1, out: 0, alpha: 0.85, force: 0 },
      wind: 0.25 * (1 - sec(ctx, at("calm") - 0.2, at("nights") + 0.4)),
      sag: 0.7 * sec(ctx, 1.2, at("door")),
      dip,
      pond,
      doors: sec(ctx, at("door"), at("shut") + 0.3, Easing.inOut(Easing.quad)),
      labels,
    };
  },
};

// ---------------------------------------------------------------- s07 怎么办：开门开通风口、篷布绷紧、搬到高处树下
const ventAt = (dip: number): Vec3 => {
  const p = onFly(VENT_X, VENT_V, 1).p;
  return [p.x, p.y + tentY({ dip }), p.z];
};
const FIX_VENT: CameraPose = { pos: orbit(1.12, 6.2, 3.3), look: [-0.25, 0.55, 0.15], fov: 30 };
const FIX_SIDE: CameraPose = { pos: orbit(1.38, 5.9, 1.9), look: [0, 0.55, 0], fov: 30 };
const FIX_WIDE: CameraPose = { pos: orbit(1.62, 9.2, 4.3), look: [-0.35, 0.65, -0.6], fov: 32 };
/** s07 结束在帐篷后方，s08 从这里穿过后墙回到开头的特写 */
const FIX_BACK: CameraPose = { pos: orbit(2.75, 4.0, 1.65), look: [0, 0.65, 0], fov: 34 };

const fix: Shot<TentState> = {
  pose: (ctx) => {
    const at = ctx.cue;
    const dip = 1 - sec(ctx, at("pitch"), at("ground") + 0.2, Easing.inOut(Easing.quad));
    const ty = tentY({ dip });
    const wide = path(ctx, DOOR_LOOK, [
      [0.9, at("vents") + 0.2, FIX_VENT],
      [at("keep") - 0.1, at("tight") + 0.6, FIX_SIDE],
      [at("pitch") - 0.1, at("trees") + 0.4, FIX_WIDE],
    ]);
    // 最后绕到帐篷后方：按角度绕，不从帐篷中间穿过去
    const swing = sec(ctx, at("can") + 0.1, ctx.duration, Easing.inOut(Easing.quad));
    const camera =
      swing > 0
        ? {
            pos: orbit(lerp(1.62, 2.75, swing), lerp(9.2, 4.0, swing), lerp(4.3, 1.65, swing)),
            look: lerp3(FIX_WIDE.look, FIX_BACK.look, swing),
            fov: lerp(FIX_WIDE.fov, FIX_BACK.fov, swing),
          }
        : wide;
    const labels: Label[] = [
      { id: "vents", text: "Open vents", at: ventAt(dip), show: showFor(ctx, at("vents") - 0.1, at("pitch")), dx: -110, dy: -120, vdx: -40, vdy: -220 },
      { id: "tight", text: "Tight fly", at: [0.3, H2 + ty, 0], show: showFor(ctx, at("tight") - 0.1, at("under")), dx: 90, dy: -110, vdx: 40, vdy: -200 },
      { id: "high", text: "High, dry ground", at: [1.4, groundY(1.4, 1.6, dip, 0), 1.6], show: showFor(ctx, at("higher"), ctx.duration - 0.8), dx: 90, dy: -90, vdx: -30, vdy: 160 },
      { id: "trees", text: "Under trees", at: [-0.4, 2.7, -1.3], show: showFor(ctx, at("trees") + 0.1, ctx.duration - 0.8), dx: 120, dy: -80, vdx: 60, vdy: -170 },
    ];
    return {
      ...base(ctx),
      camera,
      day: 0.22 * sec(ctx, at("can"), ctx.duration),
      drops: 1 - sec(ctx, at("vents"), at("ground"), Easing.inOut(Easing.quad)),
      doors: 1 - sec(ctx, 0.3, 1.6, Easing.inOut(Easing.quad)),
      wind: sec(ctx, 0.5, 1.8),
      streams: sec(ctx, 0.9, 2.0) * (1 - sec(ctx, ctx.duration - 1.5, ctx.duration) * 0.5),
      ventOpen: sec(ctx, at("open") - 0.1, at("vents") + 0.4, pop),
      vapour: { fill: 0.65, skin: 0.65, plume: 1, out: sec(ctx, 1.3, at("ground"), Easing.inOut(Easing.quad)), alpha: 1, force: 1 },
      sag: 0.7 * (1 - sec(ctx, at("tight") - 0.2, at("tight") + 0.5, pop)),
      dip,
      pond: dip,
      tree: sec(ctx, at("under") - 0.7, at("trees") + 0.5),
      labels,
    };
  },
};

// ---------------------------------------------------------------- s08 收尾：天亮，穿过后墙回到开头那个特写，篷布是干的
/** 回到 HOOK_A 时还带着往前推的方向，和第 0 帧的推镜头接上 */
const HOME: Vec3[] = [FIX_BACK.pos, [-2.2, 1.2, 0.95], [-1.3, 0.7, 0.35], [-1.07, 0.56, -0.12], HOOK_A.pos];

const payoff: Shot<TentState> = {
  headingAt: "breath",
  pose: (ctx) => {
    const at = ctx.cue;
    // 前段快、后段很慢地落到 HOOK_A，最后一帧和第 0 帧几乎一样
    const u = sec(ctx, 0, ctx.duration - 0.05, Easing.bezier(0.42, 0, 0.12, 1));
    return {
      ...base(ctx),
      camera: {
        pos: spline(HOME, u),
        look: lerp3(FIX_BACK.look, HOOK_A.look, seg(u, 0.2, 0.75)),
        fov: lerp(FIX_BACK.fov, HOOK_A.fov, seg(u, 0.2, 0.8)),
      },
      day: lerp(0.22, 1, sec(ctx, 0, 2.6, Easing.inOut(Easing.quad))),
      inner: 1 - sec(ctx, 0.6, 1.4),
      ventOpen: 1,
      wind: 0.5,
      streams: 1 - sec(ctx, 0, 0.8),
      vapour: { fill: 0.65, skin: 0.65, plume: 0, out: 1, alpha: 1 - sec(ctx, 0, 0.6), force: 1 },
      tree: 1,
      breathFog: ctx.t - at("breath") + 0.15,
      brand: sec(ctx, at("follow") - 0.1, at("follow") + 0.5, out),
    };
  },
};

/** 没有对应镜头时的画面：停在夜里帐篷外慢慢绕 */
const fallback = (ctx: ShotContext): TentState => {
  return { ...base(ctx), camera: { pos: orbit(0.68 + ctx.t * 0.02, 6.0, 2.1), look: [0, 0.6, 0], fov: 30 } };
};

export const shots: Record<string, Shot<TentState>> = { hook, rewind, source, coldfly, dew, worst, fix, payoff };
export { fallback };
