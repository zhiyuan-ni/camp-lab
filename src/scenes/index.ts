import type React from "react";
import type { SceneType } from "../lib/schema";
import { Checklist } from "./Checklist";
import { Comparison } from "./Comparison";
import { Diagram } from "./Diagram";
import { Intro } from "./Intro";
import { Outro } from "./Outro";
import { Stat } from "./Stat";
import { TitleCard } from "./TitleCard";
import type { SceneProps } from "./types";

/** 场景注册表：script.json 里的 "scene" 字段对应这里的 key */
export const scenes: { [K in SceneType]: React.FC<SceneProps<K>> } = {
  intro: Intro,
  title: TitleCard,
  diagram: Diagram,
  comparison: Comparison,
  checklist: Checklist,
  stat: Stat,
  outro: Outro,
};
