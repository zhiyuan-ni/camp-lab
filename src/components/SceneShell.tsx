import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { brand } from "../brand";
import { useExit } from "../lib/anim";
import { useLayout } from "../lib/layout";

/** 场景外壳：统一边距、左上角品牌小标、末尾淡出 */
export const SceneShell: React.FC<{ children: React.ReactNode; badge?: boolean }> = ({ children, badge = true }) => {
  const { durationInFrames } = useVideoConfig();
  const { pad, u, vertical } = useLayout();
  const exit = useExit(durationInFrames, 8);
  return (
    <AbsoluteFill style={{ fontFamily: brand.font, color: brand.colors.text, opacity: exit }}>
      {badge && (
        <div
          style={{
            position: "absolute",
            top: (vertical ? 140 : 50) * u,
            left: pad,
            fontFamily: brand.fontNumber,
            fontWeight: 800,
            fontSize: 22 * u,
            letterSpacing: 4 * u,
            color: brand.colors.muted,
          }}
        >
          CAMP LAB
        </div>
      )}
      <AbsoluteFill
        style={{
          padding: pad,
          paddingTop: (vertical ? 260 : 120) * u,
          paddingBottom: (vertical ? 560 : 180) * u,
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
    <div style={{ fontSize: 60 * u, fontWeight: 800, lineHeight: 1.25, textAlign: "center", ...style }}>{children}</div>
  );
};
