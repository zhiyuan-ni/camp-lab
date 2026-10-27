/** CAMP LAB 品牌设定。改这里即可全局换肤。 */
export const brand = {
  name: "CAMP LAB",
  nameZh: "露营科学实验室",
  handle: "@CAMP LAB 露营科学实验室",
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
  font: `"Noto Sans SC", "PingFang SC", "Microsoft YaHei", "WenQuanYi Zen Hei", "Source Han Sans SC", sans-serif`,
  fontNumber: `"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif`,
} as const;

export const FPS = 30;

export const FORMATS = {
  landscape: { suffix: "16x9", width: 1920, height: 1080 },
  vertical: { suffix: "9x16", width: 1080, height: 1920 },
} as const;
export type FormatKey = keyof typeof FORMATS;
