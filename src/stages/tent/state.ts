import type { CameraPose } from "../types";

export type TentState = {
  camera: CameraPose;
  /** 0 = 深夜，1 = 清晨（天色、太阳、星星、光线都由它算） */
  day: number;
  /** 外帐内侧的凝结水量 0→1：水珠按各自的阈值一颗颗长出来 */
  drops: number;
  /** 开场那一颗大水珠：grow 0→1 长大；fall < 0 还挂着，0→1 下落；splash 0→1 溅开 */
  bigDrop: { show: boolean; grow: number; fall: number; splash: number };
  /** 内帐网眼的可见度 0→1（钩子镜头在帐篷里时隐藏，免得网眼糊住镜头） */
  inner: number;
  /** 全片秒数，用于呼吸 */
  time: number;
  /** 倒带时的故事时钟（小时，可超过 24），null 不显示 */
  clock: { hours: number; show: number } | null;
};

/** 大水珠挂在哪：靠近屋脊的那面坡上，正下方是睡袋 */
export const BIG_DROP = { x: 0.05, v: 0.84 };
/** 睡袋（压扁的胶囊，中心高 0.25，半高 0.161，半宽 0.26）在 z 处的表面高度 */
export const bagTopAt = (z: number) => 0.25 + 0.161 * Math.sqrt(Math.max(0, 1 - (z / 0.26) ** 2));
