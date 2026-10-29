import React, { useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { LAB_MASK_GLSL, labUniforms, toOutput } from "./lab";

/**
 * 沿曲线流动的虚线管：风的流线、散出去的热量。
 * 虚线按 time 往曲线终点方向走；draw 0→1 把线从起点画出来；两端自动淡出。
 * 默认只在 Lab View 里可见，force = 1 时普通视角也看得见。
 */
export const FlowLines: React.FC<{
  curves: THREE.Curve<THREE.Vector3>[];
  radius: number;
  color: THREE.ColorRepresentation;
  time: number;
  /** 每秒走过几段虚线 */
  speed?: number;
  /** 整条线上有几段虚线 */
  dashes?: number;
  /** 一段里实线占的比例 */
  duty?: number;
  opacity?: number;
  draw?: number;
  force?: number;
}> = ({ curves, radius, color, time, speed = 1, dashes = 8, duty = 0.5, opacity = 1, draw = 1, force = 0 }) => {
  const geo = useMemo(() => mergeGeometries(curves.map((c) => new THREE.TubeGeometry(c, 96, radius, 5, false))), [curves, radius]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        premultipliedAlpha: true,
        uniforms: {
          ...labUniforms,
          uColor: { value: new THREE.Color() },
          uTime: { value: 0 },
          uDashes: { value: 8 },
          uDuty: { value: 0.5 },
          uOpacity: { value: 1 },
          uDraw: { value: 1 },
          uForce: { value: 0 },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          varying float vY;
          void main() {
            vUv = uv;
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vY = wp.y;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uTime, uDashes, uDuty, uOpacity, uDraw, uForce;
          varying vec2 vUv;
          varying float vY;
          ${LAB_MASK_GLSL}
          void main() {
            float s = vUv.x;
            float ph = fract(s * uDashes - uTime);
            float dash = smoothstep(0.0, 0.06, ph) * (1.0 - smoothstep(uDuty - 0.06, uDuty, ph));
            float ends = smoothstep(0.0, 0.1, s) * (1.0 - smoothstep(0.75, 1.0, s));
            float drawn = 1.0 - smoothstep(uDraw - 0.06, uDraw, s);
            float a = dash * ends * drawn * uOpacity * max(labMask(vY), uForce);
            if (a <= 0.001) discard;
            gl_FragColor = vec4(uColor * a, a);
          }`,
      }),
    [],
  );
  mat.uniforms.uColor.value.copy(toOutput(color));
  mat.uniforms.uTime.value = time * speed;
  mat.uniforms.uDashes.value = dashes;
  mat.uniforms.uDuty.value = duty;
  mat.uniforms.uOpacity.value = opacity;
  mat.uniforms.uDraw.value = draw;
  mat.uniforms.uForce.value = force;
  return <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={11} visible={opacity > 0.001} />;
};
