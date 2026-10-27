import type { Alignment, Episode, Segment, Voiceover } from "./schema";

/** 没有配音时，按中文语速估算时长（字/秒） */
export const CHARS_PER_SECOND = 4.2;
/** 每段开始前的留白，让画面先出现再开口 */
export const LEAD_IN = 0.3;
export const DEFAULT_PAD_AFTER = 0.5;

const MIN_SCENE_SECONDS: Partial<Record<Segment["scene"], number>> = {
  intro: 3.5,
  outro: 4,
  title: 2.5,
};

export type Caption = { text: string; start: number; end: number };

export type TimedSegment = {
  segment: Segment;
  from: number;
  durationInFrames: number;
  /** 旁白在本段内开始的帧 */
  narrationStart: number;
  narrationFrames: number;
  audio: string | null;
  captions: Caption[];
};

export type Timeline = { segments: TimedSegment[]; durationInFrames: number; hasAudio: boolean };

export const estimateSeconds = (text: string) => {
  const chars = [...text.replace(/\s/g, "")].length;
  return Math.max(1, chars / CHARS_PER_SECOND);
};

export const buildTimeline = (episode: Episode, voiceover: Voiceover | null, fps: number): Timeline => {
  let cursor = 0;
  let hasAudio = false;
  const segments = episode.segments.map((segment): TimedSegment => {
    const vo = voiceover?.segments[segment.id];
    if (vo) hasAudio = true;
    const speech = vo ? vo.duration : estimateSeconds(segment.narration);
    const pad = segment.padAfter ?? DEFAULT_PAD_AFTER;
    const total = Math.max(LEAD_IN + speech + pad, MIN_SCENE_SECONDS[segment.scene] ?? 0);
    const durationInFrames = Math.ceil(total * fps);
    const timed: TimedSegment = {
      segment,
      from: cursor,
      durationInFrames,
      narrationStart: Math.round(LEAD_IN * fps),
      narrationFrames: Math.ceil(speech * fps),
      audio: vo?.file ?? null,
      captions: buildCaptions(segment.narration, speech, vo?.alignment),
    };
    cursor += durationInFrames;
    return timed;
  });
  return { segments, durationInFrames: Math.max(cursor, 1), hasAudio };
};

const BREAK = /[，。！？；：、,.!?;:]/;
const MAX_LINE = 16;

/**
 * 把旁白切成字幕行：先按标点切成短句，再把短句拼成不超过 MAX_LINE 字的行，
 * 过长的单句硬切。有 ElevenLabs 字符时间戳时用真实时间，否则按字数比例分配。
 */
export const buildCaptions = (text: string, duration: number, alignment?: Alignment): Caption[] => {
  const chars = [...text];
  const visibleLen = (a: number, b: number) =>
    chars.slice(a, b).filter((c) => !/[\s，。！？；：、,.!?;:“”"]/.test(c)).length;

  // 1) 按标点切短句（标点留在句尾）
  const clauses: { start: number; end: number }[] = [];
  let start = 0;
  chars.forEach((c, i) => {
    if (BREAK.test(c) || i === chars.length - 1) {
      // 2) 单句过长则硬切
      for (let s = start; s <= i; s += MAX_LINE) clauses.push({ start: s, end: Math.min(s + MAX_LINE, i + 1) });
      start = i + 1;
    }
  });

  // 3) 把相邻短句拼成一行；句号/问号/感叹号处强制换行
  const merged: typeof clauses = [];
  for (const c of clauses) {
    const prev = merged[merged.length - 1];
    const prevEndsSentence = prev && /[。！？!?]/.test(chars[prev.end - 1]);
    if (prev && !prevEndsSentence && visibleLen(prev.start, c.end) <= MAX_LINE) prev.end = c.end;
    else merged.push({ ...c });
  }

  const timeAt = (index: number, edge: "start" | "end"): number => {
    if (alignment && alignment.characters.length === chars.length) {
      const arr = edge === "start" ? alignment.character_start_times_seconds : alignment.character_end_times_seconds;
      return arr[Math.min(Math.max(index, 0), arr.length - 1)];
    }
    const visible = (n: number) => chars.slice(0, n).filter((c) => !/\s/.test(c)).length;
    const total = Math.max(visible(chars.length), 1);
    return (visible(edge === "start" ? index : index + 1) / total) * duration;
  };

  return merged
    .map((p) => ({
      text: chars.slice(p.start, p.end).join("").trim().replace(/[，。、；：,.;:]+$/, ""),
      start: timeAt(p.start, "start"),
      end: timeAt(p.end - 1, "end"),
    }))
    .filter((c) => c.text.length > 0);
};
