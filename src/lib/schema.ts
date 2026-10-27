import { z } from "zod";

/**
 * 每期视频的“内容源”。一期 = 一个 episodes/<slug>/script.json。
 * 每个 segment = 一段旁白 + 一个场景。场景时长由配音长度自动决定。
 */

const tone = z.enum(["good", "bad", "neutral"]);

const base = {
  id: z.string().regex(/^[a-z0-9-]+$/i, "segment id 只能用字母数字和 -"),
  narration: z.string().min(1),
  /** 旁白结束后额外停留的秒数，默认 0.5 */
  padAfter: z.number().min(0).optional(),
};

export const segmentSchema = z.discriminatedUnion("scene", [
  z.object({
    ...base,
    scene: z.literal("intro"),
    props: z.object({ hook: z.string().optional() }).default({}),
  }),
  z.object({
    ...base,
    scene: z.literal("title"),
    props: z.object({
      kicker: z.string().optional(),
      heading: z.string(),
      sub: z.string().optional(),
    }),
  }),
  z.object({
    ...base,
    scene: z.literal("diagram"),
    props: z.object({
      /** 对应 src/diagrams/index.ts 里注册的图解名 */
      diagram: z.string(),
      heading: z.string().optional(),
      /** 按顺序高亮的步骤说明，均匀分布在旁白时长里 */
      steps: z.array(z.string()).default([]),
    }),
  }),
  z.object({
    ...base,
    scene: z.literal("comparison"),
    props: z.object({
      heading: z.string().optional(),
      left: z.object({ label: z.string(), points: z.array(z.string()), tone: tone.default("bad") }),
      right: z.object({ label: z.string(), points: z.array(z.string()), tone: tone.default("good") }),
    }),
  }),
  z.object({
    ...base,
    scene: z.literal("checklist"),
    props: z.object({
      heading: z.string(),
      items: z.array(z.string()).min(1),
    }),
  }),
  z.object({
    ...base,
    scene: z.literal("stat"),
    props: z.object({
      value: z.string(),
      unit: z.string().optional(),
      label: z.string(),
      note: z.string().optional(),
    }),
  }),
  z.object({
    ...base,
    scene: z.literal("outro"),
    props: z.object({
      cta: z.string().optional(),
      next: z.string().optional(),
    }).default({}),
  }),
]);

export const episodeSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, "slug 只能用小写字母、数字和 -"),
  episode: z.number().int().positive(),
  title: z.string(),
  subtitle: z.string().optional(),
  /** 可选：覆盖 .env 里的默认音色 */
  voiceId: z.string().optional(),
  /** 可选：public/ 下的背景音乐路径，例如 music/calm.mp3 */
  bgm: z.string().optional(),
  bgmVolume: z.number().min(0).max(1).default(0.12),
  segments: z.array(segmentSchema).min(1),
});

export const alignmentSchema = z.object({
  characters: z.array(z.string()),
  character_start_times_seconds: z.array(z.number()),
  character_end_times_seconds: z.array(z.number()),
});

export const voiceoverSchema = z.object({
  voiceId: z.string(),
  modelId: z.string(),
  segments: z.record(
    z.string(),
    z.object({
      /** public/ 下的相对路径 */
      file: z.string(),
      duration: z.number(),
      /** narration + 音色 + 模型 的哈希，用于跳过未修改的段落，节省额度 */
      hash: z.string(),
      alignment: alignmentSchema.optional(),
    }),
  ),
});

export type Episode = z.infer<typeof episodeSchema>;
export type EpisodeInput = z.input<typeof episodeSchema>;
export type Segment = z.infer<typeof segmentSchema>;
export type SceneType = Segment["scene"];
export type Voiceover = z.infer<typeof voiceoverSchema>;
export type Alignment = z.infer<typeof alignmentSchema>;
export type SegmentOf<T extends SceneType> = Extract<Segment, { scene: T }>;
