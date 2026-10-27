import React from "react";
import { AbsoluteFill } from "remotion";
import { useLayout } from "../lib/layout";

/** 安全区叠加层：Studio 里打开 showSafeZone 自查，文字不能落进红色区域 */
export const SafeZone: React.FC = () => {
  const { safe, width, height } = useLayout();
  const fill = "rgba(255, 60, 60, 0.28)";
  const band = (style: React.CSSProperties) => <div style={{ position: "absolute", background: fill, ...style }} />;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {band({ left: 0, top: 0, width, height: safe.top })}
      {band({ left: 0, bottom: 0, width, height: safe.bottom })}
      {band({ left: 0, top: safe.top, width: safe.left, height: height - safe.top - safe.bottom })}
      {band({ right: 0, top: safe.top, width: safe.right, height: height - safe.top - safe.bottom })}
      <div
        style={{
          position: "absolute",
          left: safe.left,
          top: safe.top,
          right: safe.right,
          bottom: safe.bottom,
          border: "3px dashed rgba(255, 60, 60, 0.9)",
        }}
      />
    </AbsoluteFill>
  );
};
