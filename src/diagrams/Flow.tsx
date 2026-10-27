import React from "react";
import { spring } from "remotion";
import { brand } from "../brand";
import type { DiagramProps } from "./types";

/** 通用流程图：steps 依次出现，用箭头连接。任何主题都能用。 */
export const Flow: React.FC<DiagramProps> = ({ steps, activeStep, frame, vertical }) => {
  const c = brand.colors;
  return (
    <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", alignItems: "center", justifyContent: "center", gap: 18, width: "100%", height: "100%" }}>
      {steps.map((s, i) => {
        const shown = i <= activeStep;
        const p = shown ? spring({ frame: frame - i * 4, fps: 30, config: { damping: 200 }, from: 0.9, to: 1 }) : 1;
        const isCurrent = i === activeStep;
        return (
          <React.Fragment key={i}>
            {i > 0 && (
              <div style={{ fontSize: 48, color: shown ? c.accent : c.line, transform: vertical ? "rotate(90deg)" : undefined }}>➜</div>
            )}
            <div
              style={{
                flex: vertical ? undefined : 1,
                width: vertical ? "100%" : undefined,
                minHeight: vertical ? 120 : 220,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: 24,
                borderRadius: 20,
                fontSize: 38,
                fontWeight: 700,
                lineHeight: 1.3,
                color: shown ? c.text : c.muted,
                background: isCurrent ? "rgba(244, 163, 64, 0.18)" : "rgba(22, 48, 42, 0.85)",
                border: `3px solid ${isCurrent ? c.accent : shown ? c.muted : c.line}`,
                opacity: shown ? 1 : 0.35,
                transform: `scale(${p})`,
              }}
            >
              {s}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};
