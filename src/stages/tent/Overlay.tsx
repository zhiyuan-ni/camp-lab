import React from "react";
import { brand } from "../../brand";
import { useLayout } from "../../lib/layout";
import type { ShotContext } from "../types";
import type { TentState } from "./state";

const fmt = (hours: number) => {
  const h = ((Math.floor(hours) % 24) + 24) % 24;
  const m = Math.floor((hours - Math.floor(hours)) * 60);
  return { time: `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")}`, ampm: h < 12 ? "AM" : "PM" };
};

/** 倒带时的故事时钟：跟在屏幕标题下面，往回走 */
export const Overlay: React.FC<{ state: TentState; shot: string | null; ctx: ShotContext }> = ({ state }) => {
  const { u, content, vertical } = useLayout();
  if (!state.clock) return null;
  const { time, ampm } = fmt(state.clock.hours);
  const s = state.clock.show;
  return (
    <div
      style={{
        position: "absolute",
        left: content.left,
        top: content.top + (vertical ? 100 : 120) * u,
        display: "flex",
        alignItems: "center",
        gap: 18 * u,
        opacity: s,
        transform: `translateY(${(1 - s) * 24 * u}px)`,
        fontFamily: brand.fontNumber,
        color: brand.colors.text,
        textShadow: "0 2px 16px rgba(6, 10, 32, 0.45)",
      }}
    >
      <svg width={44 * u} height={30 * u} viewBox="0 0 44 30">
        <path d="M22 2 L2 15 L22 28 Z M42 2 L22 15 L42 28 Z" fill={brand.colors.accent} />
      </svg>
      <span style={{ fontSize: 64 * u, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{time}</span>
      <span style={{ fontSize: 34 * u, fontWeight: 600, opacity: 0.85 }}>{ampm}</span>
    </div>
  );
};
