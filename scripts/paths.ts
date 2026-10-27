import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { episodeSchema, type Episode } from "../src/lib/schema";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const EPISODES_DIR = path.join(ROOT, "episodes");
export const PUBLIC_DIR = path.join(ROOT, "public");

export const listSlugs = () =>
  fs
    .readdirSync(EPISODES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_") && fs.existsSync(path.join(EPISODES_DIR, d.name, "script.json")))
    .map((d) => d.name)
    .sort();

export const loadEpisode = (slug: string): Episode => {
  const file = path.join(EPISODES_DIR, slug, "script.json");
  if (!fs.existsSync(file)) throw new Error(`找不到 ${file}`);
  const parsed = episodeSchema.safeParse(JSON.parse(fs.readFileSync(file, "utf8")));
  if (!parsed.success) {
    throw new Error(`${slug}/script.json 格式有误：\n${parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n")}`);
  }
  if (parsed.data.slug !== slug) throw new Error(`${slug}/script.json 里的 slug 应为 "${slug}"`);
  return parsed.data;
};

export const requireSlug = (arg: string | undefined) => {
  if (!arg) {
    console.error(`请指定一期，例如：npm run voice -- ${listSlugs()[0] ?? "<slug>"}\n可用：${listSlugs().join(", ")}`);
    process.exit(1);
  }
  return arg;
};
