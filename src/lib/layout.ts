import { useVideoConfig } from "remotion";
import { SAFE_ZONES } from "../brand";

/**
 * 统一的版式信息。所有尺寸以“短边 1080”为基准设计，
 * 横屏和竖屏共用一套组件，只在排布方向上区分。
 * 内容区域 = 安全区以内，再留一点呼吸空间。
 */
export const useLayout = () => {
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  // 竖屏在手机上整体更小，字号放大 15%
  const u = (Math.min(width, height) / 1080) * (vertical ? 1.15 : 1);
  const safe = SAFE_ZONES[vertical ? "vertical" : "landscape"];
  const breathe = 24 * u;
  return {
    width,
    height,
    vertical,
    u,
    safe: {
      top: safe.top * height,
      bottom: safe.bottom * height,
      left: safe.left * width,
      right: safe.right * width,
    },
    /** 内容区四边内边距 */
    content: {
      top: safe.top * height + (vertical ? 40 : 30) * u,
      bottom: safe.bottom * height + (vertical ? 200 : 130) * u, // 给字幕留位置
      left: safe.left * width + breathe,
      right: safe.right * width + breathe,
    },
    /** 字幕底边距：紧贴底部安全区 */
    captionBottom: safe.bottom * height + (vertical ? 40 : 10) * u,
  };
};
