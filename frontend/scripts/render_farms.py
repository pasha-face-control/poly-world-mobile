#!/usr/bin/env python3
"""Render the world-map farm models (wheat/horse/bull) to 2D isometric sprites,
matching the unit/building pipeline (ortho, elev=30, azim=-45). Vertex colours
(COLOR_0) are kept as-is. Unlike city buildings, the ground field/base IS kept so
each farm reads as a little plot sitting on the grass tile.
Output: assets/images/farms/<name>.png
"""
import os, json, struct
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
from mpl_toolkits.mplot3d import proj3d
from PIL import Image

BASE = "/tmp/model"
ASSETS = os.path.join(os.path.dirname(__file__), "..", "assets", "images", "farms")
MODELS = ["wheat_farm", "horse_farm", "bullfarm"]
# A few models have a big soil/ground quad that occludes their sparse detail geometry from the
# top-down iso view; paint the whole plot its signature colour so it reads correctly.
FIELD_COLOR = {"wheat_farm": [1.0, 0.78, 0.12]}
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


def project(R, L):
    """Return per-vertex pixel coords (top-left origin) + depth, plus the axes/fig for the
    footprint helper. Uses matplotlib ONLY for the ortho iso projection matrix."""
    fig = plt.figure(figsize=(5, 5), dpi=120)
    ax = fig.add_axes([0, 0, 1, 1], projection="3d")
    ax.set_xlim(-L / 2, L / 2); ax.set_ylim(-L / 2, L / 2); ax.set_zlim(0, L)
    ax.set_box_aspect((1, 1, 1)); ax.view_init(elev=30, azim=-45); ax.set_axis_off()
    try:
        ax.set_proj_type("ortho")  # 2:1 isometric to match the world grid
    except Exception:
        pass
    fig.canvas.draw()
    M = ax.get_proj()
    W, H = fig.canvas.get_width_height()
    V = R.reshape(-1, 3)
    xs, ys, zs = proj3d.proj_transform(V[:, 0], V[:, 1], V[:, 2], M)
    disp = ax.transData.transform(np.column_stack([xs, ys]))
    px = disp[:, 0]; py = H - disp[:, 1]  # top-left origin
    P = np.column_stack([px, py]).reshape(-1, 3, 2)
    Z = zs.reshape(-1, 3)
    return P, Z, W, H, ax, fig


def tri_colors(R, cols, hasc, override=None):
    n = np.cross(R[:, 1] - R[:, 0], R[:, 2] - R[:, 0])
    ln = np.linalg.norm(n, axis=1); ln[ln == 0] = 1.0
    bright = 0.68 + 0.32 * np.abs((n / ln[:, None]) @ LIGHT)  # |n·light|: winding-independent
    if override is not None:
        base = np.tile(np.array(override, float), (len(cols), 1))
    else:
        blank = np.array([(not h) or is_blank(c) for c, h in zip(cols, hasc)])
        base = np.where(blank[:, None], NEUTRAL, np.array(cols))
    rgb = np.clip(base * bright[:, None], 0, 1)
    return (rgb * 255).astype(np.uint8)


def rasterize(P, Z, rgb, W, H):
    """Flat-shaded triangle rasteriser with a real z-buffer (nearer = larger projected z)."""
    img = np.zeros((H, W, 4), np.uint8)
    zbuf = np.full((H, W), -np.inf)
    for i in range(len(P)):
        (x0, y0), (x1, y1), (x2, y2) = P[i]
        minx = int(np.floor(min(x0, x1, x2))); maxx = int(np.ceil(max(x0, x1, x2)))
        miny = int(np.floor(min(y0, y1, y2))); maxy = int(np.ceil(max(y0, y1, y2)))
        minx = max(minx, 0); miny = max(miny, 0); maxx = min(maxx, W - 1); maxy = min(maxy, H - 1)
        if minx > maxx or miny > maxy:
            continue
        denom = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
        if denom == 0:
            continue
        gx, gy = np.meshgrid(np.arange(minx, maxx + 1), np.arange(miny, maxy + 1))
        a = ((y1 - y2) * (gx - x2) + (x2 - x1) * (gy - y2)) / denom
        b = ((y2 - y0) * (gx - x2) + (x0 - x2) * (gy - y2)) / denom
        c = 1 - a - b
        inside = (a >= -1e-6) & (b >= -1e-6) & (c >= -1e-6)
        if not inside.any():
            continue
        z0, z1, z2 = Z[i]
        z = a * z0 + b * z1 + c * z2
        sub = zbuf[miny:maxy + 1, minx:maxx + 1]
        upd = inside & (z > sub)
        if not upd.any():
            continue
        sub[upd] = z[upd]
        blk = img[miny:maxy + 1, minx:maxx + 1]
        blk[upd, 0] = rgb[i, 0]; blk[upd, 1] = rgb[i, 1]; blk[upd, 2] = rgb[i, 2]; blk[upd, 3] = 255
    return img


def footprint_px(ax, H, R):
    """Pixel bounds (top-left origin) of the model's GROUND plot (low-z XY extent)."""
    flat = R.reshape(-1, 3)
    zmax = float(flat[:, 2].max()) or 1.0
    ground = flat[flat[:, 2] <= 0.12 * zmax]
    if len(ground) < 4:
        ground = flat
    x0, x1 = ground[:, 0].min(), ground[:, 0].max()
    y0, y1 = ground[:, 1].min(), ground[:, 1].max()
    corners = np.array([[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]], float)
    xs, ys, _ = proj3d.proj_transform(corners[:, 0], corners[:, 1], corners[:, 2], ax.get_proj())
    disp = ax.transData.transform(np.column_stack([xs, ys]))
    px = disp[:, 0]; py = H - disp[:, 1]
    return px.min(), px.max(), py.min(), py.max()


os.makedirs(ASSETS, exist_ok=True)
meta = {}
for name in MODELS:
    R, cols, hasc = load(name)
    flat = R.reshape(-1, 3)
    L = max(2 * np.abs(flat[:, :2]).max(), flat[:, 2].max()) * 1.05
    P, Z, W, H, ax, fig = project(R, L)
    rgb = tri_colors(R, cols, hasc, FIELD_COLOR.get(name))
    img = rasterize(P, Z, rgb, W, H)
    fx0, fx1, fy0, fy1 = footprint_px(ax, H, R)
    plt.close(fig)
    im = Image.fromarray(img, "RGBA")
    bb = im.getbbox()  # (left, upper, right, lower)
    im.crop(bb).save(os.path.join(ASSETS, name + ".png"))
    cw, ch = bb[2] - bb[0], bb[3] - bb[1]
    footW = (fx1 - fx0) / cw
    fcx = ((fx0 + fx1) / 2 - bb[0]) / cw
    fcy = ((fy0 + fy1) / 2 - bb[1]) / ch
    meta[name] = {"w": cw, "h": ch, "footW": round(footW, 4), "fcx": round(fcx, 4), "fcy": round(fcy, 4)}
    print(f"{name}: crop={cw}x{ch} footW={footW:.3f} fcx={fcx:.3f} fcy={fcy:.3f}")
json.dump(meta, open(os.path.join(ASSETS, "meta.json"), "w"), indent=1)
print("done")
