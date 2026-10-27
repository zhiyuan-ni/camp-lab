/**
 * 用 ElevenLabs 为一期视频逐段生成配音 + 字符级时间戳。
 *
 *   npm run voice -- <slug>            只生成有改动的段落（按旁白文本哈希判断，省额度）
 *   npm run voice -- <slug> --force    全部重新生成
 *
 * 输出：
 *   public/voiceover/<slug>/<segmentId>.mp3
 *   episodes/<slug>/voiceover.json    时长 + 时间戳，Remotion 用它自动排时间轴和字幕
 *
 * 没有 API Key 时什么都不用做：预览和渲染会按字数估算时长，只是没有声音。
 */
import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { voiceoverSchema, type Voiceover } from "../src/lib/schema";
import { EPISODES_DIR, PUBLIC_DIR, loadEpisode, requireSlug } from "./paths";

const args = process.argv.slice(2);
const slug = requireSlug(args.find((a) => !a.startsWith("--")));
const force = args.includes("--force");

const apiKey = process.env.ELEVENLABS_API_KEY;
const episode = loadEpisode(slug);
const voiceId = episode.voiceId || process.env.ELEVENLABS_VOICE_ID;
const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";

if (!apiKey || !voiceId) {
  console.log(
    [
      "未配置 ELEVENLABS_API_KEY 或 ELEVENLABS_VOICE_ID，跳过配音生成。",
      "→ 复制 .env.example 为 .env 并填写后重新运行。",
      "→ 在此之前，npm run dev / npm run render 会按字数估算每段时长（无声音），不影响排版和预览。",
    ].join("\n"),
  );
  process.exit(0);
}

const manifestPath = path.join(EPISODES_DIR, slug, "voiceover.json");
const previous: Voiceover | null = fs.existsSync(manifestPath)
  ? voiceoverSchema.parse(JSON.parse(fs.readFileSync(manifestPath, "utf8")))
  : null;

const audioDir = path.join(PUBLIC_DIR, "voiceover", slug);
fs.mkdirSync(audioDir, { recursive: true });

type TtsResponse = {
  audio_base64: string;
  alignment: {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  } | null;
};

const tts = async (text: string, previousText?: string, nextText?: string): Promise<TtsResponse> => {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: modelId,
        // 上下文让相邻段落语气连贯
        previous_text: previousText,
        next_text: nextText,
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.2, use_speaker_boost: true },
      }),
    });
    if (res.ok) return (await res.json()) as TtsResponse;
    const body = await res.text();
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      console.warn(`  ElevenLabs ${res.status}，${attempt * 2}s 后重试…`);
      await new Promise((r) => setTimeout(r, attempt * 2000));
      continue;
    }
    throw new Error(`ElevenLabs 返回 ${res.status}: ${body}`);
  }
};

const result: Voiceover = { voiceId, modelId, segments: {} };
let generated = 0;

for (const [i, seg] of episode.segments.entries()) {
  const hash = crypto.createHash("sha1").update(`${voiceId}|${modelId}|${seg.narration}`).digest("hex").slice(0, 12);
  const rel = `voiceover/${slug}/${seg.id}.mp3`;
  const old = previous?.segments[seg.id];
  if (!force && old && old.hash === hash && fs.existsSync(path.join(PUBLIC_DIR, rel))) {
    result.segments[seg.id] = old;
    console.log(`= ${seg.id} 未修改，跳过`);
    continue;
  }
  process.stdout.write(`→ ${seg.id} 生成中… `);
  const res = await tts(seg.narration, episode.segments[i - 1]?.narration, episode.segments[i + 1]?.narration);
  fs.writeFileSync(path.join(PUBLIC_DIR, rel), Buffer.from(res.audio_base64, "base64"));
  const ends = res.alignment?.character_end_times_seconds ?? [];
  const duration = ends.length ? ends[ends.length - 1] : 0;
  result.segments[seg.id] = {
    file: rel,
    duration,
    hash,
    alignment: res.alignment ?? undefined,
  };
  generated++;
  console.log(`${duration.toFixed(2)}s`);
}

// 清理已删除段落的旧音频
for (const f of fs.readdirSync(audioDir)) {
  if (!result.segments[path.parse(f).name]) fs.rmSync(path.join(audioDir, f));
}

fs.writeFileSync(manifestPath, JSON.stringify(result, null, 2));
const total = Object.values(result.segments).reduce((s, x) => s + x.duration, 0);
console.log(`✓ ${slug}：新生成 ${generated} 段，旁白总长 ${total.toFixed(1)}s。运行 npm run dev 预览。`);
