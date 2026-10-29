import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { brand } from "./brand";
import { Wordmark } from "./components/Logo";
import { SafeZone } from "./components/SafeZone";
import { StageCanvas } from "./components/StageCanvas";
import { momentResolver } from "./components/moment";
import type { EpisodeProps } from "./Episode";
import { useLayout } from "./lib/layout";

/**
 * 封面（缩略图）：取 script.json 里 cover 指定那一刻的 3D 画面，去掉字幕和读数层的文字，
 * 左上角放大标题，下面是品牌标。和正片同一套舞台，所以封面和视频里看到的是同一个东西。
 */
export const Cover: React.FC<EpisodeProps> = ({ episode, timeline, showSafeZone }) => {
  const { fps } = useVideoConfig();
  const { u, content, vertical } = useLayout();
  if (!timeline || !episode.stage) return null;
  const c = episode.cover;
  const { segment, frameAt } = momentResolver(episode, timeline, fps);
  const m = vertical && c?.vertical ? c.vertical : c;
  const frame = m ? frameAt(segment(m.segment), m.at, 0, m.offset) : Math.round(timeline.durationInFrames / 2);
  const title = c?.title ?? episode.title;
  const shadow = "0 4px 28px rgba(4, 8, 26, 0.6)";
  return (
    <AbsoluteFill style={{ backgroundColor: brand.lab.sky.top }}>
      <StageCanvas stageId={episode.stage} timeline={timeline} overlay={false} frame={frame} />
      <div style={{ position: "absolute", left: content.left, top: content.top, right: content.right, fontFamily: brand.font, color: brand.colors.text }}>
        <div style={{ fontSize: (vertical ? 120 : 132) * u, fontWeight: 900, letterSpacing: -3 * u, lineHeight: 0.98, textShadow: shadow, maxWidth: (vertical ? 860 : 1100) * u }}>
          {title}
        </div>
        <div style={{ marginTop: 34 * u, display: "flex", alignItems: "center", gap: 24 * u }}>
          <Wordmark scale={1.3 * u} />
          <span style={{ fontSize: 40 * u, fontWeight: 700, color: brand.colors.accent, letterSpacing: 2 * u, textShadow: shadow }}>
            EP.{String(episode.episode).padStart(2, "0")}
          </span>
        </div>
      </div>
      {showSafeZone && <SafeZone />}
    </AbsoluteFill>
  );
};
