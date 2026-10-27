import React from "react";
import { brand } from "../brand";
import { SceneShell } from "../components/SceneShell";
import { riseIn, useEnter } from "../lib/anim";
import { useLayout } from "../lib/layout";
import type { SceneProps } from "./types";

export const TitleCard: React.FC<SceneProps<"title">> = ({ segment }) => {
  const { u } = useLayout();
  const { kicker, heading, sub } = segment.props;
  const bar = useEnter(0);
  const h = useEnter(6);
  const s = useEnter(14);
  return (
    <SceneShell>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 * u }}>
        {kicker && (
          <div style={{ ...riseIn(h, 20), fontSize: 30 * u, letterSpacing: 6 * u, color: brand.colors.accent, fontWeight: 700 }}>{kicker}</div>
        )}
        <div style={{ ...riseIn(h), fontSize: 92 * u, fontWeight: 900, textAlign: "center", lineHeight: 1.2 }}>{heading}</div>
        <div style={{ width: 160 * u * bar, height: 8 * u, borderRadius: 4 * u, background: brand.colors.accent }} />
        {sub && <div style={{ ...riseIn(s), fontSize: 38 * u, color: brand.colors.muted, textAlign: "center" }}>{sub}</div>}
      </div>
    </SceneShell>
  );
};
