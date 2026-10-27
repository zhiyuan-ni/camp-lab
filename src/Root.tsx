import React from "react";
import { CalculateMetadataFunction, Composition, Folder } from "remotion";
import { FORMATS, FPS, type FormatKey } from "./brand";
import { ContactSheet, SHEET_GAP, SHEET_HEADER, SHEET_LABEL, type ContactSheetProps } from "./ContactSheet";
import { EpisodeVideo, type EpisodeProps } from "./Episode";
import { episodes } from "./episodes.generated";
import { z } from "zod";
import { episodeSchema, voiceoverSchema } from "./lib/schema";
import { buildTimeline } from "./lib/timeline";

/** Studio 的 Props 面板据此显示开关；内容本身请改 script.json */
const compositionSchema = z.object({
  showCaptions: z.boolean(),
  showSafeZone: z.boolean(),
  episode: z.any(),
  voiceover: z.any(),
  timeline: z.any().optional(),
});

const calculateMetadata: CalculateMetadataFunction<EpisodeProps> = ({ props }) => {
  const episode = episodeSchema.parse(props.episode);
  const voiceover = props.voiceover ? voiceoverSchema.parse(props.voiceover) : null;
  const timeline = buildTimeline(episode, voiceover, FPS);
  return { durationInFrames: timeline.durationInFrames, props: { ...props, episode, timeline } };
};

/**
 * 每期自动注册两个合成：<slug>-16x9（横屏）和 <slug>-9x16（竖屏）。
 * 期数列表由 `npm run sync` 扫描 episodes/ 目录生成。
 */
export const RemotionRoot: React.FC = () => (
  <>
    {/* 工具合成：关键帧总览图，由 npm run sheet 调用 */}
    <Composition
      id="contact-sheet"
      component={ContactSheet}
      width={1920}
      height={1080}
      fps={FPS}
      durationInFrames={1}
      defaultProps={{ title: "Contact sheet", cols: 3, tileWidth: 360, tileHeight: 640, tiles: [] } as ContactSheetProps}
      calculateMetadata={({ props }) => {
        const rows = Math.ceil(props.tiles.length / props.cols) || 1;
        return {
          width: props.cols * props.tileWidth + (props.cols + 1) * SHEET_GAP,
          height: SHEET_HEADER + rows * (props.tileHeight + SHEET_LABEL + SHEET_GAP) + SHEET_GAP,
        };
      }}
    />
    {episodes.map(({ script, voiceover }) => {
      const slug = (script as { slug: string }).slug;
      return (
        <Folder key={slug} name={slug}>
          {(Object.keys(FORMATS) as FormatKey[]).map((key) => {
            const f = FORMATS[key];
            return (
              <Composition
                key={key}
                id={`${slug}-${f.suffix}`}
                component={EpisodeVideo}
                schema={compositionSchema}
                width={f.width}
                height={f.height}
                fps={FPS}
                durationInFrames={1}
                defaultProps={{ episode: script, voiceover, showCaptions: true, showSafeZone: false } as unknown as EpisodeProps}
                calculateMetadata={calculateMetadata}
              />
            );
          })}
        </Folder>
      );
    })}
  </>
);
