/** CAMP LAB 品牌设定。改这里即可全局换肤。 */
export const brand = {
  /** 屏幕上只出现英文品牌名 */
  name: "CAMP LAB",
  colors: {
    bg: "#0E1D19",
    bgDeep: "#08130F",
    panel: "#16302A",
    line: "rgba(243, 239, 230, 0.10)",
    text: "#F3EFE6",
    muted: "#A3B8AD",
    accent: "#F4A340", // 篝火橙：品牌主色
    warm: "#FF7A59", // 暖、热、危险
    cool: "#6EC3E8", // 冷、水汽、安全
    good: "#7BD389",
    bad: "#FF7A59",
  },
  /**
   * Lab View（“为什么”的部分）：热成像色阶，暖是橙、冷是冰蓝；其余压暗成深海军蓝；
   * 水汽、热量这类看不见的东西用发光的青色。用法见 src/stages/lab.ts。
   */
  lab: {
    ramp: [
      [0, "#2E6BFF"],
      [0.3, "#46B4FF"],
      [0.55, "#B9C3E6"],
      [0.75, "#FF9A55"],
      [1, "#FFC65A"],
    ] as const,
    dim: "#0E1A33",
    sky: { top: "#03060F", mid: "#08112A", hor: "#12204A" },
    vapor: "#4FE0FF",
    scan: "#7FE8FF",
    grid: "#2C4C8A",
  },
  /** Inter（SIL OFL 1.1），本地 woff2，见 src/fonts.ts 和 LICENSES.md */
  font: `Inter, sans-serif`,
  fontNumber: `Inter, sans-serif`,
} as const;

export const FPS = 30;

export const FORMATS = {
  landscape: { suffix: "16x9", width: 1920, height: 1080 },
  vertical: { suffix: "9x16", width: 1080, height: 1920 },
} as const;
export type FormatKey = keyof typeof FORMATS;

/**
 * 安全区（占画面比例）。文字不能进入这些区域。
 * 竖屏：顶部平台栏、底部文案栏、右侧点赞评论按钮。
 */
export const SAFE_ZONES = {
  landscape: { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 },
  vertical: { top: 0.15, bottom: 0.2, left: 0.05, right: 0.12 },
} as const;
