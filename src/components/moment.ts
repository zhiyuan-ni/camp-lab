import type { Episode } from "../lib/schema";
import type { TimedSegment, Timeline } from "../lib/timeline";
import { stages } from "../stages";
import { findCue, shotMarks } from "../stages/evaluate";

/**
 * 把 “某段的某个时刻” 换算成全片帧号。时刻可以是：数字（本段秒数）、旁白里的词、"#名字"（镜头 marks 里的动作）、
 * 不写（段尾）。音效、封面都用它。找不到就报错，不让它悄悄错位。
 */
export const momentResolver = (episode: Episode, timeline: Timeline, fps: number) => {
  const stage = episode.stage ? stages[episode.stage] : undefined;
  const marks = new Map<string, Record<string, number>>();
  const segment = (id: string): TimedSegment => {
    const t = timeline.segments.find((s) => s.segment.id === id);
    if (!t) throw new Error(`Segment "${id}" not found`);
    return t;
  };
  const frameAt = (t: TimedSegment, at: number | string | undefined, nth = 0, offset = 0) => {
    let s: number;
    if (at === undefined) s = t.durationInFrames / fps;
    else if (typeof at === "number") s = at;
    else if (at.startsWith("#")) {
      if (!marks.has(t.segment.id)) marks.set(t.segment.id, shotMarks(stage, t, fps));
      const m = marks.get(t.segment.id)![at.slice(1)];
      if (m === undefined) throw new Error(`Mark "${at}" is not declared by the shot of ${t.segment.id}`);
      s = m;
    } else s = findCue(t.cues, at, nth, t.segment.id);
    return t.from + Math.round((s + offset) * fps);
  };
  return { segment, frameAt };
};
