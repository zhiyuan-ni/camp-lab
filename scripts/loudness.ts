/**
 * 响度检查与标准化。目标：整体约 -14 LUFS，真峰值不超过 -1 dBTP（这是本系列自己的目标，不是平台硬标准）。
 *
 *   npm run loudness -- out/<slug>/<file>.mp4          只测量
 *   npm run loudness -- out/<slug>/<file>.mp4 --fix    超出范围时用两遍 loudnorm 标准化（原地替换，视频流不重编码）
 *
 * 用 Remotion 自带的 ffmpeg（带 loudnorm 滤镜），不需要另装。
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT } from "./paths";

export const TARGET_LUFS = -14;
export const MAX_TRUE_PEAK = -1;
const LUFS_TOLERANCE = 1;

type Measurement = { input_i: string; input_tp: string; input_lra: string; input_thresh: string; target_offset: string };

const ffmpeg = (args: string[]) => {
  const r = spawnSync("npx", ["remotion", "ffmpeg", "-hide_banner", "-nostats", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(`ffmpeg 失败：\n${r.stderr}`);
  return r.stderr;
};

const loudnormFilter = `loudnorm=I=${TARGET_LUFS}:TP=${MAX_TRUE_PEAK - 0.5}:LRA=11`;

const hasAudio = (file: string) => {
  const r = spawnSync("npx", ["remotion", "ffprobe", "-hide_banner", file], { cwd: ROOT, encoding: "utf8", shell: process.platform === "win32" });
  return /Stream #.*Audio:/.test(r.stderr + r.stdout);
};

export const measure = (file: string): Measurement => {
  const out = ffmpeg(["-i", file, "-vn", "-af", `${loudnormFilter}:print_format=json`, "-f", "null", "-"]);
  const json = out.slice(out.lastIndexOf("{"), out.lastIndexOf("}") + 1);
  return JSON.parse(json) as Measurement;
};

export type LoudnessResult = { file: string; lufs: number; truePeak: number; ok: boolean; silent: boolean };

export const check = (file: string): LoudnessResult => {
  if (!hasAudio(file)) return { file, lufs: -Infinity, truePeak: -Infinity, ok: false, silent: true };
  const m = measure(file);
  const lufs = Number(m.input_i);
  const truePeak = Number(m.input_tp);
  const silent = !Number.isFinite(lufs) || lufs < -70;
  const ok = !silent && Math.abs(lufs - TARGET_LUFS) <= LUFS_TOLERANCE && truePeak <= MAX_TRUE_PEAK;
  return { file, lufs, truePeak, ok, silent };
};

export const normalize = (file: string) => {
  const m = measure(file);
  const tmp = path.join(path.dirname(file), `.norm-${path.basename(file)}`);
  const filter =
    `${loudnormFilter}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}` +
    `:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  ffmpeg(["-y", "-i", file, "-af", filter, "-ar", "48000", "-c:v", "copy", "-c:a", "aac", "-b:a", "320k", "-movflags", "+faststart", tmp]);
  fs.renameSync(tmp, file);
};

const describe = (r: LoudnessResult) =>
  r.silent
    ? `${path.basename(r.file)}：没有声音（还没生成配音？），跳过响度检查`
    : `${path.basename(r.file)}：${r.lufs.toFixed(1)} LUFS，真峰值 ${r.truePeak.toFixed(1)} dBTP ${r.ok ? "✓" : "✕ 超出目标"}`;

/** 测量，必要时标准化后复测。返回最终结果。 */
export const checkAndFix = (file: string, fix: boolean): LoudnessResult => {
  let r = check(file);
  console.log(describe(r));
  if (!r.ok && !r.silent && fix) {
    console.log("  → 标准化中…");
    normalize(file);
    r = check(file);
    console.log(`  ${describe(r)}`);
  }
  return r;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const files = args.filter((a) => !a.startsWith("--"));
  if (!files.length) {
    console.error("用法：npm run loudness -- <file.mp4> [--fix]");
    process.exit(1);
  }
  const results = files.map((f) => checkAndFix(path.resolve(f), args.includes("--fix")));
  if (results.some((r) => !r.ok && !r.silent)) process.exit(1);
}
