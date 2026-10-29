import type React from "react";

export type Vec3 = [number, number, number];

/** fov 是横屏时的竖直视角（度）；竖屏由 CameraRig 自动换算。near 默认 0.02，贴近微观时调小 */
export type CameraPose = { pos: Vec3; look: Vec3; fov: number; near?: number };

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
  /**
   * 旁白里某个词开口的时刻（本段秒数）。nth 选第几次出现，从 0 数。
   * 找不到就报错：改了旁白却没改镜头，宁可渲染失败也不要声画错位。
   */
  cue: (word: string, nth?: number) => number;
};

export type StageState = { camera: CameraPose };

export type Shot<S extends StageState> = {
  pose: (ctx: ShotContext) => S;
  /** 屏幕标题在本段进度的哪一刻入场，默认 0.08；写一个词就在旁白说到这个词时入场 */
  headingAt?: number | string;
  /**
   * 可选：这个镜头里的动作时刻（本段秒数），名字随便起。script.json 的音效用 "#名字" 对上，
   * 这样声音落在动作发生的那一帧，改了镜头节奏也不用回去改秒数。拿到的 ctx 是本段开头那一刻。
   */
  marks?: (ctx: ShotContext) => Record<string, number>;
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
