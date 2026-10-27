import { useVideoConfig } from "remotion";

/**
 * 统一的版式信息。所有尺寸以“短边 1080”为基准设计，
 * 横屏和竖屏共用一套组件，只在排布方向上区分。
 */
export const useLayout = () => {
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  const u = Math.min(width, height) / 1080;
  return {
    width,
    height,
    vertical,
    u,
    /** 安全边距 */
    pad: (vertical ? 80 : 120) * u,
    /** 字幕距底部距离（竖屏抬高，避开平台按钮） */
    captionBottom: (vertical ? 420 : 70) * u,
  };
};
