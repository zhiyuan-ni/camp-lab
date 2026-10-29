import type { CameraPose, Vec3 } from "../types";

/** 贴在 3D 物体旁边的标注：at 是世界坐标，dx / dy 是文字相对锚点的偏移（单位 u，横竖屏各一组） */
export type Label = {
  id: string;
  text: string;
  at: Vec3;
  show: number;
  dx: number;
  dy: number;
  vdx?: number;
  vdy?: number;
  color?: string;
};

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
  /** 顶部通风口撑开的程度 0→1 */
  ventOpen: number;
  /** 全片秒数，用于呼吸、粒子、流线 */
  time: number;
  /** 倒带时的故事时钟（小时，可超过 24），null 不显示 */
  clock: { hours: number; show: number } | null;

  /** Lab View 0→1：扫描面从上往下扫过；1→0 再扫回普通视角 */
  lab: number;
  /** 外帐在热成像色阶上的位置：0 冰蓝 … 1 橙黄 */
  flyTemp: number;
  /** 帐篷里暖空气的橙色光 0→1 */
  air: number;
  /**
   * 水汽粒子。fill：呼出的水汽填满帐篷的程度；skin：皮肤蒸发的那一部分；
   * plume：每口气的那一小团；out：被风从通风口带走的比例；
   * alpha：整体亮度；force：普通视角也显示（通风时看水汽出去）
   */
  vapour: { fill: number; skin: number; plume: number; out: number; alpha: number; force: number };
  /** 量杯：show 出现，fill 水位 */
  cup: { show: number; fill: number };
  /** 外帐向夜空散热的热波 0→1 */
  heat: number;
  /** 篷布微观：show 出现，vapour 水汽撞向布面，dew 水珠长出来，hero 一颗水珠长大 */
  macro: { show: number; vapour: number; dew: number; hero: number };
  /** 冷暖刻度条：air / fly 是两个标记在色阶上的位置，dew 是露点线出现的程度 */
  gauge: { show: number; air: number; fly: number; dew: number };
  /** 门：0 卷起绑好，1 拉链拉上 */
  doors: number;
  /** 风：0 无风（飘带垂着）… 1 有风（飘带吹平） */
  wind: number;
  /** 风的流线 0→1 */
  streams: number;
  /** 外帐松垮的程度 0→1 */
  sag: number;
  /** 帐篷所在的地方下沉成低洼 0→1 */
  dip: number;
  /** 帐篷旁边的水塘 0→1 */
  pond: number;
  /** 帐篷旁边长出一棵树 0→1 */
  tree: number;
  /** 清晨呼出的一口白气 0→1（进度） */
  breathFog: number;
  labels: Label[];
  /** 品牌名 0→1 */
  brand: number;
};

/** 大水珠挂在哪：靠近屋脊的那面坡上，正下方是睡袋 */
export const BIG_DROP = { x: 0.05, v: 0.84 };
/** 睡袋（压扁的胶囊，中心高 0.25，半高 0.161，半宽 0.26）在 z 处的表面高度 */
export const bagTopAt = (z: number) => 0.25 + 0.161 * Math.sqrt(Math.max(0, 1 - (z / 0.26) ** 2));
/** 嘴的位置：脸朝上，头在门那头 */
export const MOUTH: Vec3 = [0.62, 0.44, 0];

/** 低洼：帐篷周围这一圈地面整体下沉多少米 */
export const DIP_DEPTH = 0.35;
export const POND = { x: 1.0, z: 2.15, r: 0.6 };
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** 地面在 (x, z) 处的高度：低洼是一只浅碗，水塘再往下挖一点 */
export const groundY = (x: number, z: number, dip: number, pond: number) => {
  const r = Math.hypot(x, z);
  const bowl = 1 - smooth(2.7, 3.9, r);
  const d = Math.hypot(x - POND.x, z - POND.z);
  return -dip * DIP_DEPTH * bowl - pond * 0.14 * (1 - smooth(POND.r * 0.7, POND.r * 1.25, d));
};
/** 帐篷整体的高度（在碗底） */
export const tentY = (s: Pick<TentState, "dip">) => -s.dip * DIP_DEPTH;
