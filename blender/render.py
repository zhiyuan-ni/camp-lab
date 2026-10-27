"""Render CAMP LAB 3D shots with Cycles.

  python blender/render.py --shot wide --res 960x540 --samples 32 --t 0 --out out/3d/wide.png
  blender -b --python blender/render.py -- --shot push --res 1920x1080 --samples 128 --from 0 --to 7 --gpu --out out/3d/push/
"""
import argparse
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402

import campsite  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument("--shot", default="wide", choices=["wide", "push", "cut"])
ap.add_argument("--res", default="1920x1080")
ap.add_argument("--samples", type=int, default=64)
ap.add_argument("--t", type=float, default=0.0, help="time in seconds for a single still")
ap.add_argument("--from", dest="t0", type=float)
ap.add_argument("--to", dest="t1", type=float)
ap.add_argument("--fps", type=int, default=30)
ap.add_argument("--gpu", action="store_true")
ap.add_argument("--save-blend", help="also save the built scene as a .blend for inspection")
ap.add_argument("--out", required=True)
a = ap.parse_args(argv)

w, h = map(int, a.res.split("x"))
campsite.build()
campsite.setup_render((w, h), a.samples, "GPU" if a.gpu else "CPU")
if a.save_blend:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(a.save_blend))

times = [a.t] if a.t0 is None else [a.t0 + i / a.fps for i in range(round((a.t1 - a.t0) * a.fps))]
single = a.t0 is None
os.makedirs(os.path.dirname(os.path.abspath(a.out)) if single else a.out, exist_ok=True)
for i, t in enumerate(times):
    st = time.time()
    campsite.pose(a.shot, t, w / h)
    bpy.context.view_layer.update()
    sc = bpy.context.scene
    sc.render.filepath = os.path.abspath(a.out if single else os.path.join(a.out, f"{i:05d}.png"))
    bpy.ops.render.render(write_still=True)
    print(f"frame {i + 1}/{len(times)} t={t:.2f}s {time.time() - st:.1f}s", flush=True)
