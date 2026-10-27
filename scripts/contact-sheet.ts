/**
 * 关键帧总览图：横竖两版各取 9 个均匀分布的时刻，叠加安全区，拼成一张图。
 * 竖屏每格缩到 360 像素宽（手机实际观感），横屏每格 640 像素宽。用来检查字是否读得清、有没有越界。
 *
 *   npm run sheet -- <slug>
 *
 * 输出：out/<slug>/<slug>-16x9-sheet.png、out/<slug>/<slug>-9x16-sheet.png
 */
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FORMATS, FPS } from "../src/brand";
import type { Timeline } from "../src/lib/timeline";
import { PUBLIC_DIR, ROOT, loadEpisode, requireSlug } from "./paths";

const TILES = 9;
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE ?? null;

export const makeContactSheets = async (slug: string, serveUrl?: string) => {
  loadEpisode(slug);
  const url =
    serveUrl ?? (await bundle({ entryPoint: path.join(ROOT, "src", "index.ts"), publicDir: PUBLIC_DIR }));
  const outDir = path.join(ROOT, "out", slug);
  fs.mkdirSync(outDir, { recursive: true });
  const outputs: string[] = [];

  for (const f of Object.values(FORMATS)) {
    const id = `${slug}-${f.suffix}`;
    const inputProps = { showSafeZone: true };
    const comp = await selectComposition({ serveUrl: url, id, inputProps, browserExecutable });
    const timeline = (comp.props as { timeline: Timeline }).timeline;
    const vertical = f.height > f.width;
    const tileWidth = vertical ? 360 : 640;
    const scale = tileWidth / f.width;

    const tiles = [];
    for (let i = 0; i < TILES; i++) {
      const frame = Math.round(((i + 0.5) / TILES) * (comp.durationInFrames - 1));
      const seg = timeline.segments.find((s) => frame >= s.from && frame < s.from + s.durationInFrames);
      const { buffer } = await renderStill({
        serveUrl: url,
        composition: comp,
        frame,
        inputProps,
        imageFormat: "jpeg",
        jpegQuality: 85,
        scale,
        browserExecutable,
      });
      tiles.push({
        src: `data:image/jpeg;base64,${buffer!.toString("base64")}`,
        label: `${(frame / FPS).toFixed(1)}s · f${frame} · ${seg?.segment.id ?? ""} ${seg?.segment.scene ?? ""}`,
      });
      process.stdout.write(".");
    }

    const sheetProps = {
      title: `${id} · safe zones red · ${tileWidth}px`,
      cols: 3,
      tileWidth,
      tileHeight: Math.round(f.height * scale),
      tiles,
    };
    const sheet = await selectComposition({ serveUrl: url, id: "contact-sheet", inputProps: sheetProps, browserExecutable });
    const output = path.join(outDir, `${id}-sheet.png`);
    await renderStill({ serveUrl: url, composition: sheet, inputProps: sheetProps, output, imageFormat: "png", browserExecutable });
    outputs.push(output);
    console.log(` ✓ ${path.relative(ROOT, output)}`);
  }
  return outputs;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await makeContactSheets(requireSlug(process.argv[2]));
}
