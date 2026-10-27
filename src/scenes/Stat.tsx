import React from "react";
import { brand } from "../brand";
import { SceneShell } from "../components/SceneShell";
import { riseIn, useEnter } from "../lib/anim";
import { useLayout } from "../lib/layout";
import type { SceneProps } from "./types";

/** 一个醒目的数字 + 说明，适合“一晚呼出 1 升水”这类事实 */
export const Stat: React.FC<SceneProps<"stat">> = ({ segment }) => {
  const { u } = useLayout();
  const { value, unit, label, note } = segment.props;
  const v = useEnter(4, 14);
  const l = useEnter(16);
  const n = useEnter(30);
  return (
    <SceneShell>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 * u, textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16 * u, transform: `scale(${0.6 + 0.4 * v})`, opacity: v }}>
          <span style={{ fontFamily: brand.fontNumber, fontSize: 220 * u, fontWeight: 900, color: brand.colors.accent, lineHeight: 1 }}>{value}</span>
          {unit && <span style={{ fontSize: 80 * u, fontWeight: 800 }}>{unit}</span>}
        </div>
        <div style={{ ...riseIn(l), fontSize: 48 * u, fontWeight: 700, maxWidth: 900 * u, lineHeight: 1.35 }}>{label}</div>
        {note && <div style={{ ...riseIn(n), fontSize: 28 * u, color: brand.colors.muted }}>{note}</div>}
      </div>
    </SceneShell>
  );
};
