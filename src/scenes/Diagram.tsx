import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { brand } from "../brand";
import { Heading, SceneShell } from "../components/SceneShell";
import { clamp, riseIn, useEnter } from "../lib/anim";
import { useLayout } from "../lib/layout";
import { diagrams } from "../diagrams";
import type { SceneProps } from "./types";

/** 原理图解：左（上）为图，右（下）为步骤；步骤随旁白进度依次高亮 */
export const Diagram: React.FC<SceneProps<"diagram">> = ({ segment, narrationStart, narrationFrames }) => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const { diagram, heading, steps } = segment.props;
  const def = diagrams[diagram];
  const head = useEnter(0);
  const progress = interpolate(frame, [narrationStart, narrationStart + narrationFrames], [0, 1], clamp);
  const activeStep = steps.length ? Math.min(Math.floor(progress * steps.length), steps.length - 1) : -1;
  if (!def) {
    return (
      <SceneShell>
        <Heading style={{ color: brand.colors.bad }}>未注册的图解：{diagram}</Heading>
      </SceneShell>
    );
  }
  const Figure = def.component;
  const showList = !def.ownsSteps && steps.length > 0;
  return (
    <SceneShell>
      <div style={{ display: "flex", flexDirection: "column", gap: 30 * u, width: "100%", height: "100%", alignItems: "center" }}>
        {heading && <Heading style={riseIn(head)}>{heading}</Heading>}
        <div style={{ flex: 1, minHeight: 0, width: "100%", display: "flex", flexDirection: vertical ? "column" : "row", gap: 40 * u, alignItems: "center" }}>
          <div style={{ flex: vertical ? "none" : showList ? 1.4 : 1, minHeight: 0, width: "100%", height: vertical ? 720 * u : "100%", display: "flex", alignItems: "center", justifyContent: "center", zoom: def.ownsSteps ? u : undefined }}>
            <Figure steps={steps} activeStep={activeStep} progress={progress} frame={frame} vertical={vertical} />
          </div>
          {showList && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 18 * u, width: "100%" }}>
              {steps.map((s, i) => {
                const on = i <= activeStep;
                const current = i === activeStep;
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 18 * u,
                      alignItems: "center",
                      fontSize: 38 * u,
                      fontWeight: current ? 800 : 500,
                      opacity: on ? 1 : 0.3,
                      color: current ? brand.colors.text : brand.colors.muted,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: brand.fontNumber,
                        width: 52 * u,
                        height: 52 * u,
                        flexShrink: 0,
                        borderRadius: 26 * u,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: current ? brand.colors.accent : "transparent",
                        border: `2px solid ${on ? brand.colors.accent : brand.colors.line}`,
                        color: current ? brand.colors.bg : brand.colors.accent,
                        fontWeight: 800,
                        fontSize: 26 * u,
                      }}
                    >
                      {i + 1}
                    </span>
                    <span style={{ lineHeight: 1.35 }}>{s}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </SceneShell>
  );
};
