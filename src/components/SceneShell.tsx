import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { brand } from "../brand";
import { useExit } from "../lib/anim";
import { useLayout } from "../lib/layout";

/** 场景外壳：内容限制在安全区内，末尾淡出 */
export const SceneShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { durationInFrames } = useVideoConfig();
  const { content } = useLayout();
  const exit = useExit(durationInFrames, 8);
  return (
    <AbsoluteFill style={{ fontFamily: brand.font, color: brand.colors.text, opacity: exit }}>
      <AbsoluteFill
        style={{
          paddingTop: content.top,
          paddingBottom: content.bottom,
          paddingLeft: content.left,
          paddingRight: content.right,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Heading: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => {
  const { u } = useLayout();
  return (
    <div style={{ fontSize: 64 * u, fontWeight: 800, lineHeight: 1.15, textAlign: "center", letterSpacing: -0.5 * u, textWrap: "balance", ...style }}>
      {children}
    </div>
  );
};
