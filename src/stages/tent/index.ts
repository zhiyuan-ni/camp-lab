import { defineStage } from "../types";
import { Overlay } from "./Overlay";
import { fallback, shots } from "./shots";
import { World } from "./World";

/** 帐篷舞台：一顶双层帐、一个睡着的人、一小块草地，天色从深夜到清晨可调 */
export const tentStage = defineStage({ World, Overlay, shots, fallback });
