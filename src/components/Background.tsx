import React from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { brand } from "../brand";
import { useLayout } from "../lib/layout";

/** 实验室网格 + 夜空微粒，所有场景共用 */
export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, u } = useLayout();
  const grid = 60 * u;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 0%, ${brand.colors.panel} 0%, ${brand.colors.bg} 55%, ${brand.colors.bgDeep} 100%)`,
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${brand.colors.line} 1px, transparent 1px), linear-gradient(90deg, ${brand.colors.line} 1px, transparent 1px)`,
          backgroundSize: `${grid}px ${grid}px`,
          backgroundPosition: `${-frame * 0.2}px ${-frame * 0.2}px`,
          opacity: 0.35,
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
        }}
      />
      <svg width={width} height={height} style={{ position: "absolute" }}>
        {Array.from({ length: 40 }, (_, i) => {
          const x = random(`x${i}`) * width;
          const y = ((random(`y${i}`) * height - frame * (0.2 + random(`s${i}`) * 0.4)) % height + height) % height;
          const r = (1 + random(`r${i}`) * 2) * u;
          const twinkle = 0.25 + 0.35 * Math.sin(frame / 20 + i);
          return <circle key={i} cx={x} cy={y} r={r} fill={brand.colors.text} opacity={twinkle} />;
        })}
      </svg>
    </AbsoluteFill>
  );
};
