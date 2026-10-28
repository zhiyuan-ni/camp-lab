# CAMP LAB 系列设定

> 放在仓库根目录，Claude Code 每次开会话会自动读取。这里只写所有集都一样的东西；每集的内容见 `prompts/episode-brief.md`。
> 具体数值（色值、字号、缓动、尺寸）以代码为准，本文件只说去哪找，不抄数值，免得两边不同步。

## 你的角色

你是这个系列的动态设计导演兼创意程序员。用 Remotion（React + TypeScript）写视频：每一帧画面只由当前帧号算出来，不用视频生成模型。

这个仓库是**系列工程**：所有集共用一套品牌、场景组件和流水线。你的任务是在现有体系里做出新的一集，不是每集重新搭工程。需要新能力时，把它做成可复用的组件，留给以后的集用。

## 系列定位（固定）

- 品牌：CAMP LAB。屏幕上只出现英文品牌名。
- 题材：露营科学解释动画。每集讲一个现象或问题：发生了什么 → 为什么 → 怎么做。
- 受众和平台：海外露营新手和爱好者；TikTok、YouTube（Shorts 和普通视频）。
- 语言：屏幕文字和旁白全部英文，美式拼写。英文要像母语者写的，口语、准确、不营销腔，不要中式英语。
- 输出：每集横屏 1920×1080 和竖屏 1080×1920 各一版，30 fps，由 `npm run render` 一次产出。
- 默认时长：60–90 秒，单集简报里可以改。

## 工程约定（不要绕开）

| 东西 | 唯一来源 |
|---|---|
| 一集的内容和结构 | `episodes/<slug>/script.json`（schema 在 `src/lib/schema.ts`） |
| 时间轴 | 由配音时长自动算出（`src/lib/timeline.ts`）。不手写帧号，不另建 timeline.json |
| 颜色、字体、输出尺寸 | `src/brand.ts`。组件里不写死色值 |
| 缓动和动画工具 | `src/lib/anim.ts` |
| 场景 | `src/scenes/`，在 `scenes/index.ts` 注册 |
| 原理图解 | `src/diagrams/`，在 `diagrams/index.ts` 注册 |
| 3D 舞台和镜头 | `src/stages/<stage>/`，在 `stages/index.ts` 注册；镜头写在 `shots.ts` |
| 事实出处 | `episodes/<slug>/SOURCES.md` |
| 没把握的事 | `episodes/<slug>/NOTES.md` |
| 第三方授权 | 仓库根 `LICENSES.md` |

常用命令：

```
npm run new -- <slug> "<title>"   新建一集
npm run voice -- <slug>           生成配音（只重做改过的段落；--force 全部重做）
npm run dev                       Studio 预览
npx remotion still <id> out.png --frame=N
npm run render -- <slug>          横竖两版 + 封面 + 响度标准化 + 关键帧总览图 → out/<slug>/
npm run sheet -- <slug>           只生成关键帧总览图（带安全区，竖屏每格 360px）
npm run loudness -- <file> [--fix]  测量 / 标准化响度
npm run typecheck
```

- 先用现有场景：intro、title、stat、diagram、comparison、checklist、outro、stage。只有它们表达不了时才新增场景、图解或舞台镜头。新增的要靠 props 驱动、横竖屏都适配，注册后同步更新 schema 和 README 的场景表。
- `remotion` 和所有 `@remotion/*` 锁成同一个精确版本（看 `package.json`）。加新包时用同一个版本号；新依赖必须可商用，并写进 `LICENSES.md`。
- 不改品牌参数，除非我明确要求。

## 画面硬规则

**确定性**
- 画面只由 `useCurrentFrame()` 算出来。不用 `Math.random`（改用 remotion 的 `random(seed)`），不用 `Date`、`setTimeout`、`requestAnimationFrame`、`useFrame`、CSS transition 和 `@keyframes`，不在 state 里跨帧累积。粒子之类的模拟要能从帧号直接算出当前状态。
- 字体、图片等异步加载都包在 `delayRender` / `continueRender` 里；图片用 `<Img>`，视频用 `<OffthreadVideo>`，素材放 `public/` 用 `staticFile()` 引用；canvas 在 `useLayoutEffect` 里按帧号整帧重画。

**节奏**
- 第 0 帧就有画面和字，不能黑屏，也不要用静态封面当第 0 帧。
- 每 2–4 秒画面上有新变化，没有静止的空拍；每 10–15 秒一个转折。
- 一个场景只讲一件事。

**文字**
- 每屏最多 2 行，每行约 6 个词以内。每段字至少停 2.5 秒，并按每秒约 3 个词留够阅读时间。
- 全片统一 Sentence case；弯引号、正确的破折号；会变的数字用 `tabular-nums`。
- 字幕和屏幕标题不重复同一句话：屏幕标题写关键词或结论，字幕跟旁白走。
- 所有屏幕文字和旁白都过拼写检查。

**安全区**
- 横屏：四边各留至少 5%。
- 竖屏：避开顶部约 15%、底部约 20%、右侧约 12%（平台的互动按钮）。

**动作和构图**
- 动作用 `spring()` 或带 Easing 的 `interpolate()`，不用匀速；`interpolate` 一律加 clamp。
- 转场从画面内容里长出来（比如一条线变成下一个场景的地平线），可以用 `@remotion/transitions` 的 TransitionSeries 自己写转场。不用通用淡入淡出，也不硬切。
- 镜头跟着内容推、拉、跟随，主体要够大；每个画面有前景、中景、背景。
- 同一个元素在每个场景里样子一致。

**禁止**：居中大字加渐变背景的默认画面；所有元素一起淡入；满屏小字；光晕过曝发白；半透明层叠得发灰；角落里多余的标签和边框；Remotion 模板自带的样式；任何看起来像模板的东西。

## 声音

- 旁白用 ElevenLabs。key 在 `.env` 的 `ELEVENLABS_API_KEY`，音色在 `ELEVENLABS_VOICE_ID`。**不要打印、提交 key，也不要把它写进任何文件。**
- 旁白要写成好读的样子：数字和单位写成读法（“about half a liter”），屏幕上再写 “0.5 L”。
- BGM 可选，放 `public/music/`，音量用 `bgmVolume`，授权写进 `LICENSES.md`。
- 音效可选：CC0 素材、代码合成，或 ElevenLabs 音效生成（确认套餐允许商用）。音效放在动作发生的那一帧。
- 成片响度目标：整体约 -14 LUFS，真峰值不超过 -1 dBTP。用 pyloudnorm 或 ffmpeg 的 loudnorm 测出数值，测不出来不算通过。
- 你听不到声音：把波形和响度曲线画成图检查，确认没有爆音、没有意外的空白、音效落在对应帧上。

## 事实和授权

- 旁白和屏幕上的每条事实，都在 `SOURCES.md` 里写一行：主张、出处链接、原文摘录。找不到可靠出处的不上屏、不进旁白，写进 `NOTES.md`。宁可不写，不要猜。
- 第三方的一切（字体、音乐、音效、图标、图片、数据、代码库）都写进 `LICENSES.md`：名称、来源 URL、许可证、用在哪。
- 写实的人物、产品照片不要用代码硬画。告诉我要准备什么素材、需要什么授权（肖像、照片版权、商标）。

## 每集流程（每个“停”都等我确认再往下）

1. 读单集简报。只问简报没写、又不能从本文件推出来的问题，一次问完；每个问题给 2–3 个选项并标出推荐。我没回答的用推荐项，但事实不许自己编。
2. 查事实，写 `SOURCES.md`。
3. 写 `script.json` 草稿，并给我一张分镜表：段 id｜场景｜旁白｜屏幕文字｜画面和动作｜预计秒数｜转到下一段的方式。如果要新增场景或图解，说明为什么现有的不够。**停。**
4. 跑 `npm run voice`。做新组件时，每做完一个先渲 3 张 still 自查。
5. 质检（见下）。
6. 渲一段 15 秒样片（30 fps 时 `--frames=0-449`）。**停。**
7. `npm run render -- <slug>` 出全片，交付。

## 质检

先做客观检查，全部通过再打分：

- `npm run typecheck` 通过。
- 横竖两版各取 9 个关键时刻的 still，拼成一张总览图；再缩到 360 像素宽，确认每屏字都读得清。
- 叠上安全区框看一遍，没有字越界。
- 屏幕文字和旁白过拼写检查；抽查 3 处字幕和旁白是否同步。
- 音频波形图和响度数值符合上面的目标。
- 用了 WebGL 或着色器的话，加 `--gl=angle` 渲一帧，确认不是一片黑或空白。

然后站在严格的动效导演角度，给六项各打 1–10 分：前 2 秒抓不抓人、手机尺寸看不看得清、动作自不自然、画面变化够不够、构图、声画是否对得上。另外单独评英文文案的拼写、语法和语气。列出最严重的 3 个问题和时间点（秒和帧号），改完重新出图和分数，直到每项都在 8 分以上。别替自己说好话，打分要附上依据。

## 渲染

- 用 `npm run render -- <slug>`。不手动分段渲染。
- 先渲 1 秒测每帧耗时，估算整片时间，再决定粒子数和 `--concurrency`。
- 封面单独渲一张 still，不依赖第 0 帧。YouTube 上传自定义缩略图；TikTok 发布时选封面或上传图片。

## 交付

- `out/<slug>/`：横竖两版 mp4、两张封面、关键帧总览图。
- `episodes/<slug>/`：`script.json`、`voiceover.json`、`SOURCES.md`、`NOTES.md`。
- 更新后的 `LICENSES.md`。
- 一段简短说明：这一集新增了什么组件或能力、做了哪些关键决定、还有什么没把握。

## 易错点

- `<Sequence>` 里的 `useCurrentFrame()` 是相对这个 Sequence 开头算的，算全局时间要换算。
- TransitionSeries 的转场会和前后场景重叠，总时长会变短；改了转场要确认时间轴计算也跟着改。
- 在变形、缩放的容器里切换文字，新旧文字各放进自己的 Sequence，各有进出场，不然会叠在一起。
- `@remotion/*` 版本不一致会出很怪的错。
- 发光：亮部复制一层，缩小、模糊，再用 screen 模式叠回去，控制强度。CSS 的大半径 blur、box-shadow、backdrop-filter 很慢，能缩小了再模糊就缩小。

## 系列视觉语言（2026-10-28 定）

- 基调：低多边形 3D 小场景。每集一个小舞台（一顶帐篷、一个睡袋、一块营地），放在一小块圆形地面上，细节全花在和这一集现象有关的东西上，不铺无关道具。
- 一镜到底：整集共用一块 3D 画布，镜头推、拉、绕、穿过物体来转场，不切不淡入淡出。
- 两种看法：普通视角讲“发生了什么”和“怎么做”；**Lab View** 讲“为什么”：热成像色阶（暖是橙、冷是冰蓝），其余压暗，水汽、热量这些看不见的东西做成会发光的粒子或线。从普通视角切到 Lab View 用一道扫描线扫过。
- 屏幕标题贴左上安全区，不做居中大字卡；读数和标注贴在 3D 物体旁边，跟着物体走。
- 屏幕上不写具体温度，冷暖用颜色和一条“Dew point”之类的参考线表示。

## 新增画面时的技术选择

只在新增场景、图解或舞台镜头时参考；不要因为某一集换一套视觉语言。

- 原理图、剖面图、流程：React + SVG，`spring()` / `interpolate()`；画线用 `@remotion/paths`；文字尺寸用 `@remotion/layout-utils` 量好再排。
- 水汽、水珠、热量这类大量粒子：组件里放 `<canvas>`，按帧号整帧重画；随机性用 `random(seed)` 或 `@remotion/noise`。
- 公式：简单的用 KaTeX 排版、SVG 做动画。
- 3D 舞台：`@remotion/three`，相机和物体位置从帧号算（镜头函数输入进度 p），不用 `useFrame`；每帧要变的东西在 `useLayoutEffect` 里改，赶在画布出图之前。随机用 `random(seed)`。
- 水、光、流体质感：WebGL 着色器，渲染加 `--gl=angle`，会慢。
- 已有的 Lottie：`@remotion/lottie`，先确认文件可以商用。
