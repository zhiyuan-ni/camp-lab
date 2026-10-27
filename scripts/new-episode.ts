/**
 * 新建一期：复制 episodes/_template，自动编号。
 *
 *   npm run new -- sleeping-bag-insulation "睡袋为什么能保暖？"
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { EPISODES_DIR, ROOT, listSlugs, loadEpisode } from "./paths";

const [slug, title = "新一期标题"] = process.argv.slice(2);
if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
  console.error('用法：npm run new -- <slug> "标题"   （slug 用小写英文和 -，例如 sleeping-bag-insulation）');
  process.exit(1);
}
const dir = path.join(EPISODES_DIR, slug);
if (fs.existsSync(dir)) {
  console.error(`episodes/${slug} 已存在`);
  process.exit(1);
}
const next = Math.max(0, ...listSlugs().map((s) => loadEpisode(s).episode)) + 1;
const template = JSON.parse(fs.readFileSync(path.join(EPISODES_DIR, "_template", "script.json"), "utf8"));
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "script.json"), JSON.stringify({ ...template, slug, episode: next, title }, null, 2) + "\n");
console.log(`✓ 已创建 episodes/${slug}/script.json（EP.${String(next).padStart(2, "0")}）`);
spawnSync("npx", ["tsx", "scripts/sync-episodes.ts"], { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" });
