import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { brand } from "../brand";
import { Heading, SceneShell } from "../components/SceneShell";
import { riseIn, stagger, useEnter } from "../lib/anim";
import { useLayout } from "../lib/layout";
import type { SceneProps } from "./types";

const toneColor = { good: brand.colors.good, bad: brand.colors.bad, neutral: brand.colors.cool } as const;
const toneIcon = { good: "✓", bad: "✕", neutral: "•" } as const;

/** 左右对比（竖屏时上下排列）。左栏先讲，右栏后讲。 */
export const Comparison: React.FC<SceneProps<"comparison">> = ({ segment, narrationStart, narrationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, vertical } = useLayout();
  const { heading, left, right } = segment.props;
  const head = useEnter(0);
  const half = narrationStart + narrationFrames / 2;
  const columns = [
    { col: left, start: narrationStart, end: half },
    { col: right, start: half, end: narrationStart + narrationFrames * 0.95 },
  ];
  return (
    <SceneShell>
      <div style={{ display: "flex", flexDirection: "column", gap: 40 * u, width: "100%", alignItems: "center" }}>
        {heading && <Heading style={riseIn(head)}>{heading}</Heading>}
        <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", gap: 36 * u, width: "100%" }}>
          {columns.map(({ col, start, end }, ci) => {
            const color = toneColor[col.tone];
            const cardIn = spring({ frame: frame - start + 6, fps, config: { damping: 200 } });
            const times = stagger(col.points.length, start + 8, end);
            return (
              <div
                key={ci}
                style={{
                  ...riseIn(cardIn, 50),
                  flex: 1,
                  borderRadius: 24 * u,
                  border: `3px solid ${color}`,
                  background: "rgba(22, 48, 42, 0.85)",
                  padding: 36 * u,
                  display: "flex",
                  flexDirection: "column",
                  gap: 18 * u,
                }}
              >
                <div style={{ fontSize: 46 * u, fontWeight: 800, color }}>{col.label}</div>
                {col.points.map((pt, i) => {
                  const p = spring({ frame: frame - times[i], fps, config: { damping: 200 } });
                  return (
                    <div key={i} style={{ ...riseIn(p, 20), display: "flex", gap: 16 * u, fontSize: 36 * u, lineHeight: 1.35 }}>
                      <span style={{ color, fontWeight: 900 }}>{toneIcon[col.tone]}</span>
                      <span>{pt}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </SceneShell>
  );
};
