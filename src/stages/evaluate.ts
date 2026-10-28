import type { Timeline } from "../lib/timeline";
import type { ShotContext, StageDef, StageState } from "./types";

/** 由全片帧号算出：现在在哪一段、用哪个镜头、这个镜头的状态 */
export const evaluateStage = <S extends StageState>(stage: StageDef<S>, timeline: Timeline, frame: number, fps: number, vertical: boolean) => {
  const t = timeline.segments.find((s) => frame >= s.from && frame < s.from + s.durationInFrames) ?? timeline.segments[timeline.segments.length - 1];
  const local = Math.min(Math.max(frame - t.from, 0), t.durationInFrames - 1);
  const ctx: ShotContext = {
    p: t.durationInFrames > 1 ? local / (t.durationInFrames - 1) : 0,
    t: local / fps,
    duration: t.durationInFrames / fps,
    time: frame / fps,
    vertical,
  };
  const shotName = t.segment.scene === "stage" ? t.segment.props.shot : null;
  const shot = shotName ? stage.shots[shotName] : undefined;
  return { state: shot ? shot.pose(ctx) : stage.fallback(ctx), shot: shot ? shotName : null, ctx };
};
