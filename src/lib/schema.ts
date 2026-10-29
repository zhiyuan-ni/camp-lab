import { z } from "zod";

/**
 * 每期视频的“内容源”。一期 = 一个 episodes/<slug>/script.json。
 * 每个 segment = 一段旁白 + 一个场景。场景时长由配音长度自动决定。
 */

const tone = z.enum(["good", "bad", "neutral"]);

/**
 * 段内的一个时刻：数字 = 本段第几秒（含开头留白）；单词 = 旁白说到这个词的那一刻；
 * "#名字" = 舞台镜头在 marks 里声明的动作时刻（比如水珠落地），跟着镜头走，不用手算秒数。
 */
const moment = z.union([z.number().min(0), z.string().min(1)]);

/** 一个音效：从某段的某个时刻开始。声音文件放 public/sfx/，授权写进 LICENSES.md */
export const sfxSchema = z.object({
  /** public/ 下的路径，例如 sfx/drip.wav */
  src: z.string(),
  at: moment.default(0),
  /** at 是单词时，取第几次出现（从 0 数） */
  nth: z.number().int().min(0).default(0),
  /** 在 at 基础上再挪多少秒，可以是负数（让声音的重心对上动作） */
  offset: z.number().default(0),
  volume: z.number().min(0).max(1).default(0.5),
  /** 可选：播到哪一刻为止（可以跨段）。不写就把文件播完 */
  until: z.object({ segment: z.string(), at: moment.optional(), offset: z.number().default(0) }).optional(),
  /** 可选：直接给播放秒数，和 until 二选一 */
  duration: z.number().positive().optional(),
  /** 文件比要播的时间短时循环，环境声用 */
  loop: z.boolean().default(false),
  fadeIn: z.number().min(0).default(0),
  fadeOut: z.number().min(0).default(0),
});

const base = {
  id: z.string().regex(/^[a-z0-9-]+$/i, "segment id 只能用字母数字和 -"),
  narration: z.string().min(1),
  /** 旁白结束后额外停留的秒数，默认 0.5 */
  padAfter: z.number().min(0).optional(),
  /** 可选：这一段里的音效和环境声 */
  sfx: z.array(sfxSchema).optional(),
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
    /** 3D 舞台上的一个镜头：画面由整集共用的 3D 场景（episode.stage）按 shot 名算出，这里只放屏幕文字 */
    scene: z.literal("stage"),
    props: z.object({
      /** 对应 src/stages/<stage>/shots.ts 里的镜头名 */
      shot: z.string(),
      heading: z.string().optional(),
      sub: z.string().optional(),
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
  /** 可选：整集共用的 3D 舞台，对应 src/stages/index.ts 里注册的名字。用了它，stage 段的画面都在这个舞台上拍 */
  stage: z.string().optional(),
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
export type Sfx = z.infer<typeof sfxSchema>;
export type Voiceover = z.infer<typeof voiceoverSchema>;
export type Alignment = z.infer<typeof alignmentSchema>;
export type SegmentOf<T extends SceneType> = Extract<Segment, { scene: T }>;
