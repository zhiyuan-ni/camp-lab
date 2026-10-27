import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { brand } from "../brand";
import { LogoMark } from "../components/Logo";
import { SceneShell } from "../components/SceneShell";
import { clamp, riseIn, useEnter } from "../lib/anim";
import { useLayout } from "../lib/layout";
import type { SceneProps } from "./types";

export const Intro: React.FC<SceneProps<"intro">> = ({ episode, segment }) => {
  const frame = useCurrentFrame();
  const { u } = useLayout();
  const draw = interpolate(frame, [0, 30], [0, 1], clamp);
  const brandIn = useEnter(10);
  const titleIn = useEnter(22);
  const hookIn = useEnter(34);
  return (
    <SceneShell>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 * u }}>
        <LogoMark size={180 * u} draw={draw} />
        <div style={{ ...riseIn(brandIn), textAlign: "center" }}>
          <div style={{ fontFamily: brand.fontNumber, fontWeight: 800, fontSize: 40 * u, letterSpacing: 10 * u }}>{brand.name}</div>
        </div>
        <div style={{ ...riseIn(titleIn), display: "flex", flexDirection: "column", alignItems: "center", gap: 12 * u, marginTop: 30 * u }}>
          <div
            style={{
              fontFamily: brand.fontNumber,
              fontSize: 24 * u,
              fontWeight: 700,
              color: brand.colors.bg,
              background: brand.colors.accent,
              padding: `${6 * u}px ${18 * u}px`,
              borderRadius: 8 * u,
              letterSpacing: 2 * u,
            }}
          >
            EP.{String(episode.episode).padStart(2, "0")}
          </div>
          <div style={{ fontSize: 76 * u, fontWeight: 900, textAlign: "center", lineHeight: 1.2 }}>{episode.title}</div>
          {episode.subtitle && <div style={{ fontSize: 34 * u, color: brand.colors.muted }}>{episode.subtitle}</div>}
        </div>
        {segment.props.hook && (
          <div style={{ ...riseIn(hookIn), fontSize: 32 * u, color: brand.colors.accent, textAlign: "center" }}>{segment.props.hook}</div>
        )}
      </div>
    </SceneShell>
  );
};
