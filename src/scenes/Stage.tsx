import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { brand } from "../brand";
import { clamp, useEnter } from "../lib/anim";
import { useLayout } from "../lib/layout";
import { stages } from "../stages";
import type { SceneProps } from "./types";

/**
 * 3D 舞台段：画面由 StageCanvas 统一画，这里只放屏幕标题。
 * 标题贴左上角安全区，不做居中大字；入场时刻由镜头的 headingAt 决定。
 */
export const Stage: React.FC<SceneProps<"stage">> = ({ episode, segment }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { u, content, vertical } = useLayout();
  const shot = episode.stage ? stages[episode.stage]?.shots[segment.props.shot] : undefined;
  const isFirst = episode.segments[0].id === segment.id;
  // 第一段第 0 帧就要有字：入场提前，第 0 帧已经大半到位
  const at = isFirst ? -12 : Math.round((shot?.headingAt ?? 0.08) * durationInFrames);
  const enter = useEnter(at, 18);
  const subEnter = useEnter(at + 8, 18);
  const exit = interpolate(frame, [durationInFrames - 10, durationInFrames - 1], [1, 0], clamp);
  const { heading, sub } = segment.props;
  if (!heading) return null;
  const shadow = "0 2px 18px rgba(6, 10, 32, 0.45)";
  return (
    <div style={{ position: "absolute", left: content.left, top: content.top, right: content.right, fontFamily: brand.font, color: brand.colors.text }}>
      <div
        style={{
          fontSize: (vertical ? 72 : 92) * u,
          fontWeight: 800,
          letterSpacing: -1.5 * u,
          lineHeight: 1.05,
          textShadow: shadow,
          opacity: enter * exit,
          transform: `translateY(${(1 - enter) * 40 * u - (1 - exit) * 20 * u}px)`,
        }}
      >
        {heading}
      </div>
      {sub && (
        <div style={{ fontSize: 44 * u, fontWeight: 600, marginTop: 10 * u, opacity: 0.88 * subEnter * exit, textShadow: shadow, transform: `translateY(${(1 - subEnter) * 24 * u}px)` }}>
          {sub}
        </div>
      )}
    </div>
  );
};
