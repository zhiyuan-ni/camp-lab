/**
 * 渲染一期视频（默认横竖两版 + 封面）。
 *
 *   npm run render -- <slug>
 *   npm run render -- <slug> --format 9x16      只出竖屏
 *   npm run render -- <slug> --no-captions      不烧录字幕
 *
 * 输出到 out/<slug>/
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { FORMATS } from "../src/brand";
import { ROOT, loadEpisode, requireSlug } from "./paths";

const args = process.argv.slice(2);
const slug = requireSlug(args.find((a) => !a.startsWith("--") && !Object.values(FORMATS).some((f) => f.suffix === a)));
loadEpisode(slug); // 先校验脚本
const only = args.includes("--format") ? args[args.indexOf("--format") + 1] : null;
const captions = !args.includes("--no-captions");

const outDir = path.join(ROOT, "out", slug);
fs.mkdirSync(outDir, { recursive: true });
const propsFile = path.join(outDir, ".props.json");
fs.writeFileSync(propsFile, JSON.stringify({ showCaptions: captions }));

const run = (cmd: string[]) => {
  console.log(`\n$ remotion ${cmd.join(" ")}`);
  const r = spawnSync("npx", ["remotion", ...cmd], { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

for (const f of Object.values(FORMATS)) {
  if (only && only !== f.suffix) continue;
  const id = `${slug}-${f.suffix}`;
  run(["render", "src/index.ts", id, path.join("out", slug, `${id}.mp4`), `--props=${propsFile}`]);
  run(["still", "src/index.ts", id, path.join("out", slug, `${id}-cover.png`), "--frame=75", `--props=${propsFile}`]);
}
fs.rmSync(propsFile);
console.log(`\n✓ 完成，输出在 out/${slug}/`);
