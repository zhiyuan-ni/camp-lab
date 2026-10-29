import React, { useMemo } from "react";
import { random } from "remotion";
import * as THREE from "three";
import { brand } from "../../brand";
import { GlowPoints } from "../GlowPoints";
import { clamp01, spline } from "../math";
import type { Vec3 } from "../types";
import { IH, IW, underFly } from "./geometry";
import { ventPoint } from "./curves";
import type { TentState } from "./state";
import { MOUTH, bagTopAt } from "./state";

/**
 * 帐篷里的水汽粒子，全部由 state 和全片秒数直接算出来（没有逐帧累积）：
 * - 每口气一小团（plume），跟睡袋的起伏同一个节奏；
 * - 慢慢填满帐篷的那一团（cloud）：fill / skin 每涨一点，就有一批粒子从嘴边或睡袋表面飘到各自的位置；
 * - 通风时（out）粒子沿着路径从顶部通风口出去。
 */

/** 呼吸周期（秒），睡袋起伏也用它 */
export const BREATH = 4.2;

const r = (k: string) => random(`vap-${k}`);
const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** 内帐里某高度处的半宽 */
const innerHalf = (y: number) => IW * (1 - (y - 0.03) / (IH - 0.03));

type Cloud = { home: Vec3; from: Vec3; skin: boolean; th: number; out: number; side: 1 | -1; ph: Vec3 };
const N_CLOUD = 1500;
const CLOUD: Cloud[] = (() => {
  const out: Cloud[] = [];
  let i = 0;
  while (out.length < N_CLOUD) {
    const k = `${i++}`;
    let home: Vec3;
    if (r(`gap-${k}`) < 0.18) {
      // 一部分已经穿过内帐网眼，飘在内帐和外帐之间
      const side: 1 | -1 = r(`gs-${k}`) < 0.5 ? 1 : -1;
      const p = underFly((r(`gx-${k}`) - 0.5) * 2.3, 0.12 + r(`gv-${k}`) * 0.8, side, 0.04 + r(`go-${k}`) * 0.16);
      home = [p.x, p.y, p.z];
    } else {
      const y = 0.14 + r(`y-${k}`) * (IH - 0.22);
      const half = innerHalf(y) - 0.05;
      if (half <= 0.02) continue;
      const z = (r(`z-${k}`) * 2 - 1) * half;
      const x = (r(`x-${k}`) * 2 - 1) * 1.0;
      // 别塞进睡袋和头里
      if (y < 0.48 && Math.abs(z) < 0.33 && x < 0.9) continue;
      home = [x, y, z];
    }
    const skin = r(`skin-${k}`) < 0.32;
    const bz = (r(`bz-${k}`) - 0.5) * 0.4;
    const from: Vec3 = skin
      ? [-0.9 + r(`bx-${k}`) * 1.4, bagTopAt(bz) + 0.01, bz]
      : [MOUTH[0] - 0.05 + (r(`fx-${k}`) - 0.5) * 0.12, MOUTH[1] + 0.25 + r(`fy-${k}`) * 0.3, (r(`fz-${k}`) - 0.5) * 0.16];
    out.push({
      home,
      from,
      skin,
      th: r(`th-${k}`),
      out: r(`out-${k}`) * 0.75,
      side: home[2] < 0 ? -1 : 1,
      ph: [r(`p1-${k}`) * 6.28, r(`p2-${k}`) * 6.28, r(`p3-${k}`) * 6.28],
    });
  }
  return out;
})();

type Puff = { dir: THREE.Vector3; off: number; rr: number; ph: number };
const N_PLUME = 240;
const PLUME: Puff[] = Array.from({ length: N_PLUME }, (_, i) => ({
  dir: new THREE.Vector3(-0.3 + r(`pdx-${i}`) * 0.35, 1, (r(`pdz-${i}`) - 0.5) * 0.7).normalize(),
  // 呼气在每个周期的 0.28–0.6 之间（睡袋往下落的时候）
  off: (0.28 + r(`poff-${i}`) * 0.32) * BREATH,
  rr: 0.4 + r(`prr-${i}`) * 0.6,
  ph: r(`pph-${i}`) * 6.28,
}));

/** 一口气呼出去 a 秒后这个粒子在哪 */
const puffAt = (p: Puff, a: number): Vec3 => {
  const s = 0.22 * (1 - Math.exp(-a * 3));
  const rise = 0.1 * a;
  const rad = (0.015 + 0.07 * a) * p.rr;
  const th = p.ph + a * 1.6;
  const x = MOUTH[0] + p.dir.x * s + Math.cos(th) * rad;
  let y = MOUTH[1] + p.dir.y * s + rise;
  const z = MOUTH[2] + p.dir.z * s + Math.sin(th) * rad;
  y = Math.min(y, 0.03 + (IH - 0.03) * (1 - Math.abs(z) / IW) - 0.06);
  return [x, y, z];
};

export const Vapour: React.FC<{ state: TentState }> = ({ state }) => {
  const { vapour, time } = state;
  const exitPaths = useMemo(
    () =>
      CLOUD.map((c) => {
        const v = ventPoint(c.side);
        const k = `${c.home.join(",")}`;
        return [
          [v.x + 0.15, v.y - 0.12, v.z * 0.6] as Vec3,
          [v.x - 0.02, v.y + 0.04, v.z + c.side * 0.03] as Vec3,
          [v.x - 0.35, v.y + 0.55, v.z + c.side * 0.4] as Vec3,
          [v.x - 1.2 - random(`ex-${k}`) * 0.8, v.y + 1.3 + random(`ey-${k}`) * 0.6, v.z + c.side * (0.9 + random(`ez-${k}`) * 0.6)] as Vec3,
        ];
      }),
    [],
  );
  const visible = vapour.alpha > 0.001 && (vapour.fill > 0 || vapour.skin > 0 || vapour.plume > 0);
  if (!visible) return null;
  const compute = (pos: Float32Array, size: Float32Array, alpha: Float32Array) => {
    let n = 0;
    const put = (p: Vec3, s: number, a: number) => {
      if (a <= 0.003) return;
      pos[n * 3] = p[0];
      pos[n * 3 + 1] = p[1];
      pos[n * 3 + 2] = p[2];
      size[n] = s;
      alpha[n] = a;
      n++;
    };
    // 每口气的一小团
    if (vapour.plume > 0) {
      for (const p of PLUME) {
        const a = (((time - p.off) % BREATH) + BREATH) % BREATH;
        put(puffAt(p, a), 0.03 + 0.012 * a, vapour.plume * vapour.alpha * 0.45 * smooth(0, 0.12, a) * (1 - smooth(2.2, 3.9, a)));
      }
    }
    // 填满帐篷的那一团
    CLOUD.forEach((c, i) => {
      const f = c.skin ? vapour.skin : vapour.fill;
      const k = clamp01((f - c.th) / 0.18);
      if (k <= 0) return;
      const e = ease(k);
      const w = 0.035;
      let p: Vec3 = [
        c.from[0] + (c.home[0] - c.from[0]) * e + Math.sin(time * 0.45 + c.ph[0]) * w,
        c.from[1] + (c.home[1] - c.from[1]) * e + Math.sin(time * 0.38 + c.ph[1]) * w * 0.7 + (c.skin ? 0.12 * Math.sin(Math.PI * k) : 0),
        c.from[2] + (c.home[2] - c.from[2]) * e + Math.sin(time * 0.41 + c.ph[2]) * w,
      ];
      let a = smooth(0, 0.2, k) * 0.55;
      let size = 0.03;
      const q = clamp01((vapour.out - c.out) / 0.25);
      if (q > 0) {
        p = spline([p, ...exitPaths[i]], q * q * (3 - 2 * q));
        // 被风带出去的那一段在普通视角里也要看得清：大一点、亮一点
        a = Math.min(1, a * (1 + 0.8 * smooth(0, 0.3, q))) * (1 - smooth(0.65, 1, q));
        size = 0.03 + 0.02 * smooth(0, 0.4, q);
      }
      put(p, size, a * vapour.alpha);
    });
    return n;
  };
  return (
    <GlowPoints
      max={N_PLUME + N_CLOUD}
      compute={compute}
      deps={[time, vapour.fill, vapour.skin, vapour.plume, vapour.out, vapour.alpha]}
      color={brand.lab.vapor}
      force={vapour.force}
    />
  );
};

/** 清晨冷空气里呼出的一口白气（普通视角，正常混合，不发光） */
export const BreathFog: React.FC<{ age: number; time: number }> = ({ age, time }) => {
  if (age < 0 || age > 3.2) return null;
  const compute = (pos: Float32Array, size: Float32Array, alpha: Float32Array) => {
    let n = 0;
    for (const p of PLUME.slice(0, 90)) {
      const a = Math.max(0, age - (p.off - 0.28 * BREATH) * 0.6) * 0.7;
      const q = puffAt(p, a);
      pos[n * 3] = q[0];
      pos[n * 3 + 1] = q[1];
      pos[n * 3 + 2] = q[2];
      size[n] = 0.12 + 0.12 * a;
      alpha[n] = 0.14 * smooth(0, 0.1, a) * (1 - smooth(1.2, 2.2, a));
      n++;
    }
    return n;
  };
  return <GlowPoints max={90} compute={compute} deps={[age, time]} color={0xf4f7fb} force={1} blend="normal" />;
};
