import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 从 delay 帧开始的弹性入场，返回 0→1 */
export const useEnter = (delay = 0, damping = 200) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping } });
};

/** 常用：上移 + 淡入 */
export const riseIn = (p: number, distance = 40) => ({
  opacity: p,
  transform: `translateY(${(1 - p) * distance}px)`,
});

/** 场景末尾淡出 */
export const useExit = (durationInFrames: number, length = 10) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [durationInFrames - length, durationInFrames], [1, 0], clamp);
};

/** 把 n 个元素均匀分布在 [start, end] 帧区间内，返回每个元素的出现帧 */
export const stagger = (n: number, start: number, end: number) =>
  Array.from({ length: n }, (_, i) => Math.round(start + ((end - start) * i) / Math.max(n, 1)));
