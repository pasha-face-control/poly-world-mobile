#!/usr/bin/env python3
"""Render knight.gltf (converted from knight.fbx) into per-tribe 3D sprites.
The model carries per-vertex colours (COLOR_0). Vertices whose colour is the
'blank' default (near-white) are recoloured to each tribe colour; all other
(already-coloured) vertices keep their colours."""
import os, json, struct
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

BASE = "/tmp/model"
GLTF = os.path.join(BASE, "knight.gltf")
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "images", "knight")
os.makedirs(OUT, exist_ok=True)

TRIBES = {"nature": "#4F772D", "desert": "#E5A93A", "volcanic": "#BC4749", "snow": "#8B93A6"}

def hex_rgb(h):
    h = h.lstrip("#"); return np.array([int(h[i:i+2],16) for i in (0,2,4)])/255.0

d = json.load(open(GLTF))
buf = open(os.path.join(BASE, d["buffers"][0]["uri"]), "rb").read()

COMP = {5120:("b",1),5121:("B",1),5122:("h",2),5123:("H",2),5125:("I",4),5126:("f",4)}
NUM = {"SCALAR":1,"VEC2":2,"VEC3":3,"VEC4":4}

def accessor(i):
    a = d["accessors"][i]; bv = d["bufferViews"][a["bufferView"]]
    off = bv.get("byteOffset",0) + a.get("byteOffset",0)
    ct, cs = COMP[a["componentType"]]; n = NUM[a["type"]]; cnt = a["count"]
    stride = bv.get("byteStride") or cs*n
    out = np.empty((cnt,n), dtype=np.float64)
    for r in range(cnt):
        base = off + r*stride
        vals = struct.unpack_from("<"+ct*n, buf, base)
        out[r] = vals
    # normalise integer colours
    if a.get("normalized") and a["componentType"]==5121:
        out = out/255.0
    if a.get("normalized") and a["componentType"]==5123:
        out = out/65535.0
    return out

def node_matrix(node):
    if "matrix" in node:
        return np.array(node["matrix"], dtype=np.float64).reshape(4,4).T
    M = np.eye(4)
    if "translation" in node:
        T=np.eye(4); T[:3,3]=node["translation"]; M=M@T
    if "rotation" in node:
        x,y,z,w=node["rotation"]
        R=np.array([
            [1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w),0],
            [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w),0],
            [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y),0],
            [0,0,0,1]])
        M=M@R
    if "scale" in node:
        S=np.eye(4); S[0,0],S[1,1],S[2,2]=node["scale"]; M=M@S
    return M

# gather primitives with world transforms
tris = []   # (3x3 positions)
cols = []   # per-tri rgb (avg of vertex colours)
scene = d.get("scenes",[{}])[d.get("scene",0)]
def walk(ni, parent):
    node = d["nodes"][ni]
    world = parent @ node_matrix(node)
    if "mesh" in node:
        mesh = d["meshes"][node["mesh"]]
        for p in mesh["primitives"]:
            pos = accessor(p["attributes"]["POSITION"])
            col = accessor(p["attributes"]["COLOR_0"])[:, :3] if "COLOR_0" in p["attributes"] else np.ones((len(pos),3))
            ph = np.column_stack([pos, np.ones(len(pos))])
            wp = (world @ ph.T).T[:, :3]
            idx = accessor(p["indices"]).astype(int).ravel()
            for f in range(0, len(idx), 3):
                a,b,c = idx[f],idx[f+1],idx[f+2]
                tris.append(wp[[a,b,c]])
                cols.append(col[[a,b,c]].mean(0))
    for ch in node.get("children",[]):
        walk(ch, world)
for ni in scene.get("nodes",[]):
    walk(ni, np.eye(4))

tris = np.array(tris); cols = np.array(cols)
print("tris", len(tris))
uniq,counts = np.unique(np.round(cols,2), axis=0, return_counts=True)
for u,c in sorted(zip(uniq.tolist(),counts.tolist()), key=lambda z:-z[1])[:8]:
    print("colour", u, c)

# remap obj Y-up -> matplotlib Z-up
def remap(P):
    return np.column_stack([P[:,0], P[:,2], P[:,1]])
allv = remap(tris.reshape(-1,3))
center = (allv.max(0)+allv.min(0))/2
tris_m = np.array([remap(t)-center for t in tris])

# 'blank' = near-white / near the default 0.8 grey
def is_blank(c):
    return (c.min() > 0.7) and (c.max()-c.min() < 0.12)

LIGHT = np.array([0.4,0.5,0.8]); LIGHT=LIGHT/np.linalg.norm(LIGHT)

for key,hx in TRIBES.items():
    tint = hex_rgb(hx)
    polys=[]; fc=[]
    for t,c in zip(tris_m, cols):
        base = tint if is_blank(c) else c
        n = np.cross(t[1]-t[0], t[2]-t[0]); ln=np.linalg.norm(n)
        b = 0.55 if ln==0 else 0.5+0.5*max(0.0,float(np.dot(n/ln,LIGHT)))
        polys.append(t); fc.append(np.clip(base*b,0,1).tolist()+[1.0])
    fig=plt.figure(figsize=(3,3.6),dpi=100)
    ax=fig.add_subplot(111,projection="3d")
    ax.add_collection3d(Poly3DCollection(polys,facecolors=fc,edgecolors=(0,0,0,0.28),linewidths=0.3))
    r=np.abs(tris_m.reshape(-1,3)).max()*1.05
    ax.set_xlim(-r,r);ax.set_ylim(-r,r);ax.set_zlim(-r,r)
    ax.set_box_aspect((1,1,1)); ax.view_init(elev=20,azim=-55); ax.set_axis_off()
    try: ax.set_proj_type("persp",focal_length=0.6)
    except Exception: pass
    path=os.path.join(OUT,f"knight_{key}.png")
    fig.savefig(path,transparent=True,bbox_inches="tight",pad_inches=0); plt.close(fig)
    print("wrote",path)
print("done")
