import type { Episode, SceneType, SegmentOf } from "../lib/schema";
import type { Cue } from "../lib/timeline";

export type SceneProps<T extends SceneType> = {
  episode: Episode;
  segment: SegmentOf<T>;
  /** 旁白在本段内的起止帧，用来让动画跟着讲解节奏走 */
  narrationStart: number;
  narrationFrames: number;
  /** 旁白每个词的开口时刻，见 lib/timeline.ts */
  cues: Cue[];
};
