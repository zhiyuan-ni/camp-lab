# Blender scenes (Cycles)

3D shots for CAMP LAB are built entirely from Python, so a scene is reproducible on any machine and reviewable in git.

- `campsite.py` builds the 15 × 15 m lakeside campsite block (`build()`) and sets every animated value from a shot name and a time in seconds (`pose()`).
- `render.py` renders a still or a frame range.

## Render on the Windows PC (GPU)

```
blender -b --python blender/render.py -- --shot wide --res 1920x1080 --samples 128 --gpu --out out/3d/wide.png
blender -b --python blender/render.py -- --shot push --from 0 --to 7 --res 1920x1080 --samples 128 --gpu --out out/3d/push/
```

`--gpu` picks OptiX and falls back to CUDA. Add `--save-blend out/3d/campsite.blend` to open the built scene in Blender.

## Preview in the cloud (CPU)

Blender's own download is blocked there, so use the `bpy` wheel (Python 3.13):

```
python3 -m venv .bpy && .bpy/bin/pip install bpy==5.2.3
.bpy/bin/python blender/render.py --shot cut --t 2 --res 960x540 --samples 16 --out out/3d/cut.png
```

Shots: `wide` (slow orbit of the whole block), `push` (wide → tent, then the tent is sliced open), `cut` (the open tent: breath vapour and condensation on the fly).
