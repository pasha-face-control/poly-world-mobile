#!/usr/bin/env python3
"""Render the world-map farm models (wheat/horse/bull) to 2D isometric sprites.

Unlike the older version, this uses a SELF-COMPUTED orthographic isometric camera
(manual right/up/forward basis) so per-pixel depth is a real camera distance. That
fixes the bug where matplotlib's projection "z" was not a reliable depth, letting the
big flat green ground quad draw OVER the barn / fences / animals.

The whole plot (green pasture + white fence + barn + animals) is kept so each farm
reads exactly like the reference renders. Per-vertex colours (COLOR_0) are used as-is.
Output: assets/images/farms/<name>.png  + meta.json (footprint fractions for 1x1 grid).
"""
import os, json, struct
import numpy as np
from PIL import Image

BASE = "/tmp/model"
ASSETS = os.path.join(os.path.dirname(__file__), "..", "assets", "images", "farms")
MODELS = ["wheat_farm", "horse_farm", "bullfarm"]

ELEV, AZIM = 30.0, -45.0          # match the rest of the sprite pipeline (2:1 iso)
PAD = 8                            # px padding around the model
TARGET = 560                      # target longest screen dimension (px)

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

    tris = []; cols = []
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
                a = idx[0::3]; b = idx[1::3]; c = idx[2::3]
                n = min(len(a), len(b), len(c))
                t = np.stack([wp[a[:n]], wp[b[:n]], wp[c[:n]]], axis=1)     # (F,3,3)
                cc = (col[a[:n]] + col[b[:n]] + col[c[:n]]) / 3.0            # (F,3)
                tris.append(t); cols.append(cc)
        for ch in node.get("children", []): walk(ch, wm)

    for ni in sc.get("nodes", []): walk(ni, np.eye(4))
    tris = np.concatenate(tris, 0); cols = np.concatenate(cols, 0)
    # gltf is Y-up; convert to Z-up (newX=x, newY=z, newZ=y) then rest on z=0
    R = np.stack([tris[:, :, 0], tris[:, :, 2], tris[:, :, 1]], axis=2)
    flat = R.reshape(-1, 3)
    mn = flat.min(0); mx = flat.max(0)
    R[:, :, 0] -= (mn[0] + mx[0]) / 2
    R[:, :, 1] -= (mn[1] + mx[1]) / 2
    R[:, :, 2] -= mn[2]
    return R, cols


def camera_basis():
    er, ar = np.radians(ELEV), np.radians(AZIM)
    cam = np.array([np.cos(er) * np.cos(ar), np.cos(er) * np.sin(ar), np.sin(er)])  # points toward camera
    cam /= np.linalg.norm(cam)
    right = np.cross(np.array([0.0, 0.0, 1.0]), cam); right /= np.linalg.norm(right)
    up = np.cross(cam, right); up /= np.linalg.norm(up)
    return right, up, cam


def tri_colors(R, cols):
    n = np.cross(R[:, 1] - R[:, 0], R[:, 2] - R[:, 0])
    ln = np.linalg.norm(n, axis=1); ln[ln == 0] = 1.0
    bright = 0.72 + 0.28 * np.abs((n / ln[:, None]) @ LIGHT)  # gentle, winding-independent shading
    rgb = np.clip(cols * bright[:, None], 0, 1)
    return (rgb * 255).astype(np.uint8)


def rasterize(P, Z, rgb, W, H):
    """Flat-shaded triangle rasteriser with a real z-buffer (nearer camera = larger depth)."""
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


os.makedirs(ASSETS, exist_ok=True)
right, up, cam = camera_basis()
meta = {}
for name in MODELS:
    R, cols = load(name)
    flat = R.reshape(-1, 3)
    sx = flat @ right; sy = flat @ up
    sxmin, sxmax = sx.min(), sx.max(); symin, symax = sy.min(), sy.max()
    S = TARGET / max(sxmax - sxmin, symax - symin)
    W = int(np.ceil((sxmax - sxmin) * S)) + 2 * PAD
    H = int(np.ceil((symax - symin) * S)) + 2 * PAD

    def to_px(pts):  # world (N,3) -> pixel (N,2), top-left origin
        vx = pts @ right; vy = pts @ up
        return np.column_stack([(vx - sxmin) * S + PAD, (symax - vy) * S + PAD])

    P = to_px(R.reshape(-1, 3)).reshape(-1, 3, 2)
    Z = (R.reshape(-1, 3) @ cam).reshape(-1, 3)   # camera depth (larger = nearer)
    rgb = tri_colors(R, cols)
    img = rasterize(P, Z, rgb, W, H)

    # footprint = the ground plot (green field / soil base): low-z XY extent
    zmax = float(flat[:, 2].max()) or 1.0
    ground = flat[flat[:, 2] <= 0.12 * zmax]
    if len(ground) < 4:
        ground = flat
    gx0, gx1 = ground[:, 0].min(), ground[:, 0].max()
    gy0, gy1 = ground[:, 1].min(), ground[:, 1].max()
    corners = np.array([[gx0, gy0, 0], [gx1, gy0, 0], [gx1, gy1, 0], [gx0, gy1, 0]], float)
    cpx = to_px(corners)
    fx0, fx1 = cpx[:, 0].min(), cpx[:, 0].max()
    fy0, fy1 = cpx[:, 1].min(), cpx[:, 1].max()

    im = Image.fromarray(img, "RGBA")
    bb = im.getbbox()  # (left, upper, right, lower)
    im.crop(bb).save(os.path.join(ASSETS, name + ".png"))
    cw, ch = bb[2] - bb[0], bb[3] - bb[1]
    footW = (fx1 - fx0) / cw
    fcx = ((fx0 + fx1) / 2 - bb[0]) / cw
    fcy = ((fy0 + fy1) / 2 - bb[1]) / ch
    meta[name] = {"w": cw, "h": ch, "footW": round(footW, 4), "fcx": round(fcx, 4), "fcy": round(fcy, 4)}
    print(f"{name}: crop={cw}x{ch} tris={len(P)} footW={footW:.3f} fcx={fcx:.3f} fcy={fcy:.3f}")
json.dump(meta, open(os.path.join(ASSETS, "meta.json"), "w"), indent=1)
print("done")
