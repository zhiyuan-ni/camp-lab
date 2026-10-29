# CAMP LAB｜露营科学实验室 · 视频工作流

用 **Remotion**（React 写视频）+ **ElevenLabs**（AI 配音）半自动生产露营科普动画。
面向海外 TikTok / YouTube：屏幕文字和旁白全部英文，屏幕上只出现品牌名 CAMP LAB。
系列规则写在根目录 [`CLAUDE.md`](CLAUDE.md)（Claude Code 每次开会话自动读取）；每集简报模板在 [`prompts/episode-brief.md`](prompts/episode-brief.md)。
每期视频只需要写一个 `script.json`，配音、时间轴、字幕、横竖屏版本全部自动生成。

## 一次性准备

1. 安装 [Node.js 20+](https://nodejs.org/)（LTS 即可）
2. 在项目目录运行：
   ```bash
   npm install
   ```
3. 复制 `.env.example` 为 `.env`，填入 ElevenLabs 的 API Key（音色默认 `VU16byTywsWv5JpI8rbc`）。
   `.env` 不会被提交到 Git。没有 Key 也能预览和渲染，只是没有声音。

## 每期视频的流程

| 步骤 | 你要做的 | 命令 |
|---|---|---|
| 1. 新建一期 | 起一个英文 slug 和标题，同时生成 `SOURCES.md`、`NOTES.md` | `npm run new -- sleeping-bag-insulation "How do sleeping bags keep you warm?"` |
| 2. 写脚本 | 编辑 `episodes/<slug>/script.json`：每段写旁白、选场景、填画面文字 | — |
| 3. 生成配音 | 试听 `public/voiceover/<slug>/` 里的音频，不满意就改旁白再跑一次（只会重做改过的段落） | `npm run voice -- <slug>` |
| 4. 预览微调 | 浏览器里实时预览，改脚本或组件会热更新 | `npm run dev` |
| 5. 渲染成片 | 横屏 + 竖屏 + 封面，自动响度标准化（-14 LUFS / -1 dBTP），并生成关键帧总览图，输出到 `out/<slug>/` | `npm run render -- <slug>` |

渲染选项：`--format 9x16` 只出竖屏，`--no-captions` 不烧录字幕，`--no-sheet` 不出总览图。

其他工具：
- `npm run sheet -- <slug>`：只生成关键帧总览图。横竖各 9 帧，叠加安全区，竖屏每格缩到 360px 宽，用来检查手机上字是否读得清、有没有越界。
- `npm run loudness -- out/<slug>/<file>.mp4 [--fix]`：测量响度，`--fix` 时超出目标就标准化。
- 安全区自查：`npm run dev` 打开 Studio，在右侧 Props 面板勾选 `showSafeZone`。竖屏避开顶部 15%、底部 20%、右侧 12%。

## 脚本格式（episodes/&lt;slug&gt;/script.json）

```jsonc
{
  "slug": "tent-condensation",      // 与文件夹同名
  "episode": 1,                     // 期数，显示为 EP.01
  "title": "Why is it raining inside my tent?",
  "subtitle": "The science of tent condensation",
  "voiceId": "（可选，覆盖默认音色）",
  "bgm": "music/calm.mp3",          // 可选，放在 public/music/
  "segments": [
    { "id": "s01", "scene": "intro", "narration": "You wake up, and…", "props": { "hook": "Did your tent leak?" } }
  ]
}
```

每个 segment 的时长 = 配音时长 + 0.3 秒开头留白 + 0.5 秒结尾停顿（可用 `padAfter` 调整）。
没有配音时按每秒 2.5 个英文单词（约 150 词/分钟）估算。字幕按词断行，每行不超过 6 个词。

### 可用场景

| scene | 用途 | props |
|---|---|---|
| `intro` | 片头：品牌 + 期数 + 标题 | `hook?` |
| `title` | 章节标题卡 | `kicker?` `heading` `sub?` |
| `stat` | 大数字事实 | `value` `unit?` `label` `note?` |
| `diagram` | 原理图解，步骤随旁白依次高亮 | `diagram` `heading?` `steps[]` |
| `comparison` | 左右对比（竖屏上下排） | `heading?` `left{label,points[],tone}` `right{…}` |
| `checklist` | 要点清单，逐条打勾 | `heading` `items[]` |
| `outro` | 片尾 + 下期预告 | `cta?` `next?` |
| `stage` | 3D 舞台上的一个镜头（需要脚本顶层写 `"stage"`），这一段只放屏幕标题 | `shot` `heading?` `sub?` |

`tone` 可选 `good` / `bad` / `neutral`。

### 图解

`diagram` 字段引用 `src/diagrams/index.ts` 里注册的图：

- `flow`：通用流程图，任何主题都能用，`steps` 就是流程节点。
- `condensation`：帐篷结露剖面图（示例专属图）。

新主题需要专属原理图（比如睡袋蓬松层、营地布局俯视图）时，参考 `src/diagrams/Condensation.tsx` 写一个 SVG 组件并注册即可。
组件会拿到 `progress`（旁白进度 0→1）和 `activeStep`，用来让画面跟着讲解走。

### 3D 舞台

脚本顶层写 `"stage": "tent"` 后，整集共用一块 three.js 画布（`@remotion/three`），从第一帧到最后一帧不卸载，镜头一镜到底。
每个 `stage` 段的 `shot` 指向 `src/stages/<stage>/shots.ts` 里的一个镜头函数：输入本段进度 `p`（0→1），输出相机和整个舞台的状态（天色、水珠、粒子……）。
相邻镜头的首尾位置要对上，画面才连续。还没写的镜头名会先用舞台的 `fallback` 画面。

镜头里用 `ctx.cue("word")` 拿到旁白说到某个词的时刻（来自 ElevenLabs 字符时间戳），动作对词而不是写死秒数；
`headingAt` 也可以写一个词。改了旁白但镜头里引用的词没了，渲染会直接报错。

- `tent`：一顶双层帐篷、一个睡着的人、一小块圆形草地；天色从深夜到清晨可调。
  镜头：`hook`（清晨滴水特写）、`rewind`（倒带回夜里）、`source`（Lab View：呼出的水汽、量杯）、
  `coldfly`（外帐散热变冷、冷暖刻度条）、`dew`（钻进布面微观、露点线、水珠）、
  `worst`（无风、低洼水边、门拉上）、`fix`（开门开通风口、绷紧外帐、高处树下）、`payoff`（回到开头的特写）。

任何舞台都能用的部件：

- `src/stages/lab.ts`：Lab View。`labify(material, {color, alpha})` 让材质在扫描面以上换成热成像色，`thermal(t)` 是色阶，扫描线进出由 `labUniforms.uScanY` 控制。色值在 `brand.lab`。
- `src/stages/GlowPoints.tsx`：发光粒子（水汽、热量），位置每帧由帧号算出，不靠后期泛光。
- `src/stages/FlowLines.tsx`：沿曲线流动的虚线管（风的流线、散出去的热量）。
- `src/stages/project.ts`：把 3D 点投到画面上，给贴着物体走的标注用。

渲染 3D 时要加 `--gl=angle`（本机有显卡）或 `--gl=swangle`（云端没有显卡）。

## 目录结构

```
episodes/
  _template/script.json        新建一期时复制的模板
  tent-condensation/
    script.json                ← 每期唯一需要编辑的内容源
    SOURCES.md                 ← 每条事实的出处
    NOTES.md                   ← 还没把握的事，发布前要解决
    voiceover.json             ← npm run voice 自动生成（时长 + 字符时间戳）
public/
  voiceover/<slug>/*.mp3       ← 自动生成的配音
  music/                       背景音乐
  fonts/                       Inter 字体（OFL）
CLAUDE.md                      系列设定（给 Claude Code）
LICENSES.md                    第三方授权清单
prompts/                       单集简报、定风格用的提示词
src/
  brand.ts                     品牌色、字体、输出尺寸（改这里全局换肤）
  Root.tsx                     自动为每期注册横竖两个合成
  Episode.tsx                  按时间轴拼接场景 + 配音 + 字幕
  scenes/                      可复用场景组件
  diagrams/                    原理图解组件
  stages/                      3D 舞台：世界、镜头、跟着 3D 的 2D 读数
  components/                  背景、Logo、字幕等
  lib/                         脚本 schema、时间轴与字幕计算、动画工具
scripts/
  new-episode.ts  voiceover.ts  render.ts  sync-episodes.ts  loudness.ts  contact-sheet.ts
```

## 小贴士

- **ElevenLabs 音色**：默认 `VU16byTywsWv5JpI8rbc`，模型 `eleven_multilingual_v2`。商用需要付费套餐，见 `LICENSES.md`。
- **省额度**：`npm run voice` 按旁白文本哈希缓存，只重新生成改过的段落；`--force` 强制全部重做。
- **字体**：Inter（SIL OFL 1.1），字体文件随仓库放在 `public/fonts/`，各平台渲染一致。
- **数字和单位**：旁白写成读法（“about half a liter”），屏幕上再写 “0.5 L”。
