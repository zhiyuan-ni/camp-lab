/**
 * 新建一期：复制 episodes/_template，自动编号，并生成 SOURCES.md 和 NOTES.md。
 *
 *   npm run new -- sleeping-bag-insulation "How do sleeping bags keep you warm?"
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { EPISODES_DIR, ROOT, listSlugs, loadEpisode } from "./paths";

const [slug, title = "New episode title"] = process.argv.slice(2);
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
fs.writeFileSync(
  path.join(dir, "SOURCES.md"),
  `# Sources — ${slug}\n\nEvery factual claim on screen or in the narration needs one row: claim, source link, quoted excerpt.\nClaims without a reliable source go to NOTES.md and must not be published.\n\n| Claim | Source | Excerpt |\n|---|---|---|\n`,
);
fs.writeFileSync(
  path.join(dir, "NOTES.md"),
  `# Notes — ${slug}\n\nThings we are not yet sure about. Resolve each before publishing.\n\n`,
);
console.log(`✓ 已创建 episodes/${slug}/（script.json、SOURCES.md、NOTES.md）`);
spawnSync("npx", ["tsx", "scripts/sync-episodes.ts"], { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" });
