#!/usr/bin/env python3
"""Render city-builder models (citadel stages + house) to single 2D sprites.
These are pre-coloured temporary models, so vertex colours are kept as-is
(blank ~0.8 grey regions rendered as neutral stone). Output:
assets/images/city/<name>.png
"""
import os, json, struct
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
from PIL import Image

BASE = "/tmp/model"
ASSETS = os.path.join(os.path.dirname(__file__), "..", "assets", "images", "city")
MODELS = ["citadel_1_tm", "citadel_5_tm", "citadel_10_tm", "citadel_15_tm", "houses_tm"]
NEUTRAL = np.array([0.62, 0.6, 0.56])

COMP = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2), 5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
NUM = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}
LIGHT = np.array([0.4, 0.55, 0.75]); LIGHT /= np.linalg.norm(LIGHT)


def load(name):
    d = json.load(open(os.path.join(BASE, name + ".gltf")))
    buf = open(os.path.join(BASE, d["buffers"][0]["uri"]), "rb").read()

    def acc(i):
        a = d["accessors"][i]; bv = d["bufferViews"][a["bufferView"]]
        off = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
        ct, cs = COMP[a["componentType"]]; n = NUM[a["type"]]; cnt = a["count"]
        stride = bv.get("byteStride") or cs * n
        out = np.empty((cnt, n))
        for r in range(cnt): out[r] = struct.unpack_from("<" + ct * n, buf, off + r * stride)
        if a.get("normalized") and a["componentType"] == 5121: out /= 255.0
        if a.get("normalized") and a["componentType"] == 5123: out /= 65535.0
        return out

    def nm(node):
        if "matrix" in node: return np.array(node["matrix"]).reshape(4, 4).T
        M = np.eye(4)
        if "translation" in node: T = np.eye(4); T[:3, 3] = node["translation"]; M = M @ T
        if "rotation" in node:
            x, y, z, w = node["rotation"]
            Rm = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 0], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 0], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y), 0], [0, 0, 0, 1]]); M = M @ Rm
        if "scale" in node: S = np.eye(4); S[0, 0], S[1, 1], S[2, 2] = node["scale"]; M = M @ S
        return M

    tris = []; cols = []; hasc = []
    sc = d.get("scenes", [{}])[d.get("scene", 0)]

    def walk(ni, par):
        node = d["nodes"][ni]; wm = par @ nm(node)
        if "mesh" in node:
            for p in d["meshes"][node["mesh"]]["primitives"]:
                pos = acc(p["attributes"]["POSITION"])
                has = "COLOR_0" in p["attributes"]
                col = acc(p["attributes"]["COLOR_0"])[:, :3] if has else np.ones((len(pos), 3))
                wp = (wm @ np.column_stack([pos, np.ones(len(pos))]).T).T[:, :3]
                idx = acc(p["indices"]).astype(int).ravel()
                for f in range(0, len(idx), 3):
                    a, b, c = idx[f], idx[f + 1], idx[f + 2]
                    tris.append(wp[[a, b, c]]); cols.append(col[[a, b, c]].mean(0)); hasc.append(has)
        for ch in node.get("children", []): walk(ch, wm)

    for ni in sc.get("nodes", []): walk(ni, np.eye(4))
    tris = np.array(tris); cols = np.array(cols); hasc = np.array(hasc)
    R = np.column_stack([tris.reshape(-1, 3)[:, 0], tris.reshape(-1, 3)[:, 2], tris.reshape(-1, 3)[:, 1]]).reshape(tris.shape)
    mn = R.reshape(-1, 3).min(0); mx = R.reshape(-1, 3).max(0)
    R[:, :, 0] -= (mn[0] + mx[0]) / 2; R[:, :, 1] -= (mn[1] + mx[1]) / 2; R[:, :, 2] -= mn[2]
    return R, cols, hasc


def is_blank(c):
    return bool(np.all(np.abs(c - 0.8) < 0.03))


def draw(R, cols, hasc, L):
    zmax = float(R[:, :, 2].max()) or 1.0
    polys = []; fc = []
    for t, c, h in zip(R, cols, hasc):
        n = np.cross(t[1] - t[0], t[2] - t[0]); ln = np.linalg.norm(n)
        # Skip the model's flat ground base: near-horizontal faces sitting in the
        # bottom slab. This removes the big green base plane so only the structure
        # sits on the city's grass.
        if ln > 0 and abs(n[2]) / ln > 0.90 and t[:, 2].max() < 0.12 * zmax:
            continue
        base = NEUTRAL if (not h or is_blank(c)) else c
        b = 0.6 if ln == 0 else 0.55 + 0.45 * max(0.0, float(np.dot(n / ln, LIGHT)))
        polys.append(t); fc.append(np.clip(base * b, 0, 1).tolist() + [1.0])
    fig = plt.figure(figsize=(5, 5), dpi=120); fig.patch.set_alpha(0.0)
    ax = fig.add_axes([0, 0, 1, 1], projection="3d"); ax.patch.set_alpha(0.0)
    try:
        ax.set_facecolor((0, 0, 0, 0))
        for pane in (ax.xaxis, ax.yaxis, ax.zaxis): pane.set_pane_color((0, 0, 0, 0))
    except Exception:
        pass
    ax.add_collection3d(Poly3DCollection(polys, facecolors=fc, edgecolors=(0, 0, 0, 0.18), linewidths=0.2))
    ax.set_xlim(-L / 2, L / 2); ax.set_ylim(-L / 2, L / 2); ax.set_zlim(0, L)
    ax.set_box_aspect((1, 1, 1)); ax.view_init(elev=30, azim=-45); ax.set_axis_off()
    try:
        ax.set_proj_type("ortho")  # 2:1 isometric to match the city grid
    except Exception:
        pass
    fig.canvas.draw()
    w, h = fig.canvas.get_width_height()
    argb = np.frombuffer(fig.canvas.buffer_rgba(), dtype=np.uint8).reshape(h, w, 4)
    plt.close(fig)
    im = Image.fromarray(argb.copy(), "RGBA")
    return im  # full frame; callers crop (shared crop keeps stages aligned)


os.makedirs(ASSETS, exist_ok=True)
CITADELS = [m for m in MODELS if m.startswith("citadel")]
rendered = {}
for name in MODELS:
    R, cols, hasc = load(name)
    flat = R.reshape(-1, 3)
    L = 5.75 * 1.05  # shared cube for all citadels (same 6×6 footprint)
    if name == "houses_tm":
        L = max(2 * np.abs(flat[:, :2]).max(), flat[:, 2].max()) * 1.05
    print(f"{name}: tris={len(R)} L={L:.2f} blank={100*np.mean([is_blank(c) for c in cols]):.0f}%")
    rendered[name] = draw(R, cols, hasc, L)

# Citadels share ONE canvas (union crop) so the base sits at the same pixel in
# every stage — the City Screen can then anchor all stages identically.
ux0 = uy0 = 10 ** 9; ux1 = uy1 = -1
for name in CITADELS:
    bb = rendered[name].getbbox()
    if bb:
        ux0 = min(ux0, bb[0]); uy0 = min(uy0, bb[1]); ux1 = max(ux1, bb[2]); uy1 = max(uy1, bb[3])
pad = 8
crop = (ux0 - pad, uy0 - pad, ux1 + pad, uy1 + pad)
print("citadel shared canvas", (crop[2] - crop[0], crop[3] - crop[1]))
for name in CITADELS:
    rendered[name].crop(crop).save(os.path.join(ASSETS, name + ".png"))
rendered["houses_tm"].crop(rendered["houses_tm"].getbbox()).save(os.path.join(ASSETS, "houses_tm.png"))
print("done")

