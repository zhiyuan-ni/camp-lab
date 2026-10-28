import React, { useLayoutEffect, useMemo, useRef } from "react";
import { random } from "remotion";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { useThree } from "@react-three/fiber";
import { clamp01, lerp } from "../math";
import {
  EAVE_Y, FLY_LEN, FLY_TH, H2, IH, ISLAND_R, IW, TL, TW, W2,
  dropletLayout, extrudeX, lambdaShape, netTexture, triangleShape, underFly,
} from "./geometry";
import type { TentState } from "./state";
import { BIG_DROP, bagTopAt } from "./state";

const C = (hex: number) => new THREE.Color(hex);

// ---------------------------------------------------------------- 天空：一个参数从深夜到清晨
const SKY_KEYS = [
  { d: 0, top: 0x060a20, mid: 0x18204e, hor: 0x46407a },
  { d: 0.5, top: 0x23306a, mid: 0x6a5c9a, hor: 0xf09a78 },
  { d: 1, top: 0x6fa8dc, mid: 0xbfd7ea, hor: 0xffd9a8 },
];
const skyAt = (day: number, key: "top" | "mid" | "hor") => {
  const k = day < 0.5 ? 0 : 1;
  const t = (day - SKY_KEYS[k].d) / 0.5;
  return C(SKY_KEYS[k][key]).lerp(C(SKY_KEYS[k + 1][key]), clamp01(t));
};

/** 太阳方向：清晨在东边（+x，略偏 +z），倒带时沉到地平线下 */
const sunDir = (day: number) => {
  const elev = lerp(-0.25, 0.32, day);
  const az = 0.55;
  return new THREE.Vector3(Math.cos(elev) * Math.cos(az), Math.sin(elev), Math.cos(elev) * Math.sin(az)).normalize();
};

const Sky: React.FC<{ day: number }> = ({ day }) => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        toneMapped: false,
        uniforms: { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, hor: { value: new THREE.Color() } },
        vertexShader: "varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
        fragmentShader:
          "uniform vec3 top, mid, hor; varying vec3 vp; void main(){ float h = clamp(vp.y, 0., 1.); vec3 c = mix(hor, mid, smoothstep(0., .2, h)); c = mix(c, top, smoothstep(.2, .75, h)); gl_FragColor = vec4(c, 1.); }",
      }),
    [],
  );
  useLayoutEffect(() => {
    mat.uniforms.top.value.copy(skyAt(day, "top"));
    mat.uniforms.mid.value.copy(skyAt(day, "mid"));
    mat.uniforms.hor.value.copy(skyAt(day, "hor"));
  }, [day, mat]);
  const stars = useMemo(() => {
    const pts: number[] = [];
    for (let i = 0; i < 900; i++) {
      const a = random(`star-a-${i}`) * Math.PI * 2;
      const y = 0.06 + random(`star-y-${i}`) * 0.94;
      const r = Math.sqrt(1 - y * y);
      pts.push(Math.cos(a) * r * 150, y * 150, Math.sin(a) * r * 150);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  const sun = sunDir(day).multiplyScalar(160);
  return (
    <>
      <mesh material={mat}>
        <sphereGeometry args={[200, 32, 16]} />
      </mesh>
      <points geometry={stars}>
        <pointsMaterial color={0xdde6ff} size={2.2} sizeAttenuation={false} transparent opacity={0.85 * Math.pow(1 - clamp01(day * 1.6), 2)} toneMapped={false} />
      </points>
      <mesh position={sun.toArray()}>
        <sphereGeometry args={[5, 24, 12]} />
        <meshBasicMaterial color={C(0xfff1c8).multiplyScalar(1.4)} toneMapped={false} transparent opacity={clamp01(day * 2 - 0.6)} />
      </mesh>
    </>
  );
};

const Lights: React.FC<{ day: number }> = ({ day }) => {
  const sun = sunDir(day).multiplyScalar(12);
  const shadow = { "shadow-mapSize": [2048, 2048] as [number, number], "shadow-bias": -0.0005, "shadow-camera-left": -6, "shadow-camera-right": 6, "shadow-camera-top": 6, "shadow-camera-bottom": -6 };
  return (
    <>
      <hemisphereLight args={[C(0x3a4a9a).lerp(C(0xcfe3ff), day), C(0x0d1410).lerp(C(0x6e8a4e), day), lerp(0.9, 1.1, day)]} />
      {/* 月光：夜里的主光 */}
      <directionalLight position={[-6, 9, 5]} color={0xa8bdff} intensity={1.5 * (1 - day)} castShadow={day < 0.5} {...shadow} />
      {/* 太阳：清晨低角度的暖光，倒带时沉下去 */}
      <directionalLight position={sun.toArray()} color={0xffd2a0} intensity={3.2 * clamp01(day * 1.4 - 0.2)} castShadow={day >= 0.5} {...shadow} />
      <directionalLight position={[6, 3, -8]} color={0xff9a8a} intensity={0.5 * (1 - day)} />
    </>
  );
};

// ---------------------------------------------------------------- 小岛：草地、土层、草丛、松树、石头
const mat = (hex: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color: hex, roughness: 0.85, flatShading: true, ...extra });

const Pine: React.FC<{ x: number; z: number; s: number; i: number }> = ({ x, z, s, i }) => {
  const col = [0x2f6b4a, 0x245840, 0x356f4c][i % 3];
  const leaves = useMemo(() => mat(col), [col]);
  const trunk = useMemo(() => mat(0x6e4a2e), []);
  return (
    <group position={[x, 0, z]} rotation={[0, random(`pine-${i}`) * 6, 0]}>
      <mesh castShadow receiveShadow material={trunk} position={[0, 0.3 * s, 0]}>
        <cylinderGeometry args={[0.09 * s, 0.13 * s, 0.6 * s, 6]} />
      </mesh>
      {[0, 1, 2, 3].map((k) => {
        const r = (0.95 - k * 0.2) * s;
        const h = (0.95 - k * 0.1) * s;
        return (
          <mesh key={k} castShadow receiveShadow material={leaves} position={[0, (0.6 + k * 0.5) * s + h / 2 - 0.15 * s, 0]} rotation={[0, k * 0.5, 0]}>
            <coneGeometry args={[r, h, 7]} />
          </mesh>
        );
      })}
    </group>
  );
};

const Tufts: React.FC = () => {
  const meshes = useMemo(() => {
    const cols = [0x4a8442, 0x7cbf63, 0x6aa84f];
    const blade = new THREE.ConeGeometry(0.025, 1, 4);
    blade.translate(0, 0.5, 0);
    const per: THREE.Matrix4[][] = [[], [], []];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < 320; i++) {
      const a = random(`tuft-a-${i}`) * Math.PI * 2;
      const r = Math.sqrt(random(`tuft-r-${i}`)) * (ISLAND_R - 0.3);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.abs(x) < 1.75 && Math.abs(z) < 1.45) continue; // 帐篷底下不长草
      for (let k = 0; k < 4; k++) {
        const h = 0.14 + random(`tuft-h-${i}-${k}`) * 0.18;
        q.setFromEuler(new THREE.Euler((random(`tuft-rx-${i}-${k}`) - 0.5) * 0.6, 0, (random(`tuft-rz-${i}-${k}`) - 0.5) * 0.6));
        m.compose(new THREE.Vector3(x + (random(`tuft-dx-${i}-${k}`) - 0.5) * 0.1, 0, z + (random(`tuft-dz-${i}-${k}`) - 0.5) * 0.1), q, new THREE.Vector3(1, h, 1));
        per[k % 3].push(m.clone());
      }
    }
    return per.map((list, c) => {
      const im = new THREE.InstancedMesh(blade, mat(cols[c]), list.length);
      list.forEach((mm, j) => im.setMatrixAt(j, mm));
      im.receiveShadow = true;
      return im;
    });
  }, []);
  return (
    <>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </>
  );
};

const Island: React.FC = () => {
  const m = useMemo(() => ({ grass: mat(0x5fa04e), soil: mat(0x8a5a3b), deep: mat(0x5e3c2a), rock: mat(0x7c7f86), rock2: mat(0x9a8f80) }), []);
  const rocks: [number, number, number][] = [[2.6, -2.2, 1.2], [3.1, -1.5, 0.7], [-2.4, 2.6, 0.9], [3.4, 2.2, 0.8]];
  return (
    <>
      <mesh receiveShadow material={m.grass} position={[0, -0.08, 0]}>
        <cylinderGeometry args={[ISLAND_R, ISLAND_R - 0.05, 0.16, 64]} />
      </mesh>
      <mesh receiveShadow material={m.soil} position={[0, -0.6, 0]}>
        <cylinderGeometry args={[ISLAND_R - 0.04, ISLAND_R - 0.5, 0.9, 64]} />
      </mesh>
      <mesh receiveShadow material={m.deep} position={[0, -1.4, 0]}>
        <cylinderGeometry args={[ISLAND_R - 0.5, ISLAND_R - 1.3, 0.7, 64]} />
      </mesh>
      <Tufts />
      {([[-3.0, -1.9, 1.35], [-1.6, -3.4, 1.1], [-3.5, -0.4, 0.95], [0.8, -3.7, 0.85]] as const).map(([x, z, s], i) => (
        <Pine key={i} x={x} z={z} s={s} i={i} />
      ))}
      {rocks.map(([x, z, s], i) => (
        <mesh
          key={i}
          castShadow
          receiveShadow
          material={i % 2 ? m.rock2 : m.rock}
          position={[x, 0.08 * s, z]}
          rotation={[0, random(`rock-${i}`) * 6, 0]}
          scale={[1.2 * s, 0.65 * s, 1.1 * s]}
        >
          <dodecahedronGeometry args={[0.3, 0]} />
        </mesh>
      ))}
    </>
  );
};

// ---------------------------------------------------------------- 帐篷、睡着的人、凝结水
const DROPS = dropletLayout(900);

const Tent: React.FC<{ state: TentState }> = ({ state }) => {
  const gl = useThree((s) => s.gl);
  const env = useMemo(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const t = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    return t;
  }, [gl]);
  const g = useMemo(
    () => ({
      fly: extrudeX(lambdaShape(W2, H2, FLY_TH, EAVE_Y), FLY_LEN),
      back: extrudeX(triangleShape(W2 - 0.05, EAVE_Y, H2 - 0.03), 0.025),
      inner: extrudeX(lambdaShape(IW, IH, 0.012, 0.03), TL - 0.2),
    }),
    [],
  );
  const m = useMemo(
    () => ({
      fly: new THREE.MeshStandardMaterial({ color: 0xf06a35, roughness: 0.7, side: THREE.DoubleSide, flatShading: true, emissive: 0xff6a2a, emissiveIntensity: 0 }),
      inner: new THREE.MeshStandardMaterial({ color: 0xf7e6c4, alphaMap: netTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 0.9 }),
      floor: mat(0x3d4a5c),
      pole: new THREE.MeshStandardMaterial({ color: 0x2b2b2b, metalness: 0.5, roughness: 0.4 }),
      line: new THREE.MeshBasicMaterial({ color: 0xe8e2d6 }),
      pad: mat(0x2e8b6e),
      bag: new THREE.MeshStandardMaterial({ color: 0x3b6fd6, roughness: 0.6 }),
      pillow: new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.9 }),
      skin: new THREE.MeshStandardMaterial({ color: 0xf1c29a, roughness: 0.6 }),
      hair: new THREE.MeshStandardMaterial({ color: 0x3a2a22, roughness: 0.8 }),
      wet: new THREE.MeshStandardMaterial({ color: 0x2a55b0, roughness: 0.25, transparent: true, depthWrite: false }),
      drop: new THREE.MeshPhysicalMaterial({ color: 0xe6f6ff, roughness: 0.03, transmission: 1, thickness: 0.04, ior: 1.33, envMap: env, envMapIntensity: 1.0 }),
    }),
    [env],
  );
  // 晨光透过橙色篷布：用一点自发光假装透光
  m.fly.emissiveIntensity = 0.28 * state.day;
  m.inner.opacity = 0.8 * state.inner;
  m.wet.opacity = 0.55 * state.bigDrop.splash;

  const dropsRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const im = dropsRef.current;
    if (!im) return;
    const mm = new THREE.Matrix4();
    DROPS.forEach((d, i) => {
      const k = clamp01((state.drops - d.start) / 0.3);
      const s = d.r * k;
      mm.makeScale(s, s * 1.25, s).setPosition(d.pos);
      im.setMatrixAt(i, mm);
    });
    im.instanceMatrix.needsUpdate = true;
  }, [state.drops]);

  const guy = useMemo(() => {
    const out: { pos: THREE.Vector3; quat: THREE.Quaternion; len: number }[] = [];
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const a = new THREE.Vector3(sx * (FLY_LEN / 2), H2 * 0.85, 0);
        const b = new THREE.Vector3(sx * (FLY_LEN / 2 + 1.0), 0.02, sz * 0.9);
        const d = b.clone().sub(a);
        out.push({ pos: a.clone().add(b).multiplyScalar(0.5), quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()), len: d.length() });
      }
    return out;
  }, []);

  // 那一颗大水珠：在屋脊附近长大、落下、砸在睡袋上溅开
  const { grow, fall, splash } = state.bigDrop;
  const top = underFly(BIG_DROP.x, BIG_DROP.v, 1, 0.03);
  const BAG_TOP = bagTopAt(top.z);
  const dropY = fall < 0 ? top.y - 0.045 * grow : lerp(top.y - 0.045, BAG_TOP + 0.04, fall * fall);
  const dropScale = fall < 0 ? lerp(0.6, 1, grow) : 1;
  const breathe = 1 + 0.025 * Math.sin((state.time / 4.2) * Math.PI * 2);

  return (
    <group>
      {/* 门口照进来的晨光，让篷布从门口往里有明暗过渡 */}
      <pointLight position={[1.25, 0.7, 0]} color={0xffd2a0} intensity={2.5 * state.day} distance={3.2} decay={1.5} />
      <mesh geometry={g.fly} material={m.fly} castShadow receiveShadow />
      <mesh geometry={g.back} material={m.fly} position={[-FLY_LEN / 2, 0, 0]} castShadow />
      <mesh geometry={g.inner} material={m.inner} visible={state.inner > 0.01} />
      <mesh material={m.floor} position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[TL - 0.2, 0.08, TW - 0.24]} />
      </mesh>
      {[-1, 1].map((sx) => (
        <mesh key={sx} material={m.pole} position={[sx * (FLY_LEN / 2 + 0.03), (H2 + 0.05) / 2, 0]} castShadow>
          <cylinderGeometry args={[0.022, 0.022, H2 + 0.05, 8]} />
        </mesh>
      ))}
      {guy.map((l, i) => (
        <mesh key={i} material={m.line} position={l.pos} quaternion={l.quat}>
          <cylinderGeometry args={[0.006, 0.006, l.len, 4]} />
        </mesh>
      ))}
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
      {/* 凝结水 */}
      <instancedMesh ref={dropsRef} args={[undefined, undefined, DROPS.length]} material={m.drop} frustumCulled={false}>
        <sphereGeometry args={[1, 14, 10]} />
      </instancedMesh>
      {state.bigDrop.show && splash < 1 && (
        <mesh material={m.drop} position={[BIG_DROP.x, dropY, top.z]} scale={[0.06 * dropScale, 0.06 * dropScale * (fall < 0 ? 1.2 + 0.35 * grow : 1.7), 0.06 * dropScale]}>
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
    </group>
  );
};

export const World: React.FC<{ state: TentState; vertical: boolean }> = ({ state }) => (
  <>
    <Sky day={state.day} />
    <Lights day={state.day} />
    <Island />
    <Tent state={state} />
  </>
);
