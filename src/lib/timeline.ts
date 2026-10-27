import type { Alignment, Episode, Segment, Voiceover } from "./schema";

/** 没有配音时，按英文语速估算时长（约 150 词/分钟） */
export const WORDS_PER_SECOND = 2.5;
/** 每个句末或逗号停顿额外加的秒数 */
const PAUSE_SECONDS = 0.15;
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

export const countWords = (text: string) => text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

export const estimateSeconds = (text: string) => {
  const pauses = (text.match(/[,.;:!?—]/g) ?? []).length;
  return Math.max(1, countWords(text) / WORDS_PER_SECOND + pauses * PAUSE_SECONDS);
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

/** 每行字幕最多几个词 */
export const MAX_WORDS_PER_LINE = 6;
const SENTENCE_END = /[.!?…]["”’)]*$/;
const CLAUSE_END = /[,;:—]["”’)]*$/;

/**
 * 把旁白切成字幕行：按词切，每行不超过 MAX_WORDS_PER_LINE 个词；
 * 句末必换行，逗号处在行里已有 3 个词以上时换行，避免只剩一个词的孤行。
 * 有 ElevenLabs 字符时间戳时用真实时间，否则按字符数比例分配。
 */
export const buildCaptions = (text: string, duration: number, alignment?: Alignment): Caption[] => {
  const words = [...text.matchAll(/\S+/g)].map((m) => ({ word: m[0], start: m.index!, end: m.index! + m[0].length }));
  if (words.length === 0) return [];

  type Word = (typeof words)[number];
  // 1) 按标点切成短句；句末标记为必须换行
  const clauses: { words: Word[]; sentenceEnd: boolean }[] = [];
  let current: Word[] = [];
  words.forEach((w, i) => {
    current.push(w);
    const sentenceEnd = SENTENCE_END.test(w.word);
    if (sentenceEnd || CLAUSE_END.test(w.word) || i === words.length - 1) {
      clauses.push({ words: current, sentenceEnd });
      current = [];
    }
  });

  // 2) 过长的短句均匀切开（7 个词 → 4 + 3，而不是 6 + 1）
  const chunks = clauses.flatMap((c) => {
    const n = Math.ceil(c.words.length / MAX_WORDS_PER_LINE);
    const size = Math.ceil(c.words.length / n);
    return Array.from({ length: n }, (_, k) => ({
      words: c.words.slice(k * size, (k + 1) * size),
      sentenceEnd: c.sentenceEnd && k === n - 1,
    }));
  });

  // 3) 同一句里相邻的短块拼成一行，不超过上限
  const lines: Word[][] = [];
  let open: { words: Word[]; sentenceEnd: boolean } | null = null;
  for (const c of chunks) {
    if (open && !open.sentenceEnd && open.words.length + c.words.length <= MAX_WORDS_PER_LINE) {
      open.words.push(...c.words);
      open.sentenceEnd = c.sentenceEnd;
    } else {
      if (open) lines.push(open.words);
      open = { words: [...c.words], sentenceEnd: c.sentenceEnd };
    }
  }
  if (open) lines.push(open.words);

  const useAlignment = alignment && alignment.characters.join("") === text;
  const nonSpaceBefore = (index: number) => text.slice(0, index).replace(/\s/g, "").length;
  const totalNonSpace = Math.max(nonSpaceBefore(text.length), 1);
  const timeAt = (index: number, edge: "start" | "end"): number => {
    if (useAlignment) {
      const arr = edge === "start" ? alignment.character_start_times_seconds : alignment.character_end_times_seconds;
      return arr[Math.min(Math.max(index, 0), arr.length - 1)];
    }
    return (nonSpaceBefore(edge === "start" ? index : index + 1) / totalNonSpace) * duration;
  };

  return lines.map((l) => ({
    text: l.map((w) => w.word).join(" ").replace(/[,;:—]+$/, ""),
    start: timeAt(l[0].start, "start"),
    end: timeAt(l[l.length - 1].end - 1, "end"),
  }));
};
