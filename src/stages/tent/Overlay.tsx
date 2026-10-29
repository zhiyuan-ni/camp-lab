import React from "react";
import { useVideoConfig } from "remotion";
import { brand } from "../../brand";
import { Wordmark } from "../../components/Logo";
import { useLayout } from "../../lib/layout";
import { thermal } from "../lab";
import { projectPoint } from "../project";
import type { ShotContext } from "../types";
import type { Label, TentState } from "./state";

const SHADOW = "0 2px 16px rgba(6, 10, 32, 0.55)";
const hex = (t: number) => `#${thermal(t).getHexString()}`;

const fmt = (hours: number) => {
  const h = ((Math.floor(hours) % 24) + 24) % 24;
  const m = Math.floor((hours - Math.floor(hours)) * 60);
  return { time: `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")}`, ampm: h < 12 ? "AM" : "PM" };
};

/** 倒带时的故事时钟：跟在屏幕标题下面，往回走 */
const Clock: React.FC<{ clock: NonNullable<TentState["clock"]> }> = ({ clock }) => {
  const { u, content, vertical } = useLayout();
  const { time, ampm } = fmt(clock.hours);
  const s = clock.show;
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
        textShadow: SHADOW,
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

/**
 * 冷暖刻度条：竖着的热成像色阶，上暖下冷。不写度数，只有两个标记（Air、Fly）
 * 和一条 Dew point 虚线；Fly 的标记跟着篷布的颜色往下走。
 */
const Gauge: React.FC<{ g: TentState["gauge"] }> = ({ g }) => {
  const { u, vertical, width, height, safe } = useLayout();
  if (g.show <= 0.001) return null;
  const barW = 26 * u;
  const x = vertical ? width - safe.right - 70 * u : width - safe.right - 90 * u;
  const top = vertical ? height * 0.3 : height * 0.2;
  const h = vertical ? height * 0.34 : height * 0.5;
  const yOf = (t: number) => top + (1 - t) * h;
  const grow = g.show;
  const marker = (t: number, text: string, key: string) => (
    <div key={key} style={{ position: "absolute", left: 0, right: 0, top: yOf(t) }}>
      <div style={{ position: "absolute", left: x - 13 * u, top: -13 * u, width: 26 * u, height: 26 * u, borderRadius: "50%", background: hex(t), border: `${4 * u}px solid ${brand.colors.text}`, boxSizing: "border-box" }} />
      <div style={{ position: "absolute", right: width - x + 30 * u, top: -30 * u, fontSize: 44 * u, fontWeight: 700, color: hex(Math.max(t, 0.25)), whiteSpace: "nowrap", textShadow: SHADOW }}>{text}</div>
    </div>
  );
  const dewY = yOf(0.3);
  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: brand.font, opacity: Math.min(1, grow * 1.5) }}>
      <div
        style={{
          position: "absolute",
          left: x - barW / 2,
          top: top + h * (1 - grow),
          width: barW,
          height: h * grow,
          borderRadius: barW / 2,
          background: `linear-gradient(to bottom, ${[...brand.lab.ramp].reverse().map(([t, c]) => `${c} ${(1 - t) * 100}%`).join(", ")})`,
          boxShadow: SHADOW,
        }}
      />
      {g.dew > 0 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: dewY, opacity: g.dew }}>
          <svg style={{ position: "absolute", left: x - 230 * u, top: -3 * u, overflow: "visible" }} width={260 * u} height={6 * u}>
            <line x1={260 * u} y1={3 * u} x2={260 * u - 260 * u * g.dew} y2={3 * u} stroke={brand.colors.text} strokeWidth={5 * u} strokeDasharray={`${14 * u} ${10 * u}`} />
          </svg>
          <div style={{ position: "absolute", right: width - x + 30 * u, top: -70 * u, fontSize: 44 * u, fontWeight: 700, color: brand.colors.text, whiteSpace: "nowrap", textShadow: SHADOW }}>
            Dew point
          </div>
        </div>
      )}
      {grow > 0.6 && marker(g.air, "Air", "air")}
      {grow > 0.6 && marker(g.fly, "Fly", "fly")}
    </div>
  );
};

/** 贴在 3D 物体上的标注：圆点 + 引线 + 一行字，跟着物体在画面上走 */
const Labels: React.FC<{ labels: Label[]; state: TentState }> = ({ labels, state }) => {
  const { width, height } = useVideoConfig();
  const { u, vertical, safe, content } = useLayout();
  const fs = 52 * u;
  return (
    <svg width={width} height={height} style={{ position: "absolute", inset: 0, overflow: "visible", fontFamily: brand.font }}>
      {labels
        .filter((l) => l.show > 0.001)
        .map((l) => {
          const p = projectPoint(state.camera, l.at, width, height);
          if (p.behind) return null;
          let dx = (vertical ? l.vdx ?? l.dx : l.dx) * u;
          let dy = (vertical ? l.vdy ?? l.dy : l.dy) * u;
          // 字出了安全区或压到字幕区就翻到另一边
          const tw = l.text.length * fs * 0.56 + 16 * u;
          // 两边都放不下时，选空间大的一边，再把字往里推
          const roomR = width - safe.right - (p.x + Math.abs(dx));
          const roomL = p.x - Math.abs(dx) - safe.left;
          if (dx >= 0 && roomR < tw && roomL > roomR) dx = -Math.abs(dx);
          else if (dx < 0 && roomL < tw && roomR > roomL) dx = Math.abs(dx);
          if (p.y + dy + fs * 0.4 > height - content.bottom + 60 * u) dy = -Math.abs(dy);
          else if (p.y + dy - fs < safe.top) dy = Math.abs(dy);
          const tx = p.x + dx * l.show;
          const ty = p.y + dy * l.show;
          const right = dx < 0;
          // 入场时字从圆点滑出来；圆点本身离字幕很近时，字也不能压到字幕上
          const textY = Math.min(ty + 16 * u, height - content.bottom + 60 * u);
          const textX = right
            ? Math.max(tx - 16 * u, safe.left + tw - 16 * u)
            : Math.min(tx + 16 * u, width - safe.right - tw + 16 * u);
          const col = l.color ?? brand.colors.text;
          return (
            <g key={l.id} opacity={Math.min(1, l.show * 1.4)}>
              <circle cx={p.x} cy={p.y} r={9 * u * l.show} fill={col} />
              <line x1={p.x} y1={p.y} x2={tx} y2={ty} stroke={col} strokeWidth={4 * u} strokeLinecap="round" />
              <text
                x={textX}
                y={textY}
                textAnchor={right ? "end" : "start"}
                fontSize={fs}
                fontWeight={700}
                fill={col}
                style={{ paintOrder: "stroke", stroke: "rgba(6, 10, 32, 0.55)", strokeWidth: 10 * u, strokeLinejoin: "round" }}
                opacity={l.show}
              >
                {l.text}
              </text>
            </g>
          );
        })}
    </svg>
  );
};

/** 跟着 3D 走的 2D 层：倒带时钟、冷暖刻度条、物体标注、片尾品牌名 */
export const Overlay: React.FC<{ state: TentState; shot: string | null; ctx: ShotContext }> = ({ state }) => {
  const { u, content, vertical } = useLayout();
  return (
    <>
      {state.clock && <Clock clock={state.clock} />}
      <Gauge g={state.gauge} />
      <Labels labels={state.labels} state={state} />
      {state.brand > 0 && (
        <div
          style={{
            position: "absolute",
            left: content.left,
            top: content.top + (vertical ? 110 : 130) * u,
            opacity: state.brand,
            transform: `translateY(${(1 - state.brand) * 24 * u}px)`,
            filter: "drop-shadow(0 2px 12px rgba(6, 10, 32, 0.45))",
          }}
        >
          <Wordmark scale={1.25 * u} />
        </div>
      )}
    </>
  );
};
