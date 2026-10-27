# 定系列风格（一次性使用：开新系列、换季改版时）

> 这是原模板里“先给 2 个方向”和“技术选型菜单”的归宿。定下来之后，结果写进 `src/brand.ts` 和 `CLAUDE.md`，之后每一集都不再重新选。

```
我们要（重新）定 CAMP LAB 的系列视觉风格。先读 CLAUDE.md 和 src/brand.ts，了解现在的样子。
在我选好方向之前，不要改 brand.ts 和任何现有组件。

用 EP.01（tent-condensation）当样片，给我 2 个差别拉开的方向。每个方向写清：

- 一句话风格；
- 用哪几种技术和 @remotion/* 包，以及为什么适合“露营科学图解”这种内容；
- 配色 3–4 个色值，说明每个颜色在系列里固定代表什么（例如：暖/热/危险、冷/水汽/安全）；
- 英文字体（标题和正文），写明授权，例如 SIL OFL 1.1；
- 用到的所有第三方东西及授权；
- 这个方向在 7 个现有场景上的样子：每个方向用 npx remotion still 渲 3 张关键帧（开场、原理图、清单），横竖屏各一套；
- 这个方向的代价：要新写多少组件、渲染会不会变慢、以后每集维护难不难。

我选定后：
1. 改 src/brand.ts 和需要改的组件；
2. 把 CLAUDE.md 的“新增画面时的技术选择”一节改成只保留这个方向用得到的技术；
3. 重渲 EP.01 的 15 秒样片给我看。
```

## 技术选型参考（从原模板保留，给定风格时挑选用）

- 深色背景、发光粒子、电影感 → `<canvas>` 按帧整帧重画；辉光用亮部图层缩小模糊后 screen 叠回；颗粒用 `@remotion/noise` 或带种子的噪声。
- 干净的排版、图表、界面动效 → React + CSS + SVG，`spring()` 和 `interpolate()`；画线 `@remotion/paths`；文字尺寸 `@remotion/layout-utils`。
- 3D 空间、镜头穿行 → `@remotion/three`（ThreeCanvas + React Three Fiber），位置从帧号算，不用 `useFrame`。
- 水彩、彩铅、手绘 → SVG `feTurbulence` + `feDisplacementMap` 做笔触抖动；要真实笔刷时用 p5.js + p5.brush 离线渲成透明 PNG 序列，再用 `<Img>` 按帧引入。
- 水、光、流体、老电视质感 → WebGL 着色器（GLSL 或 Three.js `ShaderMaterial`），渲染加 `--gl=angle`，会慢。
- 像素风 → 小 canvas 整数倍放大，`image-rendering: pixelated`。
- 公式和几何推导 → KaTeX + SVG；复杂推导用 Manim 渲成带 alpha 的视频（ProRes 4444 .mov 或 VP9 .webm），再用 `<OffthreadVideo transparent>` 合进来。
- 已有 Lottie → `@remotion/lottie`，先确认可以商用。
- 写实人物、产品照片 → 代码画不好，列出要准备的素材和授权。
