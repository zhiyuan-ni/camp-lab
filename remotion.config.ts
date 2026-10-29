import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setConcurrency(null);

// 可选：指定本机已安装的 Chrome，例如离线环境
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}

// 3D 舞台用 WebGL：本机有显卡用 angle；云端没有显卡时设 REMOTION_GL=swangle
Config.setChromiumOpenGlRenderer((process.env.REMOTION_GL as "angle" | "swangle" | "egl" | "swiftshader" | "vulkan" | undefined) ?? "angle");
