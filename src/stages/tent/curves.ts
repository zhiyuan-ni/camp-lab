import * as THREE from "three";
import { H2, VENT_V, VENT_X, onFly } from "./geometry";

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** 外帐向夜空散热：从两面坡上往外、往上飘的波浪线 */
export const HEAT_CURVES: THREE.Curve<THREE.Vector3>[] = (() => {
  const out: THREE.Curve<THREE.Vector3>[] = [];
  let k = 0;
  for (const side of [1, -1] as const) {
    for (const x of [-0.95, -0.35, 0.25, 0.85]) {
      const { p, n } = onFly(x, 0.55 + (k % 3) * 0.08, side);
      const pts: THREE.Vector3[] = [];
      for (let j = 0; j <= 24; j++) {
        const t = j / 24;
        const q = p.clone().addScaledVector(n, 0.05 + 0.75 * t).add(V(0, 1.7 * t * t, 0));
        q.x += Math.sin(t * 11 + k * 1.7) * 0.06 * (0.3 + t);
        pts.push(q);
      }
      out.push(new THREE.CatmullRomCurve3(pts));
      k++;
    }
  }
  return out;
})();

/** 通风口开口中心（外帐外表面上） */
export const ventPoint = (side: 1 | -1) => onFly(VENT_X, VENT_V, side).p;

/** 风的流线：从门口低处进来，穿过帐篷，从顶部通风口出去 */
export const STREAM_CURVES: THREE.Curve<THREE.Vector3>[] = [-0.45, -0.27, -0.09, 0.09, 0.27, 0.45].map((z, i) => {
  const side = z < 0 ? -1 : 1;
  const vent = ventPoint(side);
  const y0 = 0.42 + (i % 3) * 0.1;
  return new THREE.CatmullRomCurve3([
    V(4.2, y0, z * 2.4),
    V(2.4, y0 + 0.04, z * 1.3),
    V(1.35, y0 + 0.1, z * 0.8),
    V(0.2, 0.8 + (i % 2) * 0.1, z * 0.6),
    V(vent.x + 0.25, vent.y - 0.12, vent.z * 0.7),
    V(vent.x - 0.05, vent.y + 0.05, vent.z + side * 0.04),
    V(vent.x - 0.5, vent.y + 0.75, vent.z + side * 0.55),
    V(vent.x - 1.6, H2 + 1.9, vent.z + side * 1.5),
  ]);
});
