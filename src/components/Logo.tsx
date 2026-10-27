import React from "react";
import { brand } from "../brand";

/** 品牌标：烧瓶轮廓里的一顶帐篷 + 篝火点 */
export const LogoMark: React.FC<{ size: number; draw?: number }> = ({ size, draw = 1 }) => {
  const len = 520;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <path
        d="M46 10 H74 M50 10 V42 L18 100 Q14 110 26 110 H94 Q106 110 102 100 L70 42 V10"
        stroke={brand.colors.text}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={len}
        strokeDashoffset={len * (1 - draw)}
      />
      <path d="M36 98 L60 60 L84 98 Z" fill={brand.colors.accent} opacity={draw} />
      <path d="M60 60 L60 98" stroke={brand.colors.bg} strokeWidth={4} opacity={draw} />
      <circle cx={60} cy={30} r={4} fill={brand.colors.cool} opacity={draw} />
    </svg>
  );
};

export const Wordmark: React.FC<{ scale?: number }> = ({ scale = 1 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 18 * scale }}>
    <LogoMark size={72 * scale} />
    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
      <span style={{ fontFamily: brand.fontNumber, fontWeight: 800, fontSize: 34 * scale, letterSpacing: 4 * scale, color: brand.colors.text }}>
        {brand.name}
      </span>
      <span style={{ fontSize: 20 * scale, letterSpacing: 6 * scale, color: brand.colors.muted }}>{brand.nameZh}</span>
    </div>
  </div>
);
