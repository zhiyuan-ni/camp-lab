import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

/** Inter，SIL OFL 1.1。字体文件在 public/fonts/，许可证见 public/fonts/Inter-OFL.txt */
const WEIGHTS = [400, 500, 600, 700, 800, 900];

export const fontsReady = Promise.all(
  WEIGHTS.map((weight) =>
    loadFont({ family: "Inter", url: staticFile(`fonts/inter-${weight}.woff2`), weight: String(weight) }),
  ),
);
