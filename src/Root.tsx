import React from "react";
import { CalculateMetadataFunction, Composition, Folder } from "remotion";
import { FORMATS, FPS, type FormatKey } from "./brand";
import { EpisodeVideo, type EpisodeProps } from "./Episode";
import { episodes } from "./episodes.generated";
import { episodeSchema, voiceoverSchema } from "./lib/schema";
import { buildTimeline } from "./lib/timeline";

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
                width={f.width}
                height={f.height}
                fps={FPS}
                durationInFrames={1}
                defaultProps={{ episode: script, voiceover, showCaptions: true } as unknown as EpisodeProps}
                calculateMetadata={calculateMetadata}
              />
            );
          })}
        </Folder>
      );
    })}
  </>
);
