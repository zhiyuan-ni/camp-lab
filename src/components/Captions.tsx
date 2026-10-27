import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { brand } from "../brand";
import { useLayout } from "../lib/layout";
import type { Caption } from "../lib/timeline";

/** 底部字幕。frame 为本段内帧，offset 为旁白起点。 */
export const Captions: React.FC<{ captions: Caption[]; offset: number }> = ({ captions, offset }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, captionBottom, safe } = useLayout();
  const t = (frame - offset) / fps;
  const current = captions.find((c, i) => t >= c.start && t < (captions[i + 1]?.start ?? c.end + 0.6));
  if (!current) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: captionBottom, paddingLeft: safe.left, paddingRight: safe.right }}>
      <div
        style={{
          fontFamily: brand.font,
          fontSize: 48 * u,
          fontWeight: 700,
          color: brand.colors.text,
          background: "rgba(8, 19, 15, 0.72)",
          padding: `${14 * u}px ${32 * u}px`,
          borderRadius: 14 * u,
          textAlign: "center",
          lineHeight: 1.35,
        }}
      >
        {current.text}
      </div>
    </AbsoluteFill>
  );
};
