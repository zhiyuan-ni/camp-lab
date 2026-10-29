import React from "react";
import { Audio, Sequence, interpolate, staticFile, useVideoConfig } from "remotion";
import type { Episode, Sfx } from "../lib/schema";
import type { TimedSegment, Timeline } from "../lib/timeline";
import { stages } from "../stages";
import { findCue, shotMarks } from "../stages/evaluate";

type Placed = { key: string; src: string; from: number; frames?: number; volume: number; loop: boolean; fadeIn: number; fadeOut: number };

/** 把 script.json 里每段的 sfx 换算成全片帧号。时刻找不到就报错，不让声音悄悄错位 */
export const placeSfx = (episode: Episode, timeline: Timeline, fps: number): Placed[] => {
  const stage = episode.stage ? stages[episode.stage] : undefined;
  const marks = new Map<string, Record<string, number>>();
  const segOf = (id: string) => {
    const t = timeline.segments.find((s) => s.segment.id === id);
    if (!t) throw new Error(`sfx: segment "${id}" not found`);
    return t;
  };
  /** 段内某时刻 → 全片帧号 */
  const frameAt = (t: TimedSegment, at: number | string | undefined, nth: number, offset: number) => {
    let s: number;
    if (at === undefined) s = t.durationInFrames / fps;
    else if (typeof at === "number") s = at;
    else if (at.startsWith("#")) {
      if (!marks.has(t.segment.id)) marks.set(t.segment.id, shotMarks(stage, t, fps));
      const m = marks.get(t.segment.id)![at.slice(1)];
      if (m === undefined) throw new Error(`sfx: mark "${at}" not declared by the shot of ${t.segment.id}`);
      s = m;
    } else s = findCue(t.cues, at, nth, t.segment.id);
    return t.from + Math.round((s + offset) * fps);
  };
  return timeline.segments.flatMap((t) =>
    (t.segment.sfx ?? []).map((x: Sfx, i): Placed => {
      const from = Math.max(0, frameAt(t, x.at, x.nth, x.offset));
      const to = x.until ? frameAt(segOf(x.until.segment), x.until.at, 0, x.until.offset) : x.duration ? from + Math.round(x.duration * fps) : undefined;
      if (to !== undefined && to <= from) throw new Error(`sfx ${t.segment.id}[${i}] ends before it starts`);
      return { key: `${t.segment.id}-${i}`, src: x.src, from, frames: to === undefined ? undefined : Math.min(to, timeline.durationInFrames) - from, volume: x.volume, loop: x.loop, fadeIn: Math.round(x.fadeIn * fps), fadeOut: Math.round(x.fadeOut * fps) };
    }),
  );
};

/** 全片的音效层。放在 Episode 顶层，帧号是全片的 */
export const SoundEffects: React.FC<{ episode: Episode; timeline: Timeline }> = ({ episode, timeline }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {placeSfx(episode, timeline, fps).map((s) => {
        const volume = (f: number) => {
          let v = s.volume;
          if (s.fadeIn) v *= interpolate(f, [0, s.fadeIn], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          if (s.fadeOut && s.frames) v *= interpolate(f, [s.frames - s.fadeOut, s.frames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return v;
        };
        return (
          <Sequence key={s.key} from={s.from} durationInFrames={s.frames} layout="none" name={`sfx ${s.src}`}>
            <Audio src={staticFile(s.src)} volume={volume} loop={s.loop} />
          </Sequence>
        );
      })}
    </>
  );
};
