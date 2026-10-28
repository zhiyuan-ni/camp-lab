import type React from "react";

export type Vec3 = [number, number, number];

/** fov 是横屏时的竖直视角（度）；竖屏由 CameraRig 自动换算 */
export type CameraPose = { pos: Vec3; look: Vec3; fov: number };

/** 镜头函数拿到的时间信息。画面只由这些值算出 */
export type ShotContext = {
  /** 本段进度 0→1 */
  p: number;
  /** 本段内秒数 */
  t: number;
  /** 本段总秒数 */
  duration: number;
  /** 全片秒数：呼吸、闪烁这类贯穿全片的小动作用它，跨段不跳 */
  time: number;
  vertical: boolean;
};

export type StageState = { camera: CameraPose };

export type Shot<S extends StageState> = {
  pose: (ctx: ShotContext) => S;
  /** 屏幕标题在本段进度的哪一刻入场，默认 0.08 */
  headingAt?: number;
};

export type StageDef<S extends StageState> = {
  /** 3D 世界，放在 <ThreeCanvas> 里 */
  World: React.FC<{ state: S; vertical: boolean }>;
  /** 跟着 3D 走的 2D 层（读数、标注），画在画布上面、字幕下面 */
  Overlay?: React.FC<{ state: S; shot: string | null; ctx: ShotContext }>;
  shots: Record<string, Shot<S>>;
  /** 没有对应镜头时的画面 */
  fallback: (ctx: ShotContext) => S;
};

export const defineStage = <S extends StageState>(def: StageDef<S>) => def;
