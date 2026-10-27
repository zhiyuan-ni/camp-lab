import React from "react";
import { interpolate, random } from "remotion";
import { brand } from "../brand";
import { clamp } from "../lib/anim";
import type { DiagramProps } from "./types";

/**
 * 帐篷结露剖面图。
 * 第 1 步：人体散发水汽；第 2 步：暖湿空气上升接触冷外帐；第 3 步：低于露点凝结成水珠。
 */
export const Condensation: React.FC<DiagramProps> = ({ activeStep, progress, frame }) => {
  const c = brand.colors;
  const step = Math.max(activeStep, 0);
  // 外帐内侧的水珠位置（沿左右两条斜边）
  const drops = Array.from({ length: 14 }, (_, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const t = 0.25 + random(`d${i}`) * 0.6; // 沿斜边的位置
    const x = 400 + side * (300 * t) - side * 12;
    const y = 110 + 370 * t + 4;
    const appearAt = 0.62 + random(`a${i}`) * 0.3;
    const size = interpolate(progress, [appearAt, appearAt + 0.08], [0, 5 + random(`s${i}`) * 4], clamp);
    return { x, y, size };
  });
  const vapor = Array.from({ length: 22 }, (_, i) => {
    const speed = 0.6 + random(`v${i}`) * 0.6;
    const life = ((frame * speed + i * 17) % 120) / 120; // 0→1 循环
    const x = 400 + (random(`vx${i}`) - 0.5) * 200 + Math.sin(frame / 15 + i) * 12;
    const y = 430 - life * 260;
    return { x, y, o: Math.sin(life * Math.PI) * 0.8 };
  });
  const vaporOn = interpolate(progress, [0.02, 0.12], [0, 1], clamp);
  const flyGlow = step >= 1 ? 1 : 0.4;
  const dewLabel = interpolate(progress, [0.66, 0.74], [0, 1], clamp);
  const fall = interpolate(progress, [0.88, 1], [0, 1], clamp);

  return (
    <svg viewBox="0 0 800 560" style={{ width: "100%", height: "100%" }}>
      <defs>
        <linearGradient id="warm" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={c.warm} stopOpacity={0.35} />
          <stop offset="100%" stopColor={c.warm} stopOpacity={0.05} />
        </linearGradient>
      </defs>
      {/* 地面 */}
      <line x1={40} y1={480} x2={760} y2={480} stroke={c.muted} strokeWidth={3} />
      {/* 内帐 + 暖空气 */}
      <path d="M170 480 L400 175 L630 480 Z" fill="url(#warm)" stroke={c.warm} strokeOpacity={0.6} strokeWidth={3} strokeDasharray="10 8" />
      {/* 外帐（冷） */}
      <path d="M100 480 L400 110 L700 480" fill="none" stroke={c.cool} strokeWidth={7} strokeOpacity={flyGlow} strokeLinejoin="round" />
      {/* 睡袋 + 人 */}
      <ellipse cx={420} cy={462} rx={120} ry={20} fill={c.accent} opacity={0.85} />
      <circle cx={290} cy={455} r={20} fill={c.text} />
      {/* 水汽 */}
      <g opacity={vaporOn}>
        {vapor.map((v, i) => (
          <circle key={i} cx={v.x} cy={v.y} r={5} fill={c.cool} opacity={v.o * 0.7} />
        ))}
      </g>
      {/* 水珠 */}
      {drops.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.size} fill={c.cool} stroke={c.text} strokeWidth={1.5} />
      ))}
      {/* 滴落的一滴 */}
      {fall > 0 && <circle cx={330} cy={200 + fall * 240} r={7} fill={c.cool} opacity={1 - fall * 0.3} />}
      {/* 温度标签 */}
      <g fontFamily={brand.font} fontWeight={700}>
        <text x={600} y={150} fill={c.cool} fontSize={30}>外部 2°C</text>
        <text x={330} y={360} fill={c.warm} fontSize={28}>帐内 12°C</text>
        <g opacity={dewLabel}>
          <rect x={470} y={215} width={170} height={46} rx={10} fill={c.cool} />
          <text x={555} y={248} fill={c.bg} fontSize={26} textAnchor="middle">低于露点</text>
        </g>
      </g>
    </svg>
  );
};
