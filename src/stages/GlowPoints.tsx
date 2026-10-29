import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { LAB_MASK_GLSL, labUniforms, toOutput } from "./lab";

/**
 * 发光粒子（水汽、热量）。每个粒子一个柔和的圆点：亮芯 + 淡光晕，叠加混合，不靠后期泛光。
 * 位置、大小、亮度每帧由 compute 从帧号算出来写进缓冲区；size 是世界单位的直径。
 * 默认只在 Lab View 里可见（跟着扫描线出现），force > 0 时普通视角也看得见。
 */
export type GlowCompute = (pos: Float32Array, size: Float32Array, alpha: Float32Array) => number;

export const GlowPoints: React.FC<{
  max: number;
  compute: GlowCompute;
  /** compute 依赖的值变了才重算 */
  deps: unknown[];
  color: THREE.ColorRepresentation;
  intensity?: number;
  force?: number;
  renderOrder?: number;
  /** add：发光叠加（默认）；normal：普通混合，用于白雾这类不该发光的东西 */
  blend?: "add" | "normal";
}> = ({ max, compute, deps, color, intensity = 1, force = 0, renderOrder = 10, blend = "add" }) => {
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const { geo, mat } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(max * 3), 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(max), 1));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(max), 1));
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      premultipliedAlpha: true,
      uniforms: {
        ...labUniforms,
        uColor: { value: new THREE.Color() },
        uIntensity: { value: 1 },
        uForce: { value: 0 },
        uViewH: { value: 1080 },
      },
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute float aAlpha;
        uniform float uViewH;
        uniform float uForce;
        varying float vAlpha;
        ${LAB_MASK_GLSL}
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vec4 mv = viewMatrix * wp;
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * projectionMatrix[1][1] * uViewH * 0.5 / max(-mv.z, 1e-4);
          vAlpha = aAlpha * max(labMask(wp.y), uForce);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uIntensity;
        varying float vAlpha;
        void main() {
          vec2 c = gl_PointCoord * 2.0 - 1.0;
          float d = dot(c, c);
          if (d > 1.0 || vAlpha <= 0.0) discard;
          float a = (smoothstep(0.14, 0.0, d) + exp(-d * 5.0) * 0.4) * vAlpha * uIntensity;
          gl_FragColor = vec4(uColor * a, a);
        }`,
    });
    return { geo: g, mat: m };
  }, [max]);

  mat.blending = blend === "add" ? THREE.AdditiveBlending : THREE.NormalBlending;
  mat.uniforms.uColor.value.copy(toOutput(color));
  mat.uniforms.uIntensity.value = intensity;
  mat.uniforms.uForce.value = force;
  mat.uniforms.uViewH.value = size.height * dpr;

  useLayoutEffect(() => {
    const pos = geo.attributes.position.array as Float32Array;
    const sz = geo.attributes.aSize.array as Float32Array;
    const al = geo.attributes.aAlpha.array as Float32Array;
    const n = Math.min(compute(pos, sz, al), max);
    geo.setDrawRange(0, n);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, max, ...deps]);

  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={renderOrder} />;
};
