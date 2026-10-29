import React, { useLayoutEffect, useMemo, useRef } from "react";
import { random } from "remotion";
import * as THREE from "three";
import { brand } from "../../brand";
import { GlowPoints } from "../GlowPoints";
import { thermal } from "../lab";
import { clamp01 } from "../math";
import type { Vec3 } from "../types";
import { EAVE_Y, FLY_TH, H2, W2, underFly } from "./geometry";
import type { TentState } from "./state";

/**
 * 篷布内表面的微观世界：外帐内侧一小块（约 30 cm 见方）的织物纹理、
 * 从下面飘上来的水汽、在布面上长出来的水珠。只在镜头钻进布里的时候出现。
 *
 * 局部坐标 (a, b, c)：a 沿屋脊方向，b 沿坡面往屋脊，c 垂直布面往帐篷里（c > 0 在布下面）。
 */
const P = underFly(0.0, 0.55, 1, 0);
// a 轴朝 -x，这样 (a, b, c) 是右手系，c 正好朝帐篷里
const AX = new THREE.Vector3(-1, 0, 0);
const UP = new THREE.Vector3(0, H2 - FLY_TH * 1.3 - EAVE_Y, -(W2 - FLY_TH)).normalize();
const IN = new THREE.Vector3().crossVectors(AX, UP).normalize();
const BASIS = new THREE.Matrix4().makeBasis(AX, UP, IN);
const QUAT = new THREE.Quaternion().setFromRotationMatrix(BASIS);

/** 微观局部坐标 → 帐篷坐标 */
export const macroPoint = (a: number, b: number, c: number): Vec3 => {
  const v = P.clone().addScaledVector(AX, a).addScaledVector(UP, b).addScaledVector(IN, c);
  return [v.x, v.y, v.z];
};

const PATCH_R = 0.17;
const SPACING = 0.0062;
const THREAD_R = 0.00175;

type Drop = { a: number; b: number; r: number; th: number };
const N_DROPS = 72;
const DROPS: Drop[] = Array.from({ length: N_DROPS }, (_, i) => {
  const ang = random(`md-a-${i}`) * Math.PI * 2;
  const rad = Math.sqrt(random(`md-r-${i}`)) * 0.13;
  return { a: Math.cos(ang) * rad, b: Math.sin(ang) * rad + 0.03, r: 0.0016 + Math.pow(random(`md-s-${i}`), 2) * 0.0048, th: random(`md-t-${i}`) * 0.6 };
});
/** 主角水珠：镜头正前方，最后长得最大 */
export const HERO_AB = { a: 0.004, b: 0.03 };

type Mote = { k: number; a0: number; b0: number; d0: number; life: number; ph: number };
const N_MOTES = 520;
const MOTES: Mote[] = Array.from({ length: N_MOTES }, (_, i) => {
  const k = i % N_DROPS;
  return {
    k,
    a0: DROPS[k].a + (random(`mm-a-${i}`) - 0.5) * 0.06,
    b0: DROPS[k].b + (random(`mm-b-${i}`) - 0.5) * 0.06,
    d0: 0.02 + random(`mm-d-${i}`) * 0.08,
    life: 1.8 + random(`mm-l-${i}`) * 1.6,
    ph: random(`mm-p-${i}`) * 4,
  };
});

const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export const Macro: React.FC<{ state: TentState; env: THREE.Texture }> = ({ state, env }) => {
  const { macro, time } = state;
  const weave = useMemo(() => {
    const mats: THREE.Matrix4[] = [];
    const q1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)); // 沿 a
    const q2 = new THREE.Quaternion(); // 沿 b
    for (let j = -Math.floor(PATCH_R / SPACING); j * SPACING <= PATCH_R; j++) {
      const o = j * SPACING;
      const len = 2 * Math.sqrt(Math.max(PATCH_R * PATCH_R - o * o, 0));
      if (len < SPACING) continue;
      const wob = (j % 2 ? 1 : -1) * 0.0006;
      mats.push(new THREE.Matrix4().compose(new THREE.Vector3(0, o + 0.03, 0.0019 + wob), q1, new THREE.Vector3(1, len, 1)));
      mats.push(new THREE.Matrix4().compose(new THREE.Vector3(o, 0.03, 0.0019 - wob), q2, new THREE.Vector3(1, len, 1)));
    }
    return mats;
  }, []);
  const m = useMemo(
    () => ({
      thread: new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0 }),
      // 织物背面：线缝之间看到的是布，不是透出去的夜空
      back: new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide }),
      drop: new THREE.MeshPhysicalMaterial({ color: 0xe8f7ff, roughness: 0.0, transmission: 1, thickness: 0.004, ior: 1.33, envMap: env, envMapIntensity: 2.4, attenuationColor: new THREE.Color(0x7fd4ff), attenuationDistance: 0.02, emissive: 0x4fb8ff, emissiveIntensity: 0.18 }),
    }),
    [env],
  );
  const cold = thermal(state.flyTemp);
  m.thread.color.copy(cold).multiplyScalar(0.55);
  m.thread.emissive.copy(cold);
  m.thread.emissiveIntensity = 0.45;
  m.back.color.copy(cold).multiplyScalar(0.3);
  m.back.emissive.copy(cold).multiplyScalar(0.25);

  const threadRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const im = threadRef.current;
    if (!im) return;
    weave.forEach((mm, i) => im.setMatrixAt(i, mm));
    im.instanceMatrix.needsUpdate = true;
  }, [weave]);

  const dropRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const im = dropRef.current;
    if (!im) return;
    const mm = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    DROPS.forEach((d, i) => {
      const k = clamp01((macro.dew - d.th) / 0.4);
      const r = d.r * Math.pow(k, 0.6);
      mm.compose(new THREE.Vector3(d.a, d.b, r * 0.5), q, new THREE.Vector3(r, r, r * 1.15));
      im.setMatrixAt(i, mm);
    });
    im.instanceMatrix.needsUpdate = true;
  }, [macro.dew]);

  if (macro.show <= 0.001) return null;
  const heroR = 0.0045 + 0.012 * macro.hero;
  const compute = (pos: Float32Array, size: Float32Array, alpha: Float32Array) => {
    let n = 0;
    for (const mt of MOTES) {
      const d = DROPS[mt.k];
      const q = (((time + mt.ph) % mt.life) + mt.life) % mt.life / mt.life;
      const lat = Math.pow(q, 1.5);
      // 越靠近冰冷的布面越慢：离布面的距离按 (1-q)^2 收拢
      const c = d.r * 0.6 + mt.d0 * Math.pow(1 - q, 2);
      pos[n * 3] = mt.a0 + (d.a - mt.a0) * lat;
      pos[n * 3 + 1] = mt.b0 + (d.b - mt.b0) * lat;
      pos[n * 3 + 2] = c;
      size[n] = 0.0042;
      alpha[n] = macro.vapour * smooth(0, 0.1, q) * (1 - smooth(0.82, 1, q)) * 0.8;
      n++;
    }
    return n;
  };
  return (
    <group position={P} quaternion={QUAT}>
      <mesh material={m.back} position={[0, 0.03, 0.0004]}>
        <circleGeometry args={[PATCH_R + 0.004, 48]} />
      </mesh>
      <instancedMesh ref={threadRef} args={[undefined, undefined, weave.length]} material={m.thread} frustumCulled={false}>
        <cylinderGeometry args={[THREAD_R, THREAD_R, 1, 6]} />
      </instancedMesh>
      <instancedMesh ref={dropRef} args={[undefined, undefined, N_DROPS]} material={m.drop} frustumCulled={false}>
        <sphereGeometry args={[1, 20, 14]} />
      </instancedMesh>
      {macro.hero > 0 && (
        <mesh material={m.drop} position={[HERO_AB.a, HERO_AB.b, heroR * 0.55]} scale={[heroR, heroR, heroR * (1.15 + 0.35 * macro.hero)]}>
          <sphereGeometry args={[1, 32, 24]} />
        </mesh>
      )}
      {/* 镜头边上一盏冷色小灯，让水珠有高光 */}
      <pointLight position={[0, -0.04, 0.05]} color={0x9fd8ff} intensity={0.02 * macro.show} distance={0.6} decay={2} />
      <GlowPoints max={N_MOTES} compute={compute} deps={[time, macro.vapour]} color={brand.lab.vapor} force={1} />
    </group>
  );
};
