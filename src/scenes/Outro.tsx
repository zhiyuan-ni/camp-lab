import React from "react";
import { brand } from "../brand";
import { LogoMark } from "../components/Logo";
import { SceneShell } from "../components/SceneShell";
import { riseIn, useEnter } from "../lib/anim";
import { useLayout } from "../lib/layout";
import type { SceneProps } from "./types";

export const Outro: React.FC<SceneProps<"outro">> = ({ segment }) => {
  const { u } = useLayout();
  const { cta = "Follow for more camping science", next } = segment.props;
  const a = useEnter(0);
  const b = useEnter(12);
  const c = useEnter(24);
  return (
    <SceneShell>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 36 * u, textAlign: "center" }}>
        <div style={{ ...riseIn(a), transform: `scale(${a})` }}>
          <LogoMark size={150 * u} />
        </div>
        <div style={{ ...riseIn(b), fontSize: 54 * u, fontWeight: 800, maxWidth: 1100 * u, lineHeight: 1.3, textWrap: "balance" }}>{cta}</div>
        {next && (
          <div style={{ ...riseIn(c), display: "flex", flexDirection: "column", gap: 10 * u, alignItems: "center" }}>
            <div style={{ fontSize: 26 * u, letterSpacing: 4 * u, textTransform: "uppercase", color: brand.colors.muted }}>Next episode</div>
            <div
              style={{
                fontSize: 40 * u,
                fontWeight: 700,
                color: brand.colors.accent,
                border: `2px solid ${brand.colors.accent}`,
                borderRadius: 14 * u,
                padding: `${12 * u}px ${28 * u}px`,
              }}
            >
              {next}
            </div>
          </div>
        )}
      </div>
    </SceneShell>
  );
};
