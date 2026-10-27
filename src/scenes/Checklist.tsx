import React from "react";
import { useCurrentFrame, useVideoConfig, spring } from "remotion";
import { brand } from "../brand";
import { Heading, SceneShell } from "../components/SceneShell";
import { riseIn, stagger, useEnter } from "../lib/anim";
import { useLayout } from "../lib/layout";
import type { SceneProps } from "./types";

/** 要点清单：条目在旁白时长内依次出现并打勾 */
export const Checklist: React.FC<SceneProps<"checklist">> = ({ segment, narrationStart, narrationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, vertical } = useLayout();
  const { heading, items } = segment.props;
  const head = useEnter(0);
  const appear = stagger(items.length, narrationStart + 10, narrationStart + narrationFrames * 0.9);
  return (
    <SceneShell>
      <div style={{ display: "flex", flexDirection: "column", gap: 40 * u, width: "100%", maxWidth: 1300 * u, alignItems: "center" }}>
        <Heading style={riseIn(head)}>{heading}</Heading>
        <div style={{ display: "flex", flexDirection: "column", gap: (vertical ? 28 : 20) * u, width: "100%" }}>
          {items.map((item, i) => {
            const p = spring({ frame: frame - appear[i], fps, config: { damping: 200 } });
            const tick = spring({ frame: frame - appear[i] - 8, fps, config: { damping: 12 } });
            return (
              <div
                key={i}
                style={{
                  ...riseIn(p, 30),
                  display: "flex",
                  alignItems: "center",
                  gap: 24 * u,
                  background: "rgba(22, 48, 42, 0.85)",
                  border: `2px solid ${brand.colors.line}`,
                  borderRadius: 18 * u,
                  padding: `${22 * u}px ${30 * u}px`,
                }}
              >
                <div
                  style={{
                    width: 52 * u,
                    height: 52 * u,
                    flexShrink: 0,
                    borderRadius: 12 * u,
                    background: brand.colors.good,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transform: `scale(${tick})`,
                  }}
                >
                  <svg width={32 * u} height={32 * u} viewBox="0 0 24 24">
                    <path d="M4 12.5l5 5L20 6.5" stroke={brand.colors.bg} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span style={{ fontSize: 42 * u, fontWeight: 600 }}>{item}</span>
              </div>
            );
          })}
        </div>
      </div>
    </SceneShell>
  );
};
