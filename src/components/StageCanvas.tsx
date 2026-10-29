import React, { useLayoutEffect } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Timeline } from "../lib/timeline";
import { stages } from "../stages";
import { evaluateStage } from "../stages/evaluate";
import { applyPose } from "../stages/project";
import type { CameraPose } from "../stages/types";

/** 每帧把相机摆到镜头算出的位置。在 layout effect 里做，赶在 ThreeCanvas 出图之前 */
const CameraRig: React.FC<{ pose: CameraPose }> = ({ pose }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  useLayoutEffect(() => {
    applyPose(camera, pose, size.width, size.height);
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
