import * as THREE from "three";
import type { CameraPose, Vec3 } from "./types";

/** 竖屏时把横屏的竖直视角换算成更高的视角，左右少看一点、上下多看一点 */
export const fitFov = (fov: number, aspect: number) => {
  if (aspect >= 1) return fov;
  const rad = THREE.MathUtils.degToRad;
  // 广角近景（帐篷里）收得多一点，免得竖屏上下拉得太变形；远景少收一点，主体不出框
  const keep = fov > 45 ? 0.62 : 0.82;
  const hfov = 2 * Math.atan(Math.tan(rad(fov) / 2) * (16 / 9)) * keep;
  return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov / 2) / aspect));
};

/** 把相机摆到 pose（CameraRig 和 2D 标注共用，保证两边算出来的是同一个相机） */
export const applyPose = (camera: THREE.PerspectiveCamera, pose: CameraPose, width: number, height: number) => {
  camera.position.set(...pose.pos);
  camera.lookAt(...pose.look);
  camera.aspect = width / height;
  camera.fov = fitFov(pose.fov, camera.aspect);
  camera.near = pose.near ?? 0.02;
  camera.far = 400;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
};

const scratch = new THREE.PerspectiveCamera();
/** 3D 点在画面上的像素坐标；behind = 在相机背后 */
export const projectPoint = (pose: CameraPose, p: Vec3, width: number, height: number) => {
  applyPose(scratch, pose, width, height);
  const v = new THREE.Vector3(...p).project(scratch);
  return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height, behind: v.z > 1 };
};
