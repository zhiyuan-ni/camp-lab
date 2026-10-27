# CAMP LAB｜露营科学实验室 · 视频工作流

用 **Remotion**（React 写视频）+ **ElevenLabs**（AI 配音）半自动生产露营科普动画。
每期视频只需要写一个 `script.json`，配音、时间轴、字幕、横竖屏版本全部自动生成。

## 一次性准备

1. 安装 [Node.js 20+](https://nodejs.org/)（LTS 即可）
2. 在项目目录运行：
   ```bash
   npm install
   ```
3. 复制 `.env.example` 为 `.env`，填入 ElevenLabs 的 API Key 和中文音色的 Voice ID。
   `.env` 不会被提交到 Git。没有 Key 也能预览和渲染，只是没有声音。

## 每期视频的流程

| 步骤 | 你要做的 | 命令 |
|---|---|---|
| 1. 新建一期 | 起一个英文 slug 和标题 | `npm run new -- sleeping-bag-insulation "睡袋为什么能保暖？"` |
| 2. 写脚本 | 编辑 `episodes/<slug>/script.json`：每段写旁白、选场景、填画面文字 | — |
| 3. 生成配音 | 试听 `public/voiceover/<slug>/` 里的音频，不满意就改旁白再跑一次（只会重做改过的段落） | `npm run voice -- <slug>` |
| 4. 预览微调 | 浏览器里实时预览，改脚本或组件会热更新 | `npm run dev` |
| 5. 渲染成片 | 横屏 + 竖屏 + 封面，输出到 `out/<slug>/` | `npm run render -- <slug>` |

渲染选项：`--format 9x16` 只出竖屏，`--no-captions` 不烧录字幕。

## 脚本格式（episodes/&lt;slug&gt;/script.json）

```jsonc
{
  "slug": "tent-condensation",      // 与文件夹同名
  "episode": 1,                     // 期数，显示为 EP.01
  "title": "帐篷里为什么会“下雨”？",
  "subtitle": "结露原理与防治",
  "voiceId": "（可选，覆盖默认音色）",
  "bgm": "music/calm.mp3",          // 可选，放在 public/music/
  "segments": [
    { "id": "s01", "scene": "intro", "narration": "旁白……", "props": { "hook": "抛出的问题" } }
  ]
}
```

每个 segment 的时长 = 配音时长 + 0.3 秒开头留白 + 0.5 秒结尾停顿（可用 `padAfter` 调整）。
没有配音时按每秒 4.2 个字估算。

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

`tone` 可选 `good` / `bad` / `neutral`。

### 图解

`diagram` 字段引用 `src/diagrams/index.ts` 里注册的图：

- `flow`：通用流程图，任何主题都能用，`steps` 就是流程节点。
- `condensation`：帐篷结露剖面图（示例专属图）。

新主题需要专属原理图（比如睡袋蓬松层、营地布局俯视图）时，参考 `src/diagrams/Condensation.tsx` 写一个 SVG 组件并注册即可。
组件会拿到 `progress`（旁白进度 0→1）和 `activeStep`，用来让画面跟着讲解走。

## 目录结构

```
episodes/
  _template/script.json        新建一期时复制的模板
  tent-condensation/
    script.json                ← 每期唯一需要编辑的内容源
    voiceover.json             ← npm run voice 自动生成（时长 + 字符时间戳）
public/
  voiceover/<slug>/*.mp3       ← 自动生成的配音
  music/                       背景音乐
src/
  brand.ts                     品牌色、字体、输出尺寸（改这里全局换肤）
  Root.tsx                     自动为每期注册横竖两个合成
  Episode.tsx                  按时间轴拼接场景 + 配音 + 字幕
  scenes/                      可复用场景组件
  diagrams/                    原理图解组件
  components/                  背景、Logo、字幕等
  lib/                         脚本 schema、时间轴与字幕计算、动画工具
scripts/
  new-episode.ts  voiceover.ts  render.ts  sync-episodes.ts
```

## 小贴士

- **ElevenLabs 音色**：在 Voice Library 里筛选 Chinese，选好后复制 Voice ID。模型默认 `eleven_multilingual_v2`。
- **省额度**：`npm run voice` 按旁白文本哈希缓存，只重新生成改过的段落；`--force` 强制全部重做。
- **字体**：默认用系统中文字体（Windows 上是微软雅黑）。想要统一字体，可安装思源黑体 / Noto Sans SC。
- **数字和多音字**：ElevenLabs 读中文数字偶尔不准，旁白里可以直接写汉字（“半升到一升”而不是“0.5~1L”），画面上再用数字。
