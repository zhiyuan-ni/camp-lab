/**
 * 扫描 episodes/ 目录，生成 src/episodes.generated.ts，
 * 让 Remotion 自动为每期注册横竖两个合成。同时校验每期 script.json。
 */
import fs from "node:fs";
import path from "node:path";
import { EPISODES_DIR, ROOT, listSlugs, loadEpisode } from "./paths";

const slugs = listSlugs();
let failed = false;
for (const slug of slugs) {
  try {
    loadEpisode(slug);
  } catch (e) {
    failed = true;
    console.error(`✕ ${(e as Error).message}`);
  }
}

const lines = [
  "// 本文件由 scripts/sync-episodes.ts 自动生成，请勿手改。运行 npm run sync 重新生成。",
  ...slugs.flatMap((slug, i) => {
    const hasVo = fs.existsSync(path.join(EPISODES_DIR, slug, "voiceover.json"));
    return [
      `import script${i} from "../episodes/${slug}/script.json";`,
      hasVo ? `import voiceover${i} from "../episodes/${slug}/voiceover.json";` : `const voiceover${i} = null;`,
    ];
  }),
  "",
  "export const episodes: { script: unknown; voiceover: unknown }[] = [",
  ...slugs.map((_, i) => `  { script: script${i}, voiceover: voiceover${i} },`),
  "];",
  "",
];
fs.writeFileSync(path.join(ROOT, "src", "episodes.generated.ts"), lines.join("\n"));
console.log(`✓ 已同步 ${slugs.length} 期：${slugs.join(", ") || "（无）"}`);
if (failed) process.exit(1);
