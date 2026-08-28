#!/usr/bin/env python3
"""Pre-render rider.obj into flat-shaded 3D sprites tinted per tribe color.
Output: assets/images/rider/rider_<tribe>.png (transparent, 3/4 iso view)."""
import os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

SRC = "/tmp/model/rider.obj"
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "images", "rider")
os.makedirs(OUT, exist_ok=True)

# Tribe colors (hex -> filename key)
TRIBES = {
    "nature": "#4F772D",
    "desert": "#E5A93A",
    "volcanic": "#BC4749",
    "snow": "#8B93A6",
}


def hex_rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)]) / 255.0


# --- parse obj ---
verts = []
faces = []
for line in open(SRC):
    if line.startswith("v "):
        verts.append([float(x) for x in line.split()[1:4]])
    elif line.startswith("f "):
        idx = [int(tok.split("/")[0]) - 1 for tok in line.split()[1:]]
        faces.append(idx)
verts = np.array(verts)

# obj Y is up -> remap to (x, z, y) so matplotlib Z axis is vertical
V = np.column_stack([verts[:, 0], verts[:, 2], verts[:, 1]])
center = (V.max(0) + V.min(0)) / 2
V = V - center

LIGHT = np.array([0.4, 0.5, 0.8])
LIGHT = LIGHT / np.linalg.norm(LIGHT)


def shade(base):
    polys = []
    colors = []
    for f in faces:
        poly = V[f]
        n = np.cross(poly[1] - poly[0], poly[2] - poly[0])
        ln = np.linalg.norm(n)
        if ln == 0:
            b = 0.6
        else:
            n = n / ln
            b = 0.45 + 0.55 * max(0.0, float(np.dot(n, LIGHT)))
        polys.append(poly)
        colors.append(np.clip(base * b, 0, 1).tolist() + [1.0])
    return polys, colors


for key, hx in TRIBES.items():
    base = hex_rgb(hx)
    polys, colors = shade(base)
    fig = plt.figure(figsize=(3, 3.6), dpi=100)
    ax = fig.add_subplot(111, projection="3d")
    coll = Poly3DCollection(polys, facecolors=colors, edgecolors=(0, 0, 0, 0.35), linewidths=0.4)
    ax.add_collection3d(coll)
    r = np.abs(V).max() * 1.05
    ax.set_xlim(-r, r); ax.set_ylim(-r, r); ax.set_zlim(-r, r)
    ax.set_box_aspect((1, 1, 1))
    ax.view_init(elev=22, azim=-55)
    ax.set_axis_off()
    try:
        ax.set_proj_type("persp", focal_length=0.6)
    except Exception:
        pass
    path = os.path.join(OUT, f"rider_{key}.png")
    fig.savefig(path, transparent=True, bbox_inches="tight", pad_inches=0)
    plt.close(fig)
    print("wrote", path)

print("done")
