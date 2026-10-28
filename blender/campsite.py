"""CAMP LAB diorama: a 15 x 15 m lakeside campsite block, built procedurally for Cycles.

Everything is created from code with a fixed seed, so the same script gives the same scene on any machine.
`build()` makes the scene; `pose(shot, t)` sets every animated value from the shot name and time in seconds.
"""
import math
import random

import bmesh
import bpy
from mathutils import Vector

rng = random.Random(12345)
R = rng.uniform

# ---------------------------------------------------------------- palette (linear-ish sRGB hex)
P = dict(
    grass=0x5FA04E, grass_dark=0x4A8442, grass_light=0x7CBF63, soil=0x8A5A3B, soil_mid=0x77492F, soil_dark=0x5E3C2A, bedrock=0x4E3628,
    rock=0x7C7F86, rock_dark=0x5D6068, rock_warm=0x9A8F80, sand=0xD8C08A, water=0x2F86C0,
    wood=0x9A6A43, wood_dark=0x6E4A2E, wood_cut=0xD9B07A, pine=0x2F6B4A, pine_dark=0x245840, pine_mid=0x356F4C,
    leaf=0x77B255, leaf2=0x6AA84F, leaf3=0x8CC063,
    fly=0xF06A35, inner=0xF7E6C4, floor=0x3D4A5C, bag=0x3B6FD6, skin=0xF1C29A, hair=0x3A2A22, white=0xF4F1EA,
    metal=0x2B2B2B, teal=0x2F7D8C, mustard=0xE0A42C, red=0xD94A3A, blue=0x2F74C0, purple=0x8A5CC2, mug=0xE84A5F,
    section=0xFFE7C2,
)


def srgb(hexv, a=1.0):
    def ch(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (ch(hexv >> 16 & 255), ch(hexv >> 8 & 255), ch(hexv & 255), a)


# ---------------------------------------------------------------- materials
_mats = {}


def mat(name, hexv, rough=0.75, emit=0.0, emit_hex=None, transmission=0.0, ior=1.45, alpha=1.0, metallic=0.0):
    key = (name, hexv, rough, emit, emit_hex, transmission, alpha)
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = srgb(hexv)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metallic
    if emit:
        bsdf.inputs["Emission Color"].default_value = srgb(emit_hex or hexv)
        bsdf.inputs["Emission Strength"].default_value = emit
    if transmission:
        bsdf.inputs["Transmission Weight"].default_value = transmission
        bsdf.inputs["IOR"].default_value = ior
    if alpha < 1:
        bsdf.inputs["Alpha"].default_value = alpha
    _mats[key] = m
    return m


def water_mat():
    """Stylised lake water: a tinted, slightly glowing glass so it stays readable at night."""
    m = bpy.data.materials.new("water")
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = srgb(0x3E9AD6)
    bsdf.inputs["Roughness"].default_value = 0.08
    bsdf.inputs["Transmission Weight"].default_value = 0.55
    bsdf.inputs["IOR"].default_value = 1.333
    bsdf.inputs["Emission Color"].default_value = srgb(0x2F86C0)
    bsdf.inputs["Emission Strength"].default_value = 0.12
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 1.6
    noise.inputs["Detail"].default_value = 3
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.06
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def vapor_mat(density=6.0, falloff=False):
    m = bpy.data.materials.new("vapor")
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != "OUTPUT_MATERIAL":
            nt.nodes.remove(n)
    out = nt.nodes.get("Material Output")
    vol = nt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = srgb(0xE8F6FF)
    vol.inputs["Emission Color"].default_value = srgb(0xBFE8FF)
    vol.inputs["Emission Strength"].default_value = 0.08
    tex = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 3.0
    noise.inputs["Detail"].default_value = 4
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.45
    ramp.color_ramp.elements[1].position = 0.75
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    mul.inputs[1].default_value = density
    nt.links.new(tex.outputs["Object"], noise.inputs["Vector"])
    nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    if falloff:
        # fade to nothing toward the edge of the object's bounding sphere, so the volume reads as a wisp, not a ball
        grad = nt.nodes.new("ShaderNodeTexGradient")
        grad.gradient_type = "SPHERICAL"
        nt.links.new(tex.outputs["Object"], grad.inputs["Vector"])
        fm = nt.nodes.new("ShaderNodeMath")
        fm.operation = "MULTIPLY"
        nt.links.new(ramp.outputs["Color"], fm.inputs[0])
        nt.links.new(grad.outputs["Fac"], fm.inputs[1])
        nt.links.new(fm.outputs[0], mul.inputs[0])
    else:
        nt.links.new(ramp.outputs["Color"], mul.inputs[0])
    nt.links.new(mul.outputs[0], vol.inputs["Density"])
    nt.links.new(vol.outputs[0], out.inputs["Volume"])
    m["noise"] = noise.name
    return m


# ---------------------------------------------------------------- mesh helpers
COL = None


def link(obj):
    COL.objects.link(obj)
    return obj


def from_bm(name, bm, material, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), bevel=0.0, segs=2, smooth=False, parent=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    me.materials.append(material)
    ob = link(bpy.data.objects.new(name, me))
    ob.location, ob.rotation_euler, ob.scale = loc, rot, scale
    if bevel:
        mod = ob.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segs
        mod.limit_method = "ANGLE"
        mod.harden_normals = False
    if parent:
        ob.parent = parent
    return ob


def instance(src, name, loc, rot=(0, 0, 0), scale=(1, 1, 1), parent=None):
    ob = link(bpy.data.objects.new(name, src.data))
    ob.location, ob.rotation_euler, ob.scale = loc, rot, scale
    for m in src.modifiers:
        if m.type == "BEVEL":
            b = ob.modifiers.new("bevel", "BEVEL")
            b.width, b.segments, b.limit_method = m.width, m.segments, m.limit_method
    if parent:
        ob.parent = parent
    return ob


def box(name, sx, sy, sz, material, loc, rot=(0, 0, 0), bevel=0.02, parent=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    return from_bm(name, bm, material, loc, rot, bevel=bevel, parent=parent)


def cyl(name, r1, r2, depth, material, loc, rot=(0, 0, 0), segs=8, bevel=0.0, smooth=False, parent=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r1, radius2=r2, depth=depth)
    return from_bm(name, bm, material, loc, rot, bevel=bevel, smooth=smooth, parent=parent)


def ico(name, r, material, loc, subdiv=1, scale=(1, 1, 1), rot=(0, 0, 0), smooth=False, parent=None):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=r)
    return from_bm(name, bm, material, loc, rot, scale, smooth=smooth, parent=parent)


def uvsphere(name, r, material, loc, scale=(1, 1, 1), rot=(0, 0, 0), segs=16, rings=10, smooth=True, parent=None):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=r)
    return from_bm(name, bm, material, loc, rot, scale, smooth=smooth, parent=parent)


def prism(name, pts, z0, z1, material, bevel=0.0, segs=2):
    """Vertical prism from a 2D outline (x, y), counter-clockwise."""
    bm = bmesh.new()
    bot = [bm.verts.new((x, y, z0)) for x, y in pts]
    top = [bm.verts.new((x, y, z1)) for x, y in pts]
    caps = [bm.faces.new(list(reversed(bot))), bm.faces.new(top)]
    # outlines can be concave (the shoreline); ear-clip the caps so renderers don't guess
    bmesh.ops.triangulate(bm, faces=caps, quad_method="BEAUTY", ngon_method="EAR_CLIP")
    n = len(pts)
    for i in range(n):
        bm.faces.new((bot[i], bot[(i + 1) % n], top[(i + 1) % n], top[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return from_bm(name, bm, material, bevel=bevel, segs=segs)


def extrude_profile(name, prof, length, material, parent=None, bevel=0.0):
    """Closed 2D profile in (y, z), extruded along local x and centred."""
    bm = bmesh.new()
    a = [bm.verts.new((-length / 2, y, z)) for y, z in prof]
    b = [bm.verts.new((length / 2, y, z)) for y, z in prof]
    bm.faces.new(list(reversed(a)))
    bm.faces.new(b)
    n = len(prof)
    for i in range(n):
        bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return from_bm(name, bm, material, parent=parent, bevel=bevel)


# ---------------------------------------------------------------- occupancy so props don't overlap
occ = []


def free(x, y, r):
    return all(math.hypot(o[0] - x, o[1] - y) > o[2] + r for o in occ)


def claim(x, y, r):
    occ.append((x, y, r))


# ---------------------------------------------------------------- the block
S = 7.5
# shoreline: lake sits in the front-right corner (+x, -y), which faces the default camera
SHORE = [(7.5, -0.4), (6.2, -0.7), (5.0, -1.5), (4.1, -2.7), (3.3, -4.1), (2.6, -5.6), (2.1, -7.5)]


def in_lake(x, y, pad=0.0):
    # point-in-polygon against the lake outline
    poly = SHORE + [(S, -S)]
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi:
            inside = not inside
        j = i
    if inside:
        return True
    return pad > 0 and any(math.hypot(x - sx, y - sy) < pad for sx, sy in SHORE)


def terrain():
    # land = square slab minus the lake corner (an exact boolean is more robust than a concave n-gon)
    sq = [(-S, -S), (S, -S), (S, S), (-S, S)]
    hole = prism("lake_cut", [(x + (0.6 if x >= S - 1e-6 else 0), y - (0.6 if y <= -S + 1e-6 else 0)) for x, y in list(reversed(list(SHORE) + [(S, -S)]))], -0.64, 1.0, mat("cut", P["section"]))
    hole.hide_render = True
    hole.display_type = "WIRE"
    for name, z0, z1, m, bev in [("grass", -0.35, 0.0, mat("grass", P["grass"], 0.9), 0.06), ("soil_top", -0.62, -0.35, mat("soil", P["soil"], 0.95), 0.03)]:
        ob = prism(name, sq, z0, z1, m)
        b = ob.modifiers.new("lake", "BOOLEAN")
        b.operation, b.object, b.solver = "DIFFERENCE", hole, "EXACT"
        bev_mod = ob.modifiers.new("bevel", "BEVEL")
        bev_mod.width, bev_mod.segments, bev_mod.limit_method = bev, 3, "ANGLE"
    lake = list(SHORE) + [(S, -S)]
    lake = list(reversed(lake))  # CCW
    prism("lake_bed", lake, -0.66, -0.6, mat("lake_bed", 0x3F8F86, 0.95))
    w = prism("water", lake, -0.6, -0.04, water_mat())
    w.visible_shadow = False
    sq = [(-S, -S), (S, -S), (S, S), (-S, S)]
    prism("soil_mid", sq, -1.35, -0.66, mat("soil_mid", P["soil_mid"], 0.95), bevel=0.03)
    prism("soil_dark", sq, -2.25, -1.35, mat("soil_dark", P["soil_dark"], 0.95), bevel=0.03)
    prism("bedrock", sq, -2.65, -2.25, mat("bedrock", P["bedrock"], 0.95), bevel=0.05)
    # pebbles and roots poking out of the two camera-facing sides
    pebble_mats = [mat("rock", P["rock"]), mat("rock_dark", P["rock_dark"]), mat("rock_warm", P["rock_warm"])]
    for i in range(90):
        t = R(-S + 0.3, S - 0.3)
        z = R(-2.5, -0.75)
        side = rng.random() < 0.5
        x, y = (t, -S - 0.02) if side else (S + 0.02, t)
        if in_lake(x - 0.1 if not side else x, y + 0.1 if side else y) and z > -0.66:
            continue
        r = R(0.07, 0.2)
        ico(f"pebble{i}", r, rng.choice(pebble_mats), (x, y, z), subdiv=1, scale=(R(0.8, 1.3), R(0.8, 1.3), R(0.6, 1.0)))
    # a sloped sand bank along the shoreline, from just above the grass down under the water
    sand = mat("sand", P["sand"], 0.95)
    bm = bmesh.new()
    rows = []
    for k, (x, y) in enumerate(SHORE):
        a = SHORE[max(k - 1, 0)]
        b = SHORE[min(k + 1, len(SHORE) - 1)]
        d = Vector((b[0] - a[0], b[1] - a[1], 0)).normalized()
        n = Vector((-d.y, d.x, 0))  # points into the lake
        p = Vector((x, y, 0))
        rows.append([bm.verts.new(p - n * 0.28 + Vector((0, 0, 0.015))), bm.verts.new(p + n * 0.15 + Vector((0, 0, -0.02))), bm.verts.new(p + n * 0.55 + Vector((0, 0, -0.3)))])
    for k in range(len(rows) - 1):
        for r in range(2):
            bm.faces.new((rows[k][r], rows[k + 1][r], rows[k + 1][r + 1], rows[k][r + 1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if bm.faces[0].normal.z < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    from_bm("sand_bank", bm, sand, smooth=False)
    stones = [mat("rock", P["rock"]), mat("rock_warm", P["rock_warm"]), sand]
    for k in range(len(SHORE) - 1):
        (x0, y0), (x1, y1) = SHORE[k], SHORE[k + 1]
        for _ in range(3):
            t = rng.random()
            ico("shore_stone", R(0.07, 0.15), rng.choice(stones), (x0 + (x1 - x0) * t + R(-0.05, 0.15), y0 + (y1 - y0) * t - R(-0.05, 0.15), 0.0), subdiv=1, scale=(1.2, 1, 0.6))


# ---------------------------------------------------------------- props
def pine(x, y, s=1.0):
    root = link(bpy.data.objects.new("pine", None))
    root.location = (x, y, 0)
    root.rotation_euler = (0, 0, R(0, 6.28))
    cyl("trunk", 0.09 * s, 0.13 * s, 0.6 * s, mat("wood_dark", P["wood_dark"]), (0, 0, 0.3 * s), segs=6, parent=root)
    col = rng.choice([P["pine"], P["pine_dark"], P["pine_mid"]])
    m = mat(f"pine{col}", col, 0.85)
    for i in range(4):
        r, h = (0.95 - i * 0.2) * s, (0.95 - i * 0.1) * s
        c = cyl("tier", r, 0.0, h, m, (0, 0, (0.6 + i * 0.5) * s + h / 2 - 0.15 * s), rot=(0, 0, i * 0.5), segs=7, bevel=0.02 * s, parent=root)
    claim(x, y, 0.8 * s)


def round_tree(x, y, s=1.0):
    root = link(bpy.data.objects.new("tree", None))
    root.location = (x, y, 0)
    cyl("trunk", 0.08 * s, 0.14 * s, 1.2 * s, mat("wood", P["wood"]), (0, 0, 0.6 * s), segs=6, parent=root)
    col = rng.choice([P["leaf"], P["leaf2"], P["leaf3"]])
    for i in range(5):
        ico("leaves", R(0.4, 0.6) * s, mat(f"leaf{col}", col, 0.85), (R(-0.35, 0.35) * s, R(-0.35, 0.35) * s, R(1.3, 1.9) * s), subdiv=1, parent=root)
    claim(x, y, 0.7 * s)


def rock(x, y, s=1.0):
    m = rng.choice([mat("rock", P["rock"]), mat("rock_dark", P["rock_dark"]), mat("rock_warm", P["rock_warm"])])
    ico("rock", 0.3 * s, m, (x, y, 0.06 * s), subdiv=1, scale=(R(0.9, 1.4), R(0.8, 1.3), R(0.5, 0.85)), rot=(R(0, 0.4), R(0, 0.4), R(0, 6)))
    claim(x, y, 0.32 * s)


def log(name, length, r, loc, rot, parent=None):
    lg = cyl(name, r, r, length, mat("wood", P["wood"]), loc, rot, segs=8, bevel=0.01, parent=parent)
    cut = mat("wood_cut", P["wood_cut"], 0.9)
    for sgn in (-1, 1):
        cyl("cap", r * 0.96, r * 0.96, 0.012, cut, (0, 0, sgn * length / 2), segs=8, parent=lg)
    return lg


def tent_and_sleeper():
    """A-frame tent: inner tent, fly with an open front, guy lines, sleeper. Returns parts for the cutaway."""
    root = link(bpy.data.objects.new("tent", None))
    root.location = (-1.7, 1.2, 0)
    root.rotation_euler = (0, 0, -math.pi / 2 + 0.35)
    claim(-1.7, 1.2, 1.8)
    TL, TW, TH = 2.5, 1.9, 1.35
    fly_m = mat("fly", P["fly"], 0.7)
    inner_m = mat("inner", P["inner"], 0.85)
    W2, H2 = TW / 2 + 0.32, TH + 0.1

    def lam(w, h, th):
        return [(-w, 0), (w, 0), (w - th, 0), (0, h - th * 1.3), (-w + th, 0)][::-1] and [(-w, 0), (-w + th, 0), (0, h - th * 1.3), (w - th, 0), (w, 0), (0, h)]

    fly = extrude_profile("fly", [(y, z + 0.12) for y, z in lam(W2, H2 - 0.12, 0.05)], TL + 0.45, fly_m, parent=root, bevel=0.01)
    back = extrude_profile("fly_back", [(-W2 + 0.06, 0.12), (W2 - 0.06, 0.12), (0, H2 - 0.04)], 0.03, fly_m, parent=root)
    back.location = (-(TL + 0.45) / 2 + 0.02, 0, 0)
    inner = extrude_profile("inner", lam(TW / 2 - 0.15, TH - 0.12, 0.03), TL - 0.2, inner_m, parent=root)
    inner.location.z = 0.02
    inner_back = extrude_profile("inner_back", [(-TW / 2 + 0.17, 0.02), (TW / 2 - 0.17, 0.02), (0, TH - 0.12)], 0.02, inner_m, parent=root)
    inner_back.location = (-(TL - 0.2) / 2, 0, 0)
    floor = box("floor", TL - 0.2, TW - 0.3, 0.02, mat("floor", P["floor"]), (0, 0, 0.02), bevel=0.0, parent=root)
    tape = box("ridge_tape", TL + 0.47, 0.09, 0.03, mat("tape", 0xFFD0A0), (0, 0, H2 + 0.0), bevel=0.0, parent=root)
    pole_m = mat("pole", P["metal"], 0.4, metallic=0.6)
    cyl("ridge_pole", 0.025, 0.025, TL + 0.6, pole_m, (0, 0, H2 + 0.04), rot=(0, math.pi / 2, 0), segs=8, parent=root)
    for sx in (-1, 1):
        cyl("pole", 0.025, 0.025, H2 + 0.05, pole_m, (sx * (TL / 2 + 0.2), 0, (H2 + 0.05) / 2), segs=8, parent=root)
    # guy lines (thin cylinders) and stakes
    line_m = mat("line", P["white"], 0.6)
    for sx in (-1, 1):
        for sy in (-1, 1):
            a = Vector((sx * (TL / 2 + 0.25), sy * (TW / 2 - 0.05), TH * 0.55))
            b = Vector((sx * (TL / 2 + 0.9), sy * (TW / 2 + 0.6), 0.02))
            d = b - a
            c = cyl("guy", 0.006, 0.006, d.length, line_m, (a + b) / 2, segs=4, parent=root)
            c.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
            cyl("stake", 0.012, 0.008, 0.14, mat("steel", 0xBBBBBB, 0.4, metallic=0.8), b, segs=5, parent=root)
    # sleeper
    box("pad", 1.9, 0.62, 0.04, mat("pad", 0x2E8B6E), (0, 0, 0.05), bevel=0.015, parent=root)
    bag = box("bag", 1.55, 0.5, 0.26, mat("bag", P["bag"], 0.6), (0.12, 0, 0.2), bevel=0.12, parent=root)
    bag.modifiers["bevel"].segments = 5
    bag.modifiers["bevel"].limit_method = "NONE"
    box("pillow", 0.3, 0.42, 0.1, mat("pillow", P["white"], 0.9), (-0.78, 0, 0.12), bevel=0.04, parent=root)
    uvsphere("head", 0.14, mat("skin", P["skin"], 0.6), (-0.7, 0, 0.27), parent=root)
    uvsphere("hair", 0.145, mat("hair", P["hair"], 0.8), (-0.79, 0, 0.29), scale=(0.7, 1, 0.95), parent=root)
    box("stuffsack", 0.35, 0.25, 0.25, mat("purple", P["purple"]), (0.85, -0.4, 0.15), bevel=0.06, parent=root)
    # warm light inside the tent
    lamp = bpy.data.lights.new("tent_lamp", "POINT")
    lamp.color = srgb(0xFFB066)[:3]
    # hung low on a cord so it sits ~0.3 m from the inner walls instead of burning a hot spot into them
    lamp.energy = 8
    lamp.shadow_soft_size = 0.3
    lo = link(bpy.data.objects.new("tent_lamp", lamp))
    lo.location = (0.45, 0, 0.72)
    lo.parent = root
    uvsphere("tent_bulb", 0.04, mat("bulb", 0xFFD59A, emit=4), (0.45, 0, 0.76), parent=root)
    cyl("lamp_cord", 0.004, 0.004, TH - 0.12 - 0.8, mat("wire", 0x1A1A1A, 0.5), (0.45, 0, (TH - 0.12 + 0.8) / 2), segs=4, parent=root)
    # condensation on the underside of the fly (far slope + ridge; the near slope gets cut away)
    drop_m = mat("drop", 0x9FDcff, 0.02, emit=0.15, emit_hex=0x58BFFF, transmission=0.9, ior=1.33)
    src = uvsphere("drop_src", 0.014, drop_m, (0, 0, -10), scale=(1, 1, 1.35), segs=10, rings=6, parent=root)
    drops = [src]
    for i in range(170):
        v = rng.random() ** 0.8 * 0.92 + 0.04
        x = R(-(TL + 0.4) / 2, (TL + 0.4) / 2)
        y = (W2 * (1 - v) - 0.065)  # +y side = far side once the tent is rotated (see cut normal)
        z = 0.12 + (H2 - 0.12) * v - 0.09
        s = R(0.5, 1.3)
        drops.append(instance(src, "drop", (x, y, z), scale=(s, s, s * 1.35), parent=root))
    falling = uvsphere("falling_drop", 0.022, drop_m, (0.3, 0.15, 1.0), scale=(1, 1, 1.6), parent=root)
    # breath: a volumetric plume rising from the sleeper's face toward the ridge
    plume = uvsphere("breath", 1.0, vapor_mat(density=8.0, falloff=True), (-0.35, 0.0, 0.75), scale=(0.75, 0.38, 0.55), rot=(0, -0.6, 0), segs=16, rings=10, parent=root)
    plume.visible_shadow = False
    cutters = [fly, back, inner, inner_back, floor, tape]
    return root, cutters, drops, falling, plume, dict(TL=TL, TW=TW, TH=TH)


def campfire():
    root = link(bpy.data.objects.new("fire", None))
    root.location = (1.0, -1.3, 0)
    claim(1.0, -1.3, 0.9)
    stones = [mat("rock", P["rock"]), mat("rock_dark", P["rock_dark"])]
    for i in range(10):
        a = i / 10 * math.tau
        ico("stone", 0.13, rng.choice(stones), (math.cos(a) * 0.5, math.sin(a) * 0.5, 0.06), subdiv=1, scale=(1.1, 1, 0.7), parent=root)
    for i in range(4):
        a = i * math.pi / 4 + 0.3
        log("firelog", 0.75, 0.06, (math.cos(a) * 0.05, math.sin(a) * 0.05, 0.12), (math.pi / 2 - 0.35, 0, a), parent=root)
    ash = cyl("embers_bed", 0.32, 0.3, 0.03, mat("embers", 0x3A1A10, 0.9, emit=3, emit_hex=0xFF5A1F), (0, 0, 0.02), segs=12, parent=root)
    flames = []
    for i, (col, h) in enumerate([(0xFF5A1F, 0.6), (0xFF8A2B, 0.5), (0xFFC845, 0.35), (0xFF7A25, 0.45), (0xFFB13B, 0.4)]):
        f = uvsphere("flame", 0.12, mat(f"flame{i}", col, 0.5, emit=18), (R(-0.1, 0.1), R(-0.1, 0.1), 0.2 + h * 0.4), scale=(1, 1, h / 0.12 * 0.5), segs=10, rings=8, parent=root)
        f.visible_shadow = False
        f["h"] = h
        flames.append(f)
    light = bpy.data.lights.new("fire_light", "POINT")
    light.color = srgb(0xFF8A3D)[:3]
    light.energy = 260
    light.shadow_soft_size = 0.25
    lo = link(bpy.data.objects.new("fire_light", light))
    lo.location = (0, 0, 0.6)
    lo.parent = root
    embers = []
    em = mat("ember", 0xFFB347, emit=25)
    for i in range(16):
        e = uvsphere("ember", 0.015, em, (0, 0, 0), segs=6, rings=4, parent=root)
        e.visible_shadow = False
        embers.append((e, rng.random(), R(-0.3, 0.3), R(-0.3, 0.3)))
    return root, flames, lo, embers


def chair(x, y, rz, col):
    root = link(bpy.data.objects.new("chair", None))
    root.location, root.rotation_euler = (x, y, 0), (0, 0, rz)
    claim(x, y, 0.45)
    frame = mat("frame", P["metal"], 0.45, metallic=0.5)
    fab = mat(f"fabric{col}", col, 0.8)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cyl("leg", 0.014, 0.014, 0.52, frame, (sx * 0.2, sy * 0.18, 0.22), rot=(sy * 0.35, sx * 0.1, 0), segs=6, parent=root)
    box("seat", 0.46, 0.4, 0.05, fab, (0, 0, 0.42), bevel=0.02, parent=root)
    box("back", 0.46, 0.04, 0.5, fab, (0, -0.21, 0.66), rot=(-0.25, 0, 0), bevel=0.02, parent=root)
    for sx in (-1, 1):
        box("arm", 0.04, 0.4, 0.03, frame, (sx * 0.25, 0, 0.56), bevel=0.01, parent=root)
    cyl("mug", 0.04, 0.035, 0.1, mat("mug", P["mug"], 0.5), (0.26, 0.12, 0.62), segs=12, bevel=0.005, parent=root)


def picnic_table():
    root = link(bpy.data.objects.new("table", None))
    root.location, root.rotation_euler = (-4.3, -2.2, 0), (0, 0, -0.35)
    claim(-4.3, -2.2, 1.3)
    wood, dark = mat("wood", P["wood"]), mat("wood_dark", P["wood_dark"])
    for k in range(5):
        box("top_plank", 1.6, 0.14, 0.05, wood if k % 2 else mat("wood_b", 0xA77450), (0, -0.3 + k * 0.15, 0.74), bevel=0.012, parent=root)
    for sy in (-1, 1):
        for k in range(2):
            box("bench_plank", 1.6, 0.12, 0.045, wood, (0, sy * (0.55 + k * 0.13), 0.44), bevel=0.012, parent=root)
    for sx in (-1, 1):
        for sy in (-1, 1):
            box("leg", 0.06, 0.06, 0.85, dark, (sx * 0.6, sy * 0.28, 0.38), rot=(sy * -0.55, 0, 0), bevel=0.01, parent=root)
    # lantern
    lt = link(bpy.data.objects.new("lantern", None))
    lt.location = (0.4, 0.05, 0.77)
    lt.parent = root
    cyl("base", 0.07, 0.08, 0.04, mat("frame", P["metal"], 0.45, metallic=0.5), (0, 0, 0.02), segs=12, parent=lt)
    cyl("glass", 0.06, 0.06, 0.16, mat("lantern_glow", 0xFFE2A0, 0.3, emit=12), (0, 0, 0.12), segs=12, parent=lt)
    cyl("hood", 0.08, 0.02, 0.07, mat("frame", P["metal"], 0.45, metallic=0.5), (0, 0, 0.235), segs=12, parent=lt)
    light = bpy.data.lights.new("lantern_light", "POINT")
    light.color = srgb(0xFFD08A)[:3]
    light.energy = 40
    light.shadow_soft_size = 0.06
    lo = link(bpy.data.objects.new("lantern_light", light))
    lo.location = (0, 0, 0.15)
    lo.parent = lt
    cyl("bottle", 0.045, 0.045, 0.2, mat("bottle", 0x3FA34D, 0.15, transmission=0.8), (-0.3, -0.1, 0.87), segs=12, parent=root)
    box("plate", 0.25, 0.25, 0.015, mat("plate", P["white"], 0.4), (-0.05, 0.12, 0.775), bevel=0.005, parent=root)


def small_props():
    # cooler
    c = box("cooler", 0.6, 0.38, 0.36, mat("cooler", P["blue"], 0.45), (-3.3, -3.5, 0.18), rot=(0, 0, 0.9), bevel=0.04)
    box("cooler_lid", 0.62, 0.4, 0.07, mat("cooler_lid", P["white"], 0.5), (0, 0, 0.2), bevel=0.025, parent=c)
    claim(-3.3, -3.5, 0.4)
    # backpack
    bp = box("pack", 0.36, 0.24, 0.55, mat("pack", 0xD8462F, 0.7), (-5.2, -1.6, 0.27), rot=(0.1, 0, 0.4), bevel=0.09)
    bp.modifiers["bevel"].limit_method = "NONE"
    bp.modifiers["bevel"].segments = 4
    box("pocket", 0.26, 0.08, 0.2, mat("pack_pocket", 0xB83A26, 0.7), (0, -0.14, -0.08), bevel=0.04, parent=bp)
    claim(-5.2, -1.6, 0.3)
    # woodpile
    for row in range(3):
        for i in range(4 - row):
            log("pile", 0.7, 0.07, (-4.6 + i * 0.16 + row * 0.08, 2.4, 0.07 + row * 0.125), (math.pi / 2, 0, 0))
    claim(-4.4, 2.4, 0.6)
    # stump and axe
    st = cyl("stump", 0.25, 0.3, 0.35, mat("wood", P["wood"]), (-3.4, 0.6, 0.17), segs=10, bevel=0.01)
    cyl("stump_top", 0.245, 0.245, 0.012, mat("wood_cut", P["wood_cut"], 0.9), (0, 0, 0.18), segs=10, parent=st)
    ax = cyl("axe_handle", 0.018, 0.02, 0.55, mat("handle", 0x8A5A3B), (0.05, 0, 0.42), rot=(0, 0.5, 0), segs=6, parent=st)
    box("axe_head", 0.16, 0.025, 0.09, mat("steel", 0xBBBBBB, 0.35, metallic=0.8), (0, 0, -0.25), bevel=0.005, parent=ax)
    claim(-3.4, 0.6, 0.4)
    # mushrooms
    for x, y in [(-5.6, 3.4), (-5.4, 3.6), (-2.8, 4.4), (5.0, 4.9)]:
        cyl("stem", 0.02, 0.025, 0.1, mat("white", P["white"]), (x, y, 0.05), segs=6)
        uvsphere("cap", 0.06, mat("cap", 0xD8432F, 0.6), (x, y, 0.1), scale=(1, 1, 0.6), segs=10, rings=6)


def dock_canoe_reeds():
    root = link(bpy.data.objects.new("dock", None))
    root.location, root.rotation_euler = (4.1, -2.7, 0), (0, 0, math.pi / 4)
    claim(4.1, -2.7, 0.6)
    for i in range(9):
        box("plank", 0.9, 0.2, 0.05, mat("wood", P["wood"]) if i % 2 else mat("wood_b", 0xA77450), (0, -0.3 - i * 0.24, 0.04), bevel=0.012, parent=root)
    for sx in (-1, 1):
        for k in range(3):
            cyl("post", 0.05, 0.05, 0.8, mat("wood_dark", P["wood_dark"]), (sx * 0.42, -0.4 - k * 0.85, -0.3), segs=8, bevel=0.01, parent=root)
    # canoe
    cn = link(bpy.data.objects.new("canoe", None))
    cn.location, cn.rotation_euler = (5.6, -5.4, 0.02), (0, 0, -0.9)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=10, radius=0.5)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z > 0.001], context="VERTS")
    hull = from_bm("hull", bm, mat("canoe", P["red"], 0.45), (0, 0, 0.12), scale=(3, 0.75, 0.6), smooth=True, parent=cn)
    sol = hull.modifiers.new("solid", "SOLIDIFY")
    sol.thickness = 0.03
    for x in (0.3, -0.4):
        box("seat", 0.08, 0.66, 0.03, mat("wood", P["wood"]), (x, 0, 0.08), bevel=0.005, parent=cn)
    box("paddle", 1.2, 0.07, 0.02, mat("wood_b", 0xA77450), (0, 0.1, 0.12), rot=(0, 0, 0.2), bevel=0.008, parent=cn)
    # reeds and lily pads
    reed = mat("reed", 0x6F8F3A, 0.8)
    for x, y in SHORE:
        if rng.random() < 0.25:
            continue
        for k in range(7):
            cyl("reed", 0.012, 0.004, R(0.35, 0.75), reed, (x + R(-0.3, 0.3), y + R(-0.3, 0.3), 0.15), rot=(R(-0.1, 0.1), R(-0.1, 0.1), 0), segs=4)
    pad = mat("lily", 0x4F9A52, 0.6)
    for i in range(12):
        x, y = R(3.5, 7.2), R(-7.2, -3.5)
        if not in_lake(x, y) or in_lake(x, y, 0) and any(math.hypot(x - sx, y - sy) < 0.6 for sx, sy in SHORE):
            continue
        cyl("lily", R(0.12, 0.2), R(0.12, 0.2), 0.012, pad, (x, y, -0.035), segs=10)
        if rng.random() < 0.4:
            ico("lotus", 0.045, mat("lotus", 0xFF9CC2, 0.6), (x, y, 0.0), subdiv=1)


def path_stones():
    m = mat("path", 0xB9B3A6, 0.9)
    for x, y in [(-1.4, -0.2), (-0.8, -0.65), (-0.1, -0.55), (1.9, -1.9), (2.6, -2.1), (3.3, -2.3)]:
        cyl("stone", R(0.16, 0.22), R(0.18, 0.24), 0.05, m, (x, y, 0.01), rot=(0, 0, R(0, 3)), segs=7, bevel=0.015)
        claim(x, y, 0.2)


def string_lights():
    a, b = Vector((-1.2, -0.16, 1.5)), Vector((3.3, 3.3, 1.9))
    cyl("light_pole", 0.04, 0.05, 2.0, mat("wood_dark", P["wood_dark"]), (3.3, 3.3, 1.0), segs=8)
    wire = mat("wire", 0x1A1A1A, 0.5)
    n = 16
    pts = []
    for i in range(n + 1):
        t = i / n
        p = a.lerp(b, t)
        p.z -= math.sin(t * math.pi) * 0.45
        pts.append(p)
    for i in range(n):
        d = pts[i + 1] - pts[i]
        c = cyl("wire", 0.006, 0.006, d.length, wire, (pts[i] + pts[i + 1]) / 2, segs=4)
        c.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    bulbs = []
    cols = [0xFFD27A, 0xFF9E7A, 0xA6E3FF]
    for i in range(1, n):
        col = cols[i % 3]
        bl = uvsphere("bulb", 0.035, mat(f"bulb{col}", col, 0.3, emit=5), pts[i] - Vector((0, 0, 0.05)), segs=8, rings=6)
        bl.visible_shadow = False
        bulbs.append(bl)
    return bulbs


def scatter():
    for x, y, s in [(-6.4, 6.3, 1.3), (-4.9, 6.6, 1.0), (-6.6, 4.6, 1.1), (-3.2, 6.4, 1.25), (-6.5, 2.4, 0.95), (-1.4, 6.5, 0.9), (-5.2, 4.9, 0.8),
                    (0.6, 6.4, 1.15), (-6.7, 0.0, 1.05), (2.6, 6.0, 0.85), (-6.4, -4.8, 1.2), (-5.0, -6.4, 0.9)]:
        pine(x, y, s)
    for x, y, s in [(4.6, 6.0, 1.1), (6.3, 4.4, 0.9), (-3.0, -6.2, 1.0), (6.5, 1.7, 0.8)]:
        round_tree(x, y, s)
    for x, y, s in [(3.6, 3.4, 1.6), (4.4, 2.9, 0.9), (-2.4, -4.6, 1.3), (-6.4, -2.6, 1.0), (1.3, -5.6, 1.1), (5.5, 3.0, 0.7), (-4.0, 3.8, 0.8), (6.8, 6.8, 1.0)]:
        rock(x, y, s)
    # grass tufts and flowers as linked duplicates of a few source meshes
    tuft_srcs = []
    for k, col in enumerate([P["grass_dark"], P["grass_light"], 0x7CBF63]):
        bm = bmesh.new()
        for j in range(5):
            h = R(0.18, 0.32)
            g = bmesh.ops.create_cone(bm, cap_ends=True, segments=4, radius1=0.03, radius2=0.0, depth=h)
            bmesh.ops.rotate(bm, verts=g["verts"], cent=(0, 0, 0), matrix=__import__("mathutils").Matrix.Rotation(R(-0.35, 0.35), 3, "X") @ __import__("mathutils").Matrix.Rotation(R(-0.35, 0.35), 3, "Y"))
            bmesh.ops.translate(bm, verts=g["verts"], vec=(R(-0.06, 0.06), R(-0.06, 0.06), h / 2))
        tuft_srcs.append(from_bm(f"tuft_src{k}", bm, mat(f"tuft{col}", col, 0.9), (0, 0, -20)))
    flower_srcs = []
    for k, col in enumerate([0xFFFFFF, 0xFFD23F, 0xFF7AA8, 0xB48CFF]):
        bm = bmesh.new()
        st = bmesh.ops.create_cone(bm, cap_ends=True, segments=4, radius1=0.008, radius2=0.008, depth=0.16)
        bmesh.ops.translate(bm, verts=st["verts"], vec=(0, 0, 0.08))
        stem = from_bm(f"flower_stem{k}", bm, mat("stem", 0x4F8A3C), (0, 0, -20))
        head = ico(f"flower_head{k}", 0.04, mat(f"petal{col}", col, 0.7), (0, 0, 0.17), subdiv=1, parent=stem)
        flower_srcs.append(stem)
    placed = 0
    for i in range(900):
        x, y = R(-S + 0.2, S - 0.2), R(-S + 0.2, S - 0.2)
        if in_lake(x, y, 0.45) or not free(x, y, 0.12):
            continue
        if rng.random() < 0.75:
            instance(rng.choice(tuft_srcs), "tuft", (x, y, 0), rot=(0, 0, R(0, 6.28)), scale=(1, 1, R(0.8, 1.3)))
        else:
            src = rng.choice(flower_srcs)
            st = instance(src, "flower", (x, y, 0))
            instance(src.children[0], "petals", (0, 0, 0.17), parent=st)
        placed += 1
        if placed > 420:
            break


def fireflies():
    m = mat("firefly", 0xD9FF7A, emit=10)
    out = []
    for i in range(24):
        f = uvsphere("firefly", 0.022, m, (0, 0, 0), segs=6, rings=4)
        f.visible_shadow = False
        out.append((f, R(-6, 6), R(-3, 6), R(0.4, 1.6), rng.random() * 10))
    return out


def lake_mist():
    lake = list(reversed(list(SHORE) + [(S, -S)]))
    m = prism("mist", lake, -0.1, 0.5, vapor_mat(density=0.05))
    m.visible_shadow = False
    return m


# ---------------------------------------------------------------- world, lights, camera, render
def world_and_lights():
    sc = bpy.context.scene
    w = bpy.data.worlds.new("night")
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    bg = nt.nodes.get("Background")
    bg.inputs["Color"].default_value = srgb(0x2A3570)
    bg.inputs["Strength"].default_value = 0.55
    # the camera sees a screen-space gradient backdrop; lighting stays a flat dim blue
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = 0.0, srgb(0xC46F7A)
    els[1].position, els[1].color = 1.0, srgb(0x0B0F2E)
    e = els.new(0.3)
    e.color = srgb(0x6A4A86)
    e = els.new(0.62)
    e.color = srgb(0x232A63)
    bg2 = nt.nodes.new("ShaderNodeBackground")
    bg2.inputs["Strength"].default_value = 1.0
    lp = nt.nodes.new("ShaderNodeLightPath")
    mix = nt.nodes.new("ShaderNodeMixShader")
    out = nt.nodes.get("World Output")
    nt.links.new(tc.outputs["Window"], sep.inputs[0])
    nt.links.new(sep.outputs["Y"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg2.inputs["Color"])
    nt.links.new(bg.outputs[0], mix.inputs[1])
    nt.links.new(bg2.outputs[0], mix.inputs[2])
    nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs["Fac"])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    moon = bpy.data.lights.new("moon", "SUN")
    moon.color = srgb(0xB9C8FF)[:3]
    moon.energy = 1.4
    moon.angle = math.radians(4)
    mo = link(bpy.data.objects.new("moon", moon))
    mo.rotation_euler = (math.radians(50), 0, math.radians(-120))
    rim = bpy.data.lights.new("rim", "SUN")
    rim.color = srgb(0xFF9A8A)[:3]
    rim.energy = 0.35
    rim.angle = math.radians(10)
    ro = link(bpy.data.objects.new("rim", rim))
    ro.rotation_euler = (math.radians(70), 0, math.radians(40))
    # moon disc in the sky
    disc = uvsphere("moon_disc", 2.2, mat("moon_disc", 0xFFF4D6, emit=6), (-30, 45, 26), segs=24, rings=12)
    disc.visible_shadow = False  # it sits in the moonlight's path and would throw a huge round shadow


def setup_render(res=(1920, 1080), samples=64, device="CPU"):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = "OPENIMAGEDENOISE"
    sc.cycles.max_bounces = 6
    sc.cycles.transparent_max_bounces = 8
    sc.cycles.volume_bounces = 1
    sc.cycles.volume_step_rate = 4.0
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    sc.view_settings.exposure = 0.9
    if device == "GPU":
        prefs = bpy.context.preferences.addons["cycles"].preferences
        for kind in ("OPTIX", "CUDA"):
            try:
                prefs.compute_device_type = kind
                prefs.refresh_devices()
                gpus = [d for d in prefs.devices if d.type == kind]
                if gpus:
                    for d in prefs.devices:
                        d.use = d.type == kind
                    sc.cycles.device = "GPU"
                    print("cycles device:", kind, [d.name for d in gpus])
                    break
            except TypeError:
                continue


# ---------------------------------------------------------------- build + animate
STATE = {}


def build():
    global COL
    bpy.ops.wm.read_factory_settings(use_empty=True)
    COL = bpy.context.scene.collection
    terrain()
    tent, cut_parts, drops, falling, plume, dims = tent_and_sleeper()
    fire, flames, fire_light, embers = campfire()
    chair(-0.1, -2.35, math.pi * 0.85 + math.pi, P["teal"])
    chair(2.25, -0.55, -math.pi * 0.6 + math.pi, P["mustard"])
    picnic_table()
    small_props()
    dock_canoe_reeds()
    path_stones()
    bulbs = string_lights()
    scatter()
    flies = fireflies()
    world_and_lights()
    # the slice: a box that eats the camera-side half of the tent
    cutter = box("cutter", 6, 3, 4, mat("section", P["section"], 0.8), (0, 0, 0), bevel=0.0)
    cutter.hide_render = True
    cutter.display_type = "WIRE"
    for part in cut_parts:
        b = part.modifiers.new("slice", "BOOLEAN")
        b.operation = "DIFFERENCE"
        b.object = cutter
        b.solver = "EXACT"
        b.material_mode = "TRANSFER"
    cam_data = bpy.data.cameras.new("cam")
    cam = link(bpy.data.objects.new("cam", cam_data))
    bpy.context.scene.camera = cam
    target = link(bpy.data.objects.new("cam_target", None))
    tr = cam.constraints.new("TRACK_TO")
    tr.target = target
    tr.track_axis, tr.up_axis = "TRACK_NEGATIVE_Z", "UP_Y"
    STATE.update(tent=tent, cutter=cutter, drops=drops, falling=falling, plume=plume, dims=dims, fire=fire, flames=flames,
                 fire_light=fire_light, embers=embers, bulbs=bulbs, flies=flies, cam=cam, target=target)


def ease(t):
    t = max(0.0, min(1.0, t))
    return 4 * t * t * t if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2


def lerp(a, b, t):
    return a + (b - a) * t


def set_cut(amount):
    """0 = whole tent, 1 = near half sliced away. The cutter slides in along the tent's side normal."""
    st = STATE
    tent = st["tent"]
    rz = tent.rotation_euler.z
    side = Vector((math.cos(rz + math.pi / 2), math.sin(rz + math.pi / 2), 0))  # tent local +y in world
    ridge = Vector((math.cos(rz), math.sin(rz), 0))
    near = -side  # local -y faces the cut camera
    c = st["cutter"]
    c.rotation_euler = (0, 0, rz)
    depth = 1.5  # half of the cutter's 3 m thickness
    c.location = tent.location + near * (depth - 0.02 + (1 - amount) * 3.2) + Vector((0, 0, 1.0))
    show = amount > 0.3
    for d in st["drops"][1:]:
        d.hide_render = not show
    st["falling"].hide_render = not show
    st["plume"].hide_render = not show
    return side, ridge, near


def pose(shot, t, aspect=16 / 9):
    st = STATE
    bpy.context.scene.frame_current = int(round(t * 30))
    # fire
    for i, f in enumerate(st["flames"]):
        k = 0.8 + 0.25 * math.sin(t * 9 + i * 2.1) + 0.12 * math.sin(t * 23 + i)
        h = f["h"]
        f.scale = (1, 1, h / 0.12 * 0.5 * k)
        f.location.z = 0.15 + h * 0.4 * k
    st["fire_light"].data.energy = 260 + 50 * math.sin(t * 11) + 25 * math.sin(t * 27)
    for e, ph, dx, dy in st["embers"]:
        p = (t * 0.45 + ph) % 1
        e.location = (dx * p + math.sin(t * 3 + ph * 9) * 0.05, dy * p, 0.4 + p * 1.6)
        e.scale = (1 - p,) * 3
    for f, x, y, z, ph in st["flies"]:
        f.location = (x + math.sin(t * 0.5 + ph) * 0.6, y + math.cos(t * 0.4 + ph) * 0.6, z + math.sin(t * 1.3 + ph) * 0.2)
    p = (t * 0.6) % 1
    TH = st["dims"]["TH"]
    st["falling"].location.z = TH - 0.08 - p * p * (TH - 0.35)
    # camera
    tent = st["tent"]
    cam, target = st["cam"], st["target"]
    W_pos, W_look = Vector((math.sin(0.78) * 31, -math.cos(0.78) * 31, 17)), Vector((0, 0, -1.6))
    side, ridge, near = set_cut(0)
    c = tent.location
    # three-quarter view from the open end, so the sliced A-frame reads as a triangle rather than a flat wall
    C_pos = c + near * 5.0 + ridge * 3.8 + Vector((0, 0, 2.4))
    C_look = c + Vector((0, 0, 0.6))
    lens = 50
    if shot == "wide":
        a = 0.78 + t * 0.03
        pos, look = Vector((math.sin(a) * 31, -math.cos(a) * 31, 17)), W_look
        set_cut(0)
    elif shot == "push":
        k = ease(t / 5)
        pos = W_pos.lerp(C_pos, k) + Vector((0, 0, math.sin(k * math.pi) * 2))
        look = W_look.lerp(C_look, k)
        lens = lerp(50, 45, k)
        set_cut(ease((t - 4.6) / 1.4))
    else:  # "cut"
        pos, look = C_pos + ridge * (t * 0.06), C_look
        lens = 45
        set_cut(1)
    if aspect < 1:
        lens *= 0.62
    cam.location, target.location = pos, look
    cam.data.lens = lens
    cam.data.dof.use_dof = True
    cam.data.dof.focus_object = target
    cam.data.dof.aperture_fstop = 2.8 if shot == "wide" else 4.0
