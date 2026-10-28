import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { Background } from "./components/Background";
import { Captions } from "./components/Captions";
import { SafeZone } from "./components/SafeZone";
import { StageCanvas } from "./components/StageCanvas";
import type { Episode, Voiceover } from "./lib/schema";
import type { Timeline } from "./lib/timeline";
import { scenes } from "./scenes";
import type { SceneProps } from "./scenes/types";

export type EpisodeProps = {
  episode: Episode;
  voiceover: Voiceover | null;
  /** 由 calculateMetadata 根据配音时长算出 */
  timeline?: Timeline;
  showCaptions: boolean;
  /** 叠加安全区，自查用；在 Studio 右侧 Props 面板里勾选 */
  showSafeZone: boolean;
};

export const EpisodeVideo: React.FC<EpisodeProps> = ({ episode, timeline, showCaptions, showSafeZone }) => {
  if (!timeline) return null;
  return (
    <AbsoluteFill>
      {episode.stage ? <StageCanvas stageId={episode.stage} timeline={timeline} /> : <Background />}
      {episode.bgm && <Audio src={staticFile(episode.bgm)} volume={episode.bgmVolume} loop />}
      {timeline.segments.map((t) => {
        const Scene = scenes[t.segment.scene] as React.FC<SceneProps<typeof t.segment.scene>>;
        return (
          <Sequence key={t.segment.id} from={t.from} durationInFrames={t.durationInFrames} name={`${t.segment.id} · ${t.segment.scene}`}>
            <Scene episode={episode} segment={t.segment} narrationStart={t.narrationStart} narrationFrames={t.narrationFrames} />
            {t.audio && (
              <Sequence from={t.narrationStart} layout="none">
                <Audio src={staticFile(t.audio)} />
              </Sequence>
            )}
            {showCaptions && <Captions captions={t.captions} offset={t.narrationStart} />}
          </Sequence>
        );
      })}
      {showSafeZone && <SafeZone />}
    </AbsoluteFill>
  );
};
