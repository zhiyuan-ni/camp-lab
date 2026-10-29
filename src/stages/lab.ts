import * as THREE from "three";
import { brand } from "../brand";

/**
 * Lab View：任何舞台都能用的“热成像 + 扫描线”材质。
 *
 * - labify(material, {color, alpha, shade}) 给一个普通材质加上 Lab View 的样子：
 *   扫描面以上的部分换成 color（按原来的光照保留明暗），透明度换成 alpha。
 * - 扫描面是一个水平面，高度 = labUniforms.uScanY。普通视角时在很高处（什么都不是 Lab），
 *   全 Lab 时在很低处；中间往下扫就是“扫描线扫过”，往上扫就是退出 Lab View。
 * - 自定义 ShaderMaterial（粒子、流线、天空）用 LAB_MASK_GLSL 拿到同一个遮罩。
 */

const ramp = brand.lab.ramp.map(([t, hex]) => ({ t, c: new THREE.Color(hex) }));
/** 热成像色阶：0 最冷（冰蓝）→ 1 最暖（橙黄） */
export const thermal = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < ramp.length; i++) {
    if (x <= ramp[i].t) return ramp[i - 1].c.clone().lerp(ramp[i].c, (x - ramp[i - 1].t) / (ramp[i].t - ramp[i - 1].t));
  }
  return ramp[ramp.length - 1].c.clone();
};
/** Lab View 里无关的东西压暗成深海军蓝，只留一点原来的色相 */
export const labDim = (hex: THREE.ColorRepresentation, keep = 0.18) => new THREE.Color(brand.lab.dim).lerp(new THREE.Color(hex), keep);

/** 自定义 shader 里颜色要自己转到输出色彩空间 */
export const toOutput = (c: THREE.ColorRepresentation) => new THREE.Color(c).convertLinearToSRGB();

export const SCAN_OFF = 1000;
/** lab 0→1 时扫描面从 top 扫到 bottom（世界坐标 y） */
export const scanHeight = (lab: number, top: number, bottom: number) =>
  lab <= 0 ? SCAN_OFF : lab >= 1 ? -SCAN_OFF : top + (bottom - top) * lab;

/** 全场共用的扫描 uniform：每帧在舞台里改 value，所有 Lab 材质一起变 */
export const labUniforms = {
  uScanY: { value: SCAN_OFF },
  uScanGlow: { value: 0 },
  uScanColor: { value: toOutput(brand.lab.scan) },
};

export const LAB_MASK_GLSL = /* glsl */ `
uniform float uScanY;
uniform float uScanGlow;
uniform vec3 uScanColor;
float labMask(float y) { return smoothstep(uScanY - 0.015, uScanY + 0.015, y); }
float scanBand(float y) { return (1.0 - smoothstep(0.0, 0.035, abs(y - uScanY))) * uScanGlow; }
`;

export type LabOptions = {
  /** Lab View 里的颜色 */
  color: THREE.ColorRepresentation;
  /** Lab View 里的不透明度（普通视角的不透明度不变） */
  alpha?: number;
  /** true：Lab 里的不透明度 = 原来的 × alpha（保留贴图的镂空），否则直接换成 alpha */
  alphaMul?: boolean;
  /** 0 = 平涂发光，1 = 保留原来的光照明暗 */
  shade?: number;
};

export type LabHandle = { color: THREE.Color; alpha: { value: number }; shade: { value: number } };

/** 给材质加 Lab View。返回的 handle 用来每帧改 Lab 颜色和透明度 */
export const labify = <M extends THREE.Material>(mat: M, opts: LabOptions): M & { userData: { lab: LabHandle } } => {
  const u = {
    uLabColor: { value: new THREE.Color(opts.color) },
    uLabAlpha: { value: opts.alpha ?? 1 },
    uLabShade: { value: opts.shade ?? 1 },
    uLabMul: { value: opts.alphaMul ? 1 : 0 },
  };
  mat.userData.lab = { color: u.uLabColor.value, alpha: u.uLabAlpha, shade: u.uLabShade } satisfies LabHandle;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, labUniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vLabPos;")
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        vec4 labWp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          labWp = instanceMatrix * labWp;
        #endif
        vLabPos = (modelMatrix * labWp).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vLabPos;
        uniform vec3 uLabColor;
        uniform float uLabAlpha;
        uniform float uLabShade;
        uniform float uLabMul;
        ${LAB_MASK_GLSL}`,
      )
      .replace(
        "#include <opaque_fragment>",
        `#include <opaque_fragment>
        {
          float m = labMask(vLabPos.y);
          vec3 w = vec3(0.299, 0.587, 0.114);
          float sh = clamp(dot(outgoingLight, w) / max(dot(diffuseColor.rgb, w), 0.04), 0.0, 1.6);
          vec3 lc = uLabColor * mix(1.0, 0.3 + 0.7 * sh, uLabShade);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, lc, m);
          gl_FragColor.a = mix(gl_FragColor.a, mix(uLabAlpha, gl_FragColor.a * uLabAlpha, uLabMul), m);
          float b = scanBand(vLabPos.y);
          gl_FragColor.rgb += uScanColor * b;
          gl_FragColor.a = max(gl_FragColor.a, b);
        }`,
      );
  };
  return mat as M & { userData: { lab: LabHandle } };
};
