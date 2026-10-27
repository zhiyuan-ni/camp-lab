import { Condensation } from "./Condensation";
import { Flow } from "./Flow";
import type { DiagramDef } from "./types";

/**
 * 图解注册表。新主题需要专属原理图时：
 * 1. 在本目录新建组件（参考 Condensation.tsx）
 * 2. 在这里注册一个名字
 * 3. 在 script.json 里用 "diagram": "<名字>" 引用
 */
export const diagrams: Record<string, DiagramDef> = {
  condensation: { component: Condensation },
  flow: { component: Flow, ownsSteps: true },
};
