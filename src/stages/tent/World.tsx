import React, { useLayoutEffect, useMemo } from "react";
import { random } from "remotion";
import * as THREE from "three";
import { brand } from "../../brand";
import { clamp01, lerp } from "../math";
import { LAB_MASK_GLSL, labDim, labify, labUniforms, scanHeight, toOutput } from "../lab";
import { ISLAND_R } from "./geometry";
import type { TentState } from "./state";
import { POND, groundY } from "./state";
import { Tent } from "./Tent";

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

/** 扫描面从这么高扫到这么低：天空按“离相机 12 米处”的高度算，所以扫描线也会扫过天空 */
const SCAN_TOP = 2.7;
const SCAN_BOTTOM = -0.7;

const Sky: React.FC<{ day: number }> = ({ day }) => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        toneMapped: false,
        uniforms: {
          ...labUniforms,
          top: { value: new THREE.Color() },
          mid: { value: new THREE.Color() },
          hor: { value: new THREE.Color() },
          // 和其他天空色一样直接当输出值用（不做色彩空间换算），保持 s01–s02 定下的样子
          labTop: { value: new THREE.Color(brand.lab.sky.top) },
          labMid: { value: new THREE.Color(brand.lab.sky.mid) },
          labHor: { value: new THREE.Color(brand.lab.sky.hor) },
        },
        vertexShader: "varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
        fragmentShader: `
          uniform vec3 top, mid, hor, labTop, labMid, labHor;
          varying vec3 vp;
          ${LAB_MASK_GLSL}
          void main(){
            float h = clamp(vp.y, 0., 1.);
            vec3 c = mix(hor, mid, smoothstep(0., .2, h)); c = mix(c, top, smoothstep(.2, .75, h));
            vec3 l = mix(labHor, labMid, smoothstep(0., .18, h)); l = mix(l, labTop, smoothstep(.18, .7, h));
            float y = cameraPosition.y + vp.y * 12.;
            c = mix(c, l, labMask(y)) + uScanColor * scanBand(y);
            gl_FragColor = vec4(c, 1.);
          }`,
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
/** 低多边形材质；Lab View 里压暗成深海军蓝 */
export const envMat = (hex: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
  labify(new THREE.MeshStandardMaterial({ color: hex, roughness: 0.85, flatShading: true, ...extra }), { color: labDim(hex) });

const Pine: React.FC<{ x: number; z: number; s: number; i: number; y: number }> = ({ x, z, s, i, y }) => {
  const col = [0x2f6b4a, 0x245840, 0x356f4c][i % 3];
  const leaves = useMemo(() => envMat(col), [col]);
  const trunk = useMemo(() => envMat(0x6e4a2e), []);
  return (
    <group position={[x, y, z]} rotation={[0, random(`pine-${i}`) * 6, 0]}>
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

type Blade = { x: number; z: number; h: number; q: THREE.Quaternion; c: number };
const BLADES: Blade[] = (() => {
  const out: Blade[] = [];
  for (let i = 0; i < 320; i++) {
    const a = random(`tuft-a-${i}`) * Math.PI * 2;
    const r = Math.sqrt(random(`tuft-r-${i}`)) * (ISLAND_R - 0.3);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.abs(x) < 1.75 && Math.abs(z) < 1.45) continue; // 帐篷底下不长草
    for (let k = 0; k < 4; k++) {
      const h = 0.14 + random(`tuft-h-${i}-${k}`) * 0.18;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler((random(`tuft-rx-${i}-${k}`) - 0.5) * 0.6, 0, (random(`tuft-rz-${i}-${k}`) - 0.5) * 0.6));
      out.push({ x: x + (random(`tuft-dx-${i}-${k}`) - 0.5) * 0.1, z: z + (random(`tuft-dz-${i}-${k}`) - 0.5) * 0.1, h, q, c: k % 3 });
    }
  }
  return out;
})();

const Tufts: React.FC<{ dip: number; pond: number }> = ({ dip, pond }) => {
  const meshes = useMemo(() => {
    const cols = [0x4a8442, 0x7cbf63, 0x6aa84f];
    const blade = new THREE.ConeGeometry(0.025, 1, 4);
    blade.translate(0, 0.5, 0);
    return cols.map((col, c) => {
      const im = new THREE.InstancedMesh(blade, envMat(col), BLADES.filter((b) => b.c === c).length);
      im.receiveShadow = true;
      return im;
    });
  }, []);
  // 草跟着地面走：低洼时一起沉下去，水塘里的草没进水里
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const idx = [0, 0, 0];
    for (const b of BLADES) {
      const wet = 1 - pond * clamp01(1.2 - Math.hypot(b.x - POND.x, b.z - POND.z) / POND.r);
      m.compose(new THREE.Vector3(b.x, groundY(b.x, b.z, dip, pond), b.z), b.q, new THREE.Vector3(1, b.h * Math.max(wet, 0.001), 1));
      meshes[b.c].setMatrixAt(idx[b.c]++, m);
    }
    meshes.forEach((im) => (im.instanceMatrix.needsUpdate = true));
  }, [meshes, dip, pond]);
  return (
    <>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </>
  );
};

/** 草地顶面：细分的圆盘，顶点高度由 groundY 算，低洼和水塘都是它变形出来的 */
const GroundTop: React.FC<{ dip: number; pond: number; material: THREE.Material }> = ({ dip, pond, material }) => {
  const { geo, base } = useMemo(() => {
    const g = new THREE.RingGeometry(0, ISLAND_R, 72, 24);
    g.rotateX(-Math.PI / 2);
    return { geo: g, base: (g.attributes.position.array as Float32Array).slice() };
  }, []);
  useLayoutEffect(() => {
    const pos = geo.attributes.position.array as Float32Array;
    for (let i = 0; i < pos.length; i += 3) pos[i + 1] = groundY(base[i], base[i + 2], dip, pond);
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
  }, [geo, base, dip, pond]);
  return <mesh geometry={geo} material={material} receiveShadow />;
};

const Pond: React.FC<{ pond: number; dip: number }> = ({ pond, dip }) => {
  const water = useMemo(
    () => labify(new THREE.MeshStandardMaterial({ color: 0x3a6f9e, roughness: 0.08, metalness: 0.25, emissive: 0x24486e, emissiveIntensity: 0.45, flatShading: true }), { color: labDim(0x3a6f9e, 0.3) }),
    [],
  );
  if (pond <= 0.001) return null;
  const y = groundY(POND.x, POND.z, dip, 0) - 0.05;
  return (
    <mesh material={water} position={[POND.x, y, POND.z]} rotation={[-Math.PI / 2, 0, 0.3]} scale={Math.sqrt(pond)}>
      <circleGeometry args={[POND.r * 1.02, 14]} />
    </mesh>
  );
};

/** 一棵阔叶树：从地里长出来，树冠罩在帐篷上方 */
const TREE = { x: -0.55, z: -1.9 };
const Tree: React.FC<{ grow: number; y: number }> = ({ grow, y }) => {
  const m = useMemo(() => ({ trunk: envMat(0x6e4a2e), a: envMat(0x3f8a4a), b: envMat(0x4f9a52) }), []);
  if (grow <= 0.001) return null;
  // 先长树干，再鼓出树冠
  const trunk = clamp01(grow / 0.55);
  const crown = clamp01((grow - 0.3) / 0.7);
  const pop = crown < 1 ? crown * (1 + 0.25 * Math.sin(crown * Math.PI)) : 1;
  // 树冠往帐篷那边（+z）伸，罩在外帐上方
  const blobs: [number, number, number, number, THREE.Material][] = [
    [0.15, 2.3, 0.75, 0.85, m.a],
    [-0.55, 2.1, 0.35, 0.7, m.b],
    [0.8, 2.05, 1.05, 0.62, m.b],
    [0.1, 2.75, 0.35, 0.55, m.a],
    [-0.2, 2.15, 1.3, 0.55, m.a],
  ];
  return (
    <group position={[TREE.x, y, TREE.z]}>
      <mesh material={m.trunk} castShadow position={[0, 1.0 * trunk, 0]} scale={[1, trunk, 1]}>
        <cylinderGeometry args={[0.09, 0.15, 2.0, 7]} />
      </mesh>
      {/* 一根斜枝伸向帐篷 */}
      <mesh material={m.trunk} castShadow position={[0.15, 1.65, 0.45]} rotation={[0.8, 0, -0.3]} scale={[1, trunk, 1]}>
        <cylinderGeometry args={[0.04, 0.07, 0.9, 6]} />
      </mesh>
      {blobs.map(([x, by, z, r, mat], i) => (
        <mesh key={i} material={mat} castShadow receiveShadow position={[x, by, z]} scale={r * pop} rotation={[i, i * 2, 0]}>
          <icosahedronGeometry args={[1, 0]} />
        </mesh>
      ))}
    </group>
  );
};

/** Lab View 的“实验台”：地面网格和发光的岛缘，只在扫描线扫过的地方出现 */
const LabFloor: React.FC = () => {
  const { grid, ring } = useMemo(() => {
    const g = new THREE.GridHelper(ISLAND_R * 2, 18, brand.lab.grid, brand.lab.grid);
    const gm = g.material as THREE.LineBasicMaterial;
    gm.transparent = true;
    gm.opacity = 0;
    gm.depthWrite = false;
    labify(gm, { color: brand.lab.grid, alpha: 0.5, shade: 0 });
    g.position.y = 0.006;
    const r = new THREE.Mesh(
      new THREE.RingGeometry(ISLAND_R - 0.02, ISLAND_R + 0.035, 120),
      labify(new THREE.MeshBasicMaterial({ color: 0x3d6bc2, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }), { color: 0x4f86e8, alpha: 1, shade: 0 }),
    );
    r.rotation.x = -Math.PI / 2;
    r.position.y = 0.012;
    return { grid: g, ring: r };
  }, []);
  return (
    <>
      <primitive object={grid} />
      <primitive object={ring} />
    </>
  );
};

const Island: React.FC<{ state: TentState }> = ({ state }) => {
  const { dip, pond } = state;
  const m = useMemo(() => ({ grass: envMat(0x5fa04e), soil: envMat(0x8a5a3b), deep: envMat(0x5e3c2a), rock: envMat(0x7c7f86), rock2: envMat(0x9a8f80) }), []);
  const rocks: [number, number, number][] = [[2.6, -2.2, 1.2], [3.1, -1.5, 0.7], [-2.4, 2.6, 0.9], [3.4, 2.2, 0.8]];
  const pines = [[-3.0, -1.9, 1.35], [-1.6, -3.4, 1.1], [-3.5, -0.4, 0.95], [0.8, -3.7, 0.85]] as const;
  return (
    <>
      <GroundTop dip={dip} pond={pond} material={m.grass} />
      <mesh receiveShadow material={m.grass} position={[0, -0.08, 0]}>
        <cylinderGeometry args={[ISLAND_R, ISLAND_R - 0.05, 0.16, 64, 1, true]} />
      </mesh>
      <mesh receiveShadow material={m.soil} position={[0, -0.6, 0]}>
        {/* 不要顶盖：低洼时草地顶面会沉到它下面 */}
        <cylinderGeometry args={[ISLAND_R - 0.04, ISLAND_R - 0.5, 0.9, 64, 1, true]} />
      </mesh>
      <mesh receiveShadow material={m.deep} position={[0, -1.4, 0]}>
        <cylinderGeometry args={[ISLAND_R - 0.5, ISLAND_R - 1.3, 0.7, 64]} />
      </mesh>
      <LabFloor />
      <Tufts dip={dip} pond={pond} />
      <Pond pond={pond} dip={dip} />
      {pines.map(([x, z, s], i) => (
        <Pine key={i} x={x} z={z} s={s} i={i} y={groundY(x, z, dip, pond)} />
      ))}
      {rocks.map(([x, z, s], i) => (
        <mesh
          key={i}
          castShadow
          receiveShadow
          material={i % 2 ? m.rock2 : m.rock}
          position={[x, 0.08 * s + groundY(x, z, dip, pond), z]}
          rotation={[0, random(`rock-${i}`) * 6, 0]}
          scale={[1.2 * s, 0.65 * s, 1.1 * s]}
        >
          <dodecahedronGeometry args={[0.3, 0]} />
        </mesh>
      ))}
      <Tree grow={state.tree} y={groundY(TREE.x, TREE.z, dip, pond)} />
    </>
  );
};

/** 每帧更新全场共用的扫描 uniform：Lab View 进出就是扫描面上下移动 */
const Scan: React.FC<{ lab: number }> = ({ lab }) => {
  useLayoutEffect(() => {
    labUniforms.uScanY.value = scanHeight(lab, SCAN_TOP, SCAN_BOTTOM);
    labUniforms.uScanGlow.value = lab > 0 && lab < 1 ? 1 : 0;
    labUniforms.uScanColor.value.copy(toOutput(brand.lab.scan));
  }, [lab]);
  return null;
};

export const World: React.FC<{ state: TentState; vertical: boolean }> = ({ state }) => (
  <>
    <Scan lab={state.lab} />
    <Sky day={state.day} />
    <Lights day={state.day} />
    <Island state={state} />
    <Tent state={state} />
  </>
);
