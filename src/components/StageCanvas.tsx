import React, { useLayoutEffect } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Timeline } from "../lib/timeline";
import { stages } from "../stages";
import { evaluateStage } from "../stages/evaluate";
import type { CameraPose } from "../stages/types";

/** 竖屏时把横屏的竖直视角换算成更高的视角，左右少看一点、上下多看一点 */
const fitFov = (fov: number, aspect: number) => {
  if (aspect >= 1) return fov;
  const rad = THREE.MathUtils.degToRad;
  // 广角近景（帐篷里）收得多一点，免得竖屏上下拉得太变形；远景少收一点，主体不出框
  const keep = fov > 45 ? 0.62 : 0.82;
  const hfov = 2 * Math.atan(Math.tan(rad(fov) / 2) * (16 / 9)) * keep;
  return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov / 2) / aspect));
};

/** 每帧把相机摆到镜头算出的位置。在 layout effect 里做，赶在 ThreeCanvas 出图之前 */
const CameraRig: React.FC<{ pose: CameraPose }> = ({ pose }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  useLayoutEffect(() => {
    camera.position.set(...pose.pos);
    camera.lookAt(...pose.look);
    camera.aspect = size.width / size.height;
    camera.fov = fitFov(pose.fov, camera.aspect);
    camera.near = 0.02;
    camera.far = 400;
    camera.updateProjectionMatrix();
  }, [camera, pose, size]);
  return null;
};

/**
 * 整集共用的 3D 舞台：一块画布从头到尾不卸载，镜头由 timeline 里每段的 shot 名决定。
 * frame 用全片帧号，所以必须放在 Episode 的顶层，不能放进某个 <Sequence>。
 */
export const StageCanvas: React.FC<{ stageId: string; timeline: Timeline }> = ({ stageId, timeline }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const stage = stages[stageId];
  if (!stage) throw new Error(`Unknown stage "${stageId}". Register it in src/stages/index.ts`);
  const vertical = height > width;
  const { state, shot, ctx } = evaluateStage(stage, timeline, frame, fps, vertical);
  const { World, Overlay } = stage;
  return (
    <AbsoluteFill>
      <ThreeCanvas width={width} height={height} shadows gl={{ antialias: true, preserveDrawingBuffer: true }}>
        <CameraRig pose={state.camera} />
        <World state={state} vertical={vertical} />
      </ThreeCanvas>
      {Overlay && <Overlay state={state} shot={shot} ctx={ctx} />}
    </AbsoluteFill>
  );
};
