import React, { useLayoutEffect, useMemo, useRef } from "react";
import { random } from "remotion";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { useThree } from "@react-three/fiber";
import { brand } from "../../brand";
import { FlowLines } from "../FlowLines";
import { labDim, labify, thermal } from "../lab";
import { clamp01, lerp } from "../math";
import { HEAT_CURVES, STREAM_CURVES } from "./curves";
import {
  EAVE_Y, FLY_LEN, FLY_TH, H2, IH, IW, SLOPE_ANGLE, SLOPE_LEN, TL, TW, VENT_V, VENT_X, W2,
  dropletLayout, extrudeX, lambdaShape, netTexture, onFly, sagOffset, triangleShape, underFly,
} from "./geometry";
import { Macro } from "./Macro";
import type { TentState } from "./state";
import { BIG_DROP, bagTopAt, tentY } from "./state";
import { BREATH, BreathFog, Vapour } from "./Vapour";

const std = (hex: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color: hex, roughness: 0.85, flatShading: true, ...extra });

// 热成像里各部分的“温度”：人最热，睡袋外面稍凉，内帐接近室温
const T = { skin: 1, hair: 0.86, bag: 0.8, pillow: 0.72, pad: 0.66, inner: 0.64 };

// ---------------------------------------------------------------- 篷布细节：接缝、卷起的门帘、通风口、地钉
const FlyDetails: React.FC<{ fly: THREE.Material; state: TentState }> = ({ fly, state }) => {
  const { ventOpen, day, doors, sag, flyTemp } = state;
  const m = useMemo(
    () => ({
      seam: labify(new THREE.MeshStandardMaterial({ color: 0xf47a45, roughness: 0.6, side: THREE.DoubleSide, flatShading: true, emissive: 0xff7a3a }), { color: 0xffffff, alpha: 0.22, shade: 0.5 }),
      roll: labify(std(0xd9552a, { roughness: 0.75 }), { color: 0xffffff, alpha: 0.3, shade: 0.5 }),
      strap: labify(new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.6 }), { color: labDim(0x2b2b2b, 0.4) }),
      dark: labify(new THREE.MeshBasicMaterial({ color: 0x1a0d08 }), { color: labDim(0x000000) }),
      steel: labify(new THREE.MeshStandardMaterial({ color: 0xbbbbbb, metalness: 0.8, roughness: 0.35 }), { color: labDim(0xbbbbbb, 0.35) }),
    }),
    [],
  );
  // 接缝和篷布一样被晨光透亮，只是稍浅一点，不会在帐篷里看成一根根黑条
  m.seam.emissiveIntensity = 0.34 * day;
  const fc = thermal(flyTemp);
  m.seam.userData.lab.color.copy(fc);
  m.roll.userData.lab.color.copy(fc);
  m.seam.transparent = m.roll.transparent = state.lab > 0;
  const seams: React.ReactNode[] = [];
  for (const side of [1, -1] as const) {
    for (const x of [-FLY_LEN / 6, FLY_LEN / 6]) {
      const { p, n } = onFly(x, 0.5, side);
      p.addScaledVector(n, -FLY_TH / 2);
      p.y += sagOffset(x, 0.5, sag).dy;
      seams.push(
        <mesh key={`${side}${x}`} material={m.seam} position={p} rotation={[side * SLOPE_ANGLE, 0, 0]}>
          <boxGeometry args={[0.035, FLY_TH + 0.012, SLOPE_LEN]} />
        </mesh>,
      );
    }
  }
  // 门帘卷起绑在两边：沿门口两条斜边；拉上门时卷筒放开变细
  const rollR = lerp(0.045, 0.014, doors);
  const rolls = ([1, -1] as const).map((side) => {
    const a = onFly(FLY_LEN / 2 - 0.05, 0.02, side).p;
    const b = onFly(FLY_LEN / 2 - 0.05, 0.72, side).p;
    const n = onFly(0, 0, side).n;
    const mid = a.clone().add(b).multiplyScalar(0.5).addScaledVector(n, -0.03);
    const d = b.clone().sub(a);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    return (
      <group key={side} position={mid} quaternion={q}>
        <mesh material={m.roll} castShadow>
          <cylinderGeometry args={[rollR, rollR, d.length(), 10]} />
        </mesh>
        {doors < 0.5 &&
          [-0.25, 0.25].map((t) => (
            <mesh key={t} material={m.strap} position={[0, t * d.length(), 0]}>
              <cylinderGeometry args={[rollR + 0.005, rollR + 0.005, 0.025, 10]} />
            </mesh>
          ))}
      </group>
    );
  });
  // 顶部通风口：屋脊下方、帐篷后段两面各一个，罩子绕上边缘撑开
  const vents = ([1, -1] as const).map((side) => {
    const { p } = onFly(VENT_X, VENT_V, side);
    p.y += sagOffset(VENT_X, VENT_V, sag).dy;
    return (
      <group key={side} position={p} rotation={[side * SLOPE_ANGLE, 0, 0]}>
        <mesh material={m.dark} position={[0, 0.002, 0]}>
          <boxGeometry args={[0.34, 0.004, 0.12]} />
        </mesh>
        {/* 铰链在靠屋脊的一边（局部 -z 一侧朝屋脊） */}
        <group position={[0, 0.004, -side * 0.08]} rotation={[-side * (0.12 + 0.75 * ventOpen), 0, 0]}>
          <mesh material={fly} position={[0, 0.006, side * 0.09]} castShadow>
            <boxGeometry args={[0.4, 0.012, 0.2]} />
          </mesh>
        </group>
      </group>
    );
  });
  const stakes = [];
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      stakes.push(
        <mesh key={`${sx}${sz}`} material={m.steel} position={[sx * (FLY_LEN / 2 + 1.0), 0.05, sz * 0.9]}>
          <cylinderGeometry args={[0.012, 0.006, 0.12, 6]} />
        </mesh>,
      );
  return (
    <>
      {seams}
      {rolls}
      {vents}
      {stakes}
    </>
  );
};

/** 门口两扇三角门帘：c = 0 卷在两边，1 拉链拉到中间合上 */
const Doors: React.FC<{ c: number; material: THREE.Material }> = ({ c, material }) => {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(18), 3));
    return g;
  }, []);
  useLayoutEffect(() => {
    const x = FLY_LEN / 2 - 0.018;
    const w = W2 - 0.02;
    const p = geo.attributes.position.array as Float32Array;
    let i = 0;
    for (const s of [1, -1]) {
      for (const [z, y] of [[s * w, EAVE_Y], [s * w * (1 - c), EAVE_Y], [0, H2 - 0.02]]) {
        p[i++] = x;
        p[i++] = y;
        p[i++] = z;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  }, [geo, c]);
  if (c <= 0.01) return null;
  return <mesh geometry={geo} material={material} castShadow />;
};

/** 门口杆顶的小飘带：wind 0 垂着，1 被风吹平、抖动 */
const Ribbon: React.FC<{ wind: number; time: number; material: THREE.Material }> = ({ wind, time, material }) => {
  const N = 16;
  const L = 0.5;
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array((N + 1) * 2 * 3), 3));
    const idx: number[] = [];
    for (let i = 0; i < N; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    g.setIndex(idx);
    return g;
  }, []);
  useLayoutEffect(() => {
    const p = geo.attributes.position.array as Float32Array;
    const down = new THREE.Vector3(0, -1, 0);
    const lee = new THREE.Vector3(-1, 0.06, 0.12).normalize(); // 风从门口吹来，飘带朝帐篷尾部
    const dir = down.clone().lerp(lee, Math.sin((Math.min(wind, 1) * Math.PI) / 2)).normalize();
    const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 0, 1)).normalize();
    for (let i = 0; i <= N; i++) {
      const l = (i / N) * L;
      const flutter = Math.sin(l * 22 - time * 13) * 0.025 * wind * (l / L) + Math.sin(time * 1.3 + l * 4) * 0.01 * (l / L);
      const c = dir.clone().multiplyScalar(l).add(new THREE.Vector3(0, 0, flutter));
      const w = 0.04 * (1 - 0.4 * (l / L));
      p.set([...c.clone().addScaledVector(side, w).toArray(), ...c.clone().addScaledVector(side, -w).toArray()], i * 6);
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  }, [geo, wind, time]);
  return <mesh geometry={geo} material={material} position={[FLY_LEN / 2 + 0.03, H2 + 0.05, 0]} castShadow />;
};

/** 量杯：Lab View 里一个人一夜呼出的水量，水位跟着帐篷里的水汽一起涨 */
const CUP = { x: 0.95, z: 0.42, r: 0.075, h: 0.18 };
const Cup: React.FC<{ show: number; fill: number }> = ({ show, fill }) => {
  const m = useMemo(
    () => ({
      glass: labify(new THREE.MeshStandardMaterial({ color: 0xdfefff, transparent: true, opacity: 0.35, roughness: 0.1, side: THREE.DoubleSide, depthWrite: false }), { color: 0xcfe6ff, alpha: 0.3, shade: 0.6 }),
      rim: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xcfe6ff).multiplyScalar(1.2), toneMapped: false }),
      water: new THREE.MeshBasicMaterial({ color: new THREE.Color(brand.lab.vapor).multiplyScalar(0.9), transparent: true, opacity: 0.85, toneMapped: false }),
      mark: new THREE.MeshBasicMaterial({ color: 0xcfe6ff, toneMapped: false }),
    }),
    [],
  );
  const glass = useMemo(() => {
    const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(CUP.r * 0.9, 0), new THREE.Vector2(CUP.r, CUP.h)];
    return new THREE.LatheGeometry(pts, 18);
  }, []);
  if (show <= 0.001) return null;
  // 弹一下出现
  const s = show < 1 ? show * (1 + 0.3 * Math.sin(show * Math.PI)) : 1;
  const wh = Math.max(fill, 0.001) * CUP.h * 0.86;
  return (
    <group position={[CUP.x, 0.08, CUP.z]} scale={s}>
      <mesh geometry={glass} material={m.glass} />
      <mesh material={m.rim} position={[0, CUP.h, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[CUP.r, 0.0035, 6, 24]} />
      </mesh>
      {/* 把手 */}
      <mesh material={m.rim} position={[-CUP.r - 0.02, CUP.h * 0.55, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.035, 0.005, 6, 12, Math.PI]} />
      </mesh>
      {/* 刻度：顶上那条就是“一杯” */}
      {[0.43, 0.86].map((k) => (
        <mesh key={k} material={m.mark} position={[0, CUP.h * k, 0]} rotation={[Math.PI / 2, 0, 0.6]}>
          <torusGeometry args={[CUP.r * (0.9 + 0.1 * k) + 0.001, 0.0022, 4, 10, 0.9]} />
        </mesh>
      ))}
      <mesh material={m.water} position={[0, 0.004 + wh / 2, 0]}>
        <cylinderGeometry args={[CUP.r * (0.9 + 0.1 * (wh / CUP.h)) - 0.006, CUP.r * 0.9 - 0.006, wh, 18]} />
      </mesh>
    </group>
  );
};

/** 拉绳：从屋脊两端到地钉；外帐松的时候绳子往下垂 */
const GuyLines: React.FC<{ sag: number; material: THREE.Material }> = ({ sag, material }) => {
  const geos = useMemo(() => {
    const out: THREE.TubeGeometry[] = [];
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const a = new THREE.Vector3(sx * (FLY_LEN / 2), H2 * 0.85, 0);
        const b = new THREE.Vector3(sx * (FLY_LEN / 2 + 1.0), 0.02, sz * 0.9);
        const mid = a.clone().lerp(b, 0.5);
        mid.y -= 0.16 * sag;
        mid.x -= sx * 0.08 * sag;
        out.push(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 12, 0.006, 4));
      }
    return out;
  }, [sag]);
  return (
    <>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} material={material} />
      ))}
    </>
  );
};

const DROPS = dropletLayout(900);

export const Tent: React.FC<{ state: TentState }> = ({ state }) => {
  const gl = useThree((s) => s.gl);
  const env = useMemo(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const t = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    return t;
  }, [gl]);
  const g = useMemo(() => {
    const fly = extrudeX(lambdaShape(W2, H2, FLY_TH, EAVE_Y), FLY_LEN, 16);
    return {
      fly,
      flyBase: (fly.attributes.position.array as Float32Array).slice(),
      edges: new THREE.EdgesGeometry(extrudeX(lambdaShape(W2, H2, FLY_TH, EAVE_Y), FLY_LEN), 25),
      back: extrudeX(triangleShape(W2 - 0.05, EAVE_Y, H2 - 0.03), 0.025),
      inner: extrudeX(lambdaShape(IW, IH, 0.012, 0.03), TL - 0.2),
      air: extrudeX(lambdaShape(IW - 0.05, IH - 0.07, IW, 0.1), TL - 0.34),
    };
  }, []);
  const m = useMemo(() => {
    const flyParams = { color: 0xf06a35, roughness: 0.7, side: THREE.DoubleSide, flatShading: true, emissive: 0xff6a2a, emissiveIntensity: 0 } as const;
    const flyLab = { color: thermal(0.55), alpha: 0.26, shade: 0.5 };
    return {
      // 外帐两份材质：普通视角用不透明的（水珠折射里要看得见它），Lab View 用半透明的
      fly: labify(new THREE.MeshStandardMaterial(flyParams), flyLab),
      flyLab: labify(new THREE.MeshStandardMaterial({ ...flyParams, transparent: true, depthWrite: false }), flyLab),
      edges: labify(new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }), { color: 0xffffff, alpha: 1, shade: 0 }),
      inner: labify(new THREE.MeshStandardMaterial({ color: 0xf7e6c4, alphaMap: netTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 0.9 }), { color: thermal(T.inner), alpha: 0.18, alphaMul: true, shade: 0.4 }),
      floor: labify(std(0x3d4a5c), { color: labDim(0x3d4a5c, 0.35) }),
      pole: labify(new THREE.MeshStandardMaterial({ color: 0x2b2b2b, metalness: 0.5, roughness: 0.4 }), { color: labDim(0x6a8ad8, 0.3), shade: 0.5 }),
      line: labify(new THREE.MeshBasicMaterial({ color: 0xe8e2d6 }), { color: 0x23365e, shade: 0 }),
      ribbon: labify(new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffc21a, emissiveIntensity: 0.35, roughness: 0.7, side: THREE.DoubleSide, flatShading: true }), { color: thermal(0.5), shade: 0.4 }),
      pad: labify(std(0x2e8b6e), { color: thermal(T.pad) }),
      bag: labify(new THREE.MeshStandardMaterial({ color: 0x3b6fd6, roughness: 0.6 }), { color: thermal(T.bag) }),
      pillow: labify(new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.9 }), { color: thermal(T.pillow) }),
      skin: labify(new THREE.MeshStandardMaterial({ color: 0xf1c29a, roughness: 0.6 }), { color: thermal(T.skin), shade: 0.5 }),
      hair: labify(new THREE.MeshStandardMaterial({ color: 0x3a2a22, roughness: 0.8 }), { color: thermal(T.hair) }),
      air: labify(new THREE.MeshBasicMaterial({ color: 0xff7a33, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), { color: 0xff6a22, alpha: 0, shade: 0 }),
      wet: new THREE.MeshStandardMaterial({ color: 0x2a55b0, roughness: 0.25, transparent: true, depthWrite: false }),
      drop: labify(new THREE.MeshPhysicalMaterial({ transparent: false, color: 0xe6f6ff, roughness: 0.03, transmission: 1, thickness: 0.04, ior: 1.33, envMap: env, envMapIntensity: 1.0 }), { color: 0x5fd4ff, alpha: 0.8, shade: 0.7 }),
      // 主角水珠：反光更亮、带一点冷色，在一片小水珠里一眼能认出来
      hero: new THREE.MeshPhysicalMaterial({ color: 0xd8f1ff, roughness: 0.0, transmission: 1, thickness: 0.12, ior: 1.33, envMap: env, envMapIntensity: 2.6, attenuationColor: new THREE.Color(0x9fd8ff), attenuationDistance: 0.25, emissive: 0x7fc8ff, emissiveIntensity: 0.12 }),
    };
  }, [env]);

  // 晨光透过橙色篷布：用一点自发光假装透光
  const fly = state.lab > 0 ? m.flyLab : m.fly;
  const fc = thermal(state.flyTemp);
  for (const f of [m.fly, m.flyLab]) {
    f.emissiveIntensity = 0.28 * state.day;
    f.userData.lab.color.copy(fc);
  }
  m.edges.userData.lab.color.copy(fc).multiplyScalar(1.5);
  m.inner.opacity = 0.8 * state.inner;
  m.wet.opacity = 0.55 * state.bigDrop.splash;
  m.air.userData.lab.alpha.value = 0.1 * state.air;

  // 外帐松垮：按 sagOffset 把挤出体的顶点往下、往里推
  useLayoutEffect(() => {
    const pos = g.fly.attributes.position.array as Float32Array;
    const base = g.flyBase;
    for (let i = 0; i < pos.length; i += 3) {
      const x = base[i];
      const y = base[i + 1];
      const z = base[i + 2];
      const v = clamp01((y - EAVE_Y) / (H2 - EAVE_Y));
      const { dy, dIn } = sagOffset(x, v, state.sag);
      pos[i] = x;
      pos[i + 1] = y + dy;
      pos[i + 2] = z - Math.sign(z) * dIn;
    }
    g.fly.attributes.position.needsUpdate = true;
    g.fly.computeVertexNormals();
  }, [g, state.sag]);

  const dropsRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const im = dropsRef.current;
    if (!im) return;
    const mm = new THREE.Matrix4();
    DROPS.forEach((d, i) => {
      const k = clamp01((state.drops - d.start) / 0.3);
      const s = d.r * k;
      // 外帐松垮时水珠跟着布面一起往下、往里走，不然会从布外面冒出来
      const { dy, dIn } = sagOffset(d.pos.x, clamp01((d.pos.y - EAVE_Y) / (H2 - EAVE_Y)), state.sag);
      mm.makeScale(s, s * 1.25, s).setPosition(d.pos.x, d.pos.y + dy, d.pos.z - Math.sign(d.pos.z) * dIn);
      im.setMatrixAt(i, mm);
    });
    im.instanceMatrix.needsUpdate = true;
  }, [state.drops, state.sag]);

  // 那一颗大水珠：在屋脊附近长大、落下、砸在睡袋上溅开
  const { grow, fall, splash } = state.bigDrop;
  const top = underFly(BIG_DROP.x, BIG_DROP.v, 1, 0.03);
  const BAG_TOP = bagTopAt(top.z);
  const dropY = fall < 0 ? top.y - 0.045 * grow : lerp(top.y - 0.045, BAG_TOP + 0.04, fall * fall);
  const dropScale = fall < 0 ? lerp(0.6, 1, grow) : 1;
  const breathe = 1 + 0.025 * Math.sin((state.time / BREATH) * Math.PI * 2);
  const labOn = state.lab > 0;

  return (
    <group position={[0, tentY(state), 0]}>
      {/* 门口照进来的晨光，让篷布从门口往里有明暗过渡 */}
      <pointLight position={[1.25, 0.7, 0]} color={0xffd2a0} intensity={2.5 * state.day} distance={3.2} decay={1.5} />
      <mesh geometry={g.fly} material={fly} castShadow receiveShadow />
      <mesh geometry={g.back} material={fly} position={[-FLY_LEN / 2, 0, 0]} castShadow />
      {labOn && state.sag < 0.01 && <lineSegments geometry={g.edges} material={m.edges} renderOrder={5} />}
      <FlyDetails fly={fly} state={state} />
      <Doors c={state.doors} material={fly} />
      <mesh geometry={g.inner} material={m.inner} visible={state.inner > 0.01} />
      {labOn && state.air > 0 && <mesh geometry={g.air} material={m.air} renderOrder={4} />}
      <mesh material={m.floor} position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[TL - 0.2, 0.08, TW - 0.24]} />
      </mesh>
      {[-1, 1].map((sx) => (
        <mesh key={sx} material={m.pole} position={[sx * (FLY_LEN / 2 + 0.03), (H2 + 0.05) / 2, 0]} castShadow>
          <cylinderGeometry args={[0.022, 0.022, H2 + 0.05, 8]} />
        </mesh>
      ))}
      <GuyLines sag={state.sag} material={m.line} />
      <Ribbon wind={state.wind} time={state.time} material={m.ribbon} />
      {/* 睡着的人：头朝门，这样呼出的水汽对着镜头 */}
      <mesh material={m.pad} position={[0, 0.1, 0]} receiveShadow>
        <boxGeometry args={[1.95, 0.04, 0.62]} />
      </mesh>
      <mesh material={m.bag} position={[-0.12, 0.25, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.62 * breathe, 1, 1]} castShadow receiveShadow>
        <capsuleGeometry args={[0.26, 1.25, 8, 18]} />
      </mesh>
      <mesh material={m.pillow} position={[0.78, 0.17, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.3, 0.1, 0.44]} />
      </mesh>
      <mesh material={m.skin} position={[0.7, 0.33, 0]} castShadow>
        <sphereGeometry args={[0.14, 24, 16]} />
      </mesh>
      <mesh material={m.hair} position={[0.79, 0.35, 0]} scale={[0.7, 1, 0.95]} castShadow>
        <sphereGeometry args={[0.146, 24, 16]} />
      </mesh>
      <Cup show={state.cup.show} fill={state.cup.fill} />
      {/* 凝结水 */}
      <instancedMesh ref={dropsRef} args={[undefined, undefined, DROPS.length]} material={m.drop} frustumCulled={false}>
        <sphereGeometry args={[1, 14, 10]} />
      </instancedMesh>
      {state.bigDrop.show && splash < 1 && (
        <mesh material={m.hero} position={[BIG_DROP.x, dropY, top.z]} scale={[0.06 * dropScale, 0.06 * dropScale * (fall < 0 ? 1.2 + 0.35 * grow : 1.7), 0.06 * dropScale]}>
          <sphereGeometry args={[1, 24, 18]} />
        </mesh>
      )}
      {splash > 0 && (
        <>
          <mesh material={m.wet} position={[BIG_DROP.x, BAG_TOP + 0.004, top.z]} rotation={[-Math.PI / 2, 0, 0]} scale={lerp(0.02, 0.09, Math.sqrt(splash))}>
            <circleGeometry args={[1, 24]} />
          </mesh>
          {Array.from({ length: 9 }, (_, i) => {
            const a = (i / 9) * Math.PI * 2 + random(`splash-${i}`);
            const v = 0.18 + random(`splash-v-${i}`) * 0.12;
            const s = splash;
            return (
              <mesh
                key={i}
                material={m.drop}
                position={[BIG_DROP.x + Math.cos(a) * v * s, BAG_TOP + 0.02 + (0.35 * s - 0.5 * s * s) * 0.5, top.z + Math.sin(a) * v * s]}
                scale={0.012 * (1 - s)}
              >
                <sphereGeometry args={[1, 10, 8]} />
              </mesh>
            );
          })}
        </>
      )}
      <Vapour state={state} />
      <BreathFog age={state.breathFog} time={state.time} />
      <FlowLines curves={HEAT_CURVES} radius={0.011} color={thermal(0.82)} time={state.time} speed={0.9} dashes={5} duty={0.55} opacity={state.heat} />
      <FlowLines curves={STREAM_CURVES} radius={0.009} color={0xd6f6ff} time={state.time} speed={1.6} dashes={14} duty={0.4} opacity={state.streams * 0.9} force={1} />
      <Macro state={state} env={env} />
    </group>
  );
};
