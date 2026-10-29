import { normalizeWord, type Cue, type TimedSegment, type Timeline } from "../lib/timeline";
import type { ShotContext, StageDef, StageState } from "./types";

export const findCue = (cues: Cue[], word: string, nth = 0, where = "") => {
  const w = normalizeWord(word);
  const hits = cues.filter((c) => c.word === w);
  if (!hits[nth]) throw new Error(`Cue "${word}"${nth ? ` #${nth}` : ""} not found in narration${where ? ` of ${where}` : ""}`);
  return hits[nth].start;
};

const contextAt = (t: TimedSegment, frame: number, fps: number, vertical: boolean): ShotContext => {
  const local = Math.min(Math.max(frame - t.from, 0), t.durationInFrames - 1);
  return {
    p: t.durationInFrames > 1 ? local / (t.durationInFrames - 1) : 0,
    t: local / fps,
    duration: t.durationInFrames / fps,
    time: frame / fps,
    vertical,
    cue: (word, nth) => findCue(t.cues, word, nth, t.segment.id),
  };
};

/** 某段镜头声明的动作时刻（本段秒数）。没有舞台或镜头没声明时返回空 */
export const shotMarks = (stage: StageDef<StageState> | undefined, t: TimedSegment, fps: number): Record<string, number> => {
  if (!stage || t.segment.scene !== "stage") return {};
  return stage.shots[t.segment.props.shot]?.marks?.(contextAt(t, t.from, fps, false)) ?? {};
};

/** 由全片帧号算出：现在在哪一段、用哪个镜头、这个镜头的状态 */
export const evaluateStage = <S extends StageState>(stage: StageDef<S>, timeline: Timeline, frame: number, fps: number, vertical: boolean) => {
  const t = timeline.segments.find((s) => frame >= s.from && frame < s.from + s.durationInFrames) ?? timeline.segments[timeline.segments.length - 1];
  const ctx = contextAt(t, frame, fps, vertical);
  const shotName = t.segment.scene === "stage" ? t.segment.props.shot : null;
  const shot = shotName ? stage.shots[shotName] : undefined;
  return { state: shot ? shot.pose(ctx) : stage.fallback(ctx), shot: shot ? shotName : null, ctx };
};
