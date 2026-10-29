import * as THREE from "three";
import { random } from "remotion";

/**
 * 帐篷舞台的尺寸和几何。单位米，y 轴朝上。
 * 帐篷屋脊沿 x 轴，门在 +x 端；小岛圆心在原点。
 */
export const ISLAND_R = 4.6;
export const TL = 2.4; // 内帐长
export const TW = 1.9; // 内帐宽
export const TH = 1.35; // 内帐高
export const W2 = TW / 2 + 0.3; // 外帐半宽
export const H2 = TH + 0.12; // 外帐屋脊高
export const FLY_TH = 0.03;
export const FLY_LEN = TL + 0.35;
export const EAVE_Y = 0.12;
export const IW = TW / 2 - 0.12;
export const IH = TH - 0.1;

/** 人字形截面（在 z-y 平面），w 半宽、h 高、th 厚度、y0 底边高度 */
export const lambdaShape = (w: number, h: number, th: number, y0: number) => {
  const s = new THREE.Shape();
  s.moveTo(-w, y0);
  s.lineTo(-w + th, y0);
  s.lineTo(0, h - th * 1.3);
  s.lineTo(w - th, y0);
  s.lineTo(w, y0);
  s.lineTo(0, h);
  s.closePath();
  return s;
};

export const triangleShape = (w: number, y0: number, h: number) => {
  const s = new THREE.Shape();
  s.moveTo(-w, y0);
  s.lineTo(w, y0);
  s.lineTo(0, h);
  s.closePath();
  return s;
};

/** 把截面沿 x 轴挤出 len，居中 */
export const extrudeX = (shape: THREE.Shape, len: number, steps = 1) => {
  const g = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false, steps });
  g.translate(0, 0, -len / 2);
  g.rotateY(Math.PI / 2);
  g.computeVertexNormals();
  return g;
};

/**
 * 外帐内表面上的点。v：0 在檐口，1 在屋脊；side：+1 / -1 两面坡。
 * off > 0 时沿内法线（朝下、朝帐篷中线）偏移。
 */
export const underFly = (x: number, v: number, side: 1 | -1, off = 0): THREE.Vector3 => {
  const zb = (W2 - FLY_TH) * side;
  const yb = EAVE_Y;
  const yt = H2 - FLY_TH * 1.3;
  const p = new THREE.Vector3(x, yb + (yt - yb) * v, zb * (1 - v));
  const d = new THREE.Vector2(-zb, yt - yb).normalize();
  const n = new THREE.Vector3(0, -Math.abs(d.x), -d.y * side).normalize();
  return p.add(n.multiplyScalar(off));
};

/** 帐篷内衬网眼的透明贴图 */
export const netTexture = () => {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d")!;
  x.strokeStyle = "#fff";
  x.lineWidth = 3;
  x.beginPath();
  for (let i = 0; i <= 64; i += 16) {
    x.moveTo(i, 0);
    x.lineTo(i, 64);
    x.moveTo(0, i);
    x.lineTo(64, i);
  }
  x.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(26, 18);
  return t;
};

/** 外帐内侧凝结水珠的固定分布：位置和基准大小只由种子决定 */
export const dropletLayout = (n: number) =>
  Array.from({ length: n }, (_, i) => {
    const side: 1 | -1 = i % 2 ? 1 : -1;
    const v = Math.pow(random(`drop-v-${i}`), 0.8) * 0.9 + 0.05;
    const x = (random(`drop-x-${i}`) - 0.5) * (FLY_LEN - 0.16);
    const r = 0.005 + Math.pow(random(`drop-r-${i}`), 2.2) * 0.022;
    // 先出现的小，后出现的大：grow 阈值让水珠一颗颗长出来，而不是一起变大
    const start = random(`drop-s-${i}`) * 0.7;
    return { pos: underFly(x, v, side, r * 0.55), r, start };
  });

export const SLOPE_RUN = W2;
export const SLOPE_RISE = H2 - EAVE_Y;
export const SLOPE_LEN = Math.hypot(SLOPE_RUN, SLOPE_RISE);
export const SLOPE_ANGLE = Math.atan2(SLOPE_RISE, SLOPE_RUN);
/** 外帐外表面上的点（v：0 檐口，1 屋脊）和朝外的法线 */
export const onFly = (x: number, v: number, side: 1 | -1) => ({
  p: new THREE.Vector3(x, EAVE_Y + SLOPE_RISE * v, side * W2 * (1 - v)),
  n: new THREE.Vector3(0, SLOPE_RUN, side * SLOPE_RISE).normalize(),
});

/** 顶部通风口在两面坡上的位置（帐篷后段、靠屋脊） */
export const VENT_X = -FLY_LEN / 2 + 0.42;
export const VENT_V = 0.8;

/**
 * 外帐松垮时的变形：两根杆子之间屋脊往下塌，坡面往里鼓。
 * along：沿屋脊方向 0（杆子处）→ 1（中间）；返回 y 和朝中线的 z 偏移。
 */
export const sagOffset = (x: number, v: number, sag: number) => {
  const along = Math.cos((Math.PI * x) / FLY_LEN);
  return { dy: -sag * 0.075 * along * v, dIn: sag * 0.05 * along * Math.sin(Math.PI * v) };
};
