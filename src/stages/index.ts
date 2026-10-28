import { tentStage } from "./tent";
import type { StageDef, StageState } from "./types";

/** 3D 舞台注册表：script.json 顶层的 "stage" 字段对应这里的 key */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const stages: Record<string, StageDef<any>> = {
  tent: tentStage,
};

export type { StageDef, StageState };
