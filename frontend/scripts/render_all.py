#!/usr/bin/env python3
"""Render ALL unit models at one shared world scale so relative sizes are
physically correct (no per-sprite fit-to-box distortion). Feet aligned to a
common baseline; blank (default-grey ~0.8) regions recoloured per tribe.
Models with no vertex colours (rider.obj) are fully tribe-tinted."""
import os, json, struct
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
from PIL import Image

BASE = "/tmp/model"
ASSETS = os.path.join(os.path.dirname(__file__), "..", "assets", "images")
TRIBES = {"nature": "#4F772D", "desert": "#E5A93A", "volcanic": "#BC4749", "snow": "#8B93A6"}

# gltf name -> unit type (asset folder / prefix)
MODELS = {
    "warrior": "warrior", "archer": "archer", "swordsman": "swordsmen",
    "rider": "rider", "armored_rider": "armored_rider", "knight": "chivalry",
    "pikeman": "pikemen", "beefeater": "beefeater", "catapult": "catapult",
    "merchant": "merchant",
}

COMP = {5120:("b",1),5121:("B",1),5122:("h",2),5123:("H",2),5125:("I",4),5126:("f",4)}
NUM = {"SCALAR":1,"VEC2":2,"VEC3":3,"VEC4":4}

def hex_rgb(h):
    h=h.lstrip("#"); return np.array([int(h[i:i+2],16) for i in (0,2,4)])/255.0

def load(name):
    d=json.load(open(os.path.join(BASE,name+".gltf")))
    buf=open(os.path.join(BASE,d["buffers"][0]["uri"]),"rb").read()
    def acc(i):
        a=d["accessors"][i]; bv=d["bufferViews"][a["bufferView"]]
        off=bv.get("byteOffset",0)+a.get("byteOffset",0)
        ct,cs=COMP[a["componentType"]]; n=NUM[a["type"]]; cnt=a["count"]
        stride=bv.get("byteStride") or cs*n
        out=np.empty((cnt,n))
        for r in range(cnt): out[r]=struct.unpack_from("<"+ct*n,buf,off+r*stride)
        if a.get("normalized") and a["componentType"]==5121: out/=255.0
        if a.get("normalized") and a["componentType"]==5123: out/=65535.0
        return out
    def nm(node):
        if "matrix" in node: return np.array(node["matrix"]).reshape(4,4).T
        M=np.eye(4)
        if "translation" in node: T=np.eye(4);T[:3,3]=node["translation"];M=M@T
        if "rotation" in node:
            x,y,z,w=node["rotation"]
            R=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w),0],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w),0],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y),0],[0,0,0,1]]);M=M@R
        if "scale" in node: S=np.eye(4);S[0,0],S[1,1],S[2,2]=node["scale"];M=M@S
        return M
    tris=[];cols=[];hasc=[]
    sc=d.get("scenes",[{}])[d.get("scene",0)]
    def walk(ni,par):
        node=d["nodes"][ni]; wm=par@nm(node)
        if "mesh" in node:
            for p in d["meshes"][node["mesh"]]["primitives"]:
                pos=acc(p["attributes"]["POSITION"])
                has="COLOR_0" in p["attributes"]
                col=acc(p["attributes"]["COLOR_0"])[:,:3] if has else np.ones((len(pos),3))
                wp=(wm@np.column_stack([pos,np.ones(len(pos))]).T).T[:,:3]
                idx=acc(p["indices"]).astype(int).ravel()
                for f in range(0,len(idx),3):
                    a,b,c=idx[f],idx[f+1],idx[f+2]
                    tris.append(wp[[a,b,c]]); cols.append(col[[a,b,c]].mean(0)); hasc.append(has)
        for ch in node.get("children",[]): walk(ch,wm)
    for ni in sc.get("nodes",[]): walk(ni,np.eye(4))
    tris=np.array(tris); cols=np.array(cols); hasc=np.array(hasc)
    # remap obj/fbx Y-up -> Z-up
    R=np.column_stack([tris.reshape(-1,3)[:,0],tris.reshape(-1,3)[:,2],tris.reshape(-1,3)[:,1]]).reshape(tris.shape)
    # centre X,Y ; feet (min Z) -> 0
    mn=R.reshape(-1,3).min(0); mx=R.reshape(-1,3).max(0)
    cx=(mn[0]+mx[0])/2; cy=(mn[1]+mx[1])/2
    R[:,:,0]-=cx; R[:,:,1]-=cy; R[:,:,2]-=mn[2]
    return R, cols, hasc

def is_blank(c):
    return bool(np.all(np.abs(c-0.8)<0.03))

# Per-type extra scale (mounted units rendered 2x smaller than the shared scale).
SCALE = {"rider": 0.5, "armored_rider": 0.5, "chivalry": 0.5}

LIGHT=np.array([0.4,0.5,0.8]); LIGHT/=np.linalg.norm(LIGHT)

# --- pass 1: load all, find global scale ---
data={}
maxxy=0.0; maxh=0.0
for name in MODELS:
    R,cols,hasc=load(name)
    data[name]=(R,cols,hasc)
    flat=R.reshape(-1,3)
    maxxy=max(maxxy, np.abs(flat[:,:2]).max())
    maxh=max(maxh, flat[:,2].max())
    print(f"{name:14s} height={flat[:,2].max():6.2f}  halfXY={np.abs(flat[:,:2]).max():6.2f}")
L=max(2*maxxy, maxh)*1.04
print("global cube L =", round(L,2))

# --- pass 2: render each with identical limits/aspect ---
tmp=os.path.join(BASE,"_out"); os.makedirs(tmp,exist_ok=True)
def draw(name, key, tint):
    R,cols,hasc=data[name]
    polys=[];fc=[]
    for t,c,h in zip(R,cols,hasc):
        base=tint if (not h or is_blank(c)) else c
        n=np.cross(t[1]-t[0],t[2]-t[0]);ln=np.linalg.norm(n)
        b=0.55 if ln==0 else 0.5+0.5*max(0.0,float(np.dot(n/ln,LIGHT)))
        polys.append(t);fc.append(np.clip(base*b,0,1).tolist()+[1.0])
    fig=plt.figure(figsize=(4,4),dpi=100)
    ax=fig.add_axes([0,0,1,1],projection="3d")
    ax.add_collection3d(Poly3DCollection(polys,facecolors=fc,edgecolors=(0,0,0,0.22),linewidths=0.25))
    ax.set_xlim(-L/2,L/2); ax.set_ylim(-L/2,L/2); ax.set_zlim(0,L)
    ax.set_box_aspect((1,1,1)); ax.view_init(elev=18,azim=-55); ax.set_axis_off()
    try: ax.set_proj_type("persp",focal_length=0.6)
    except Exception: pass
    p=os.path.join(tmp,f"{name}_{key}.png")
    fig.savefig(p,transparent=True); plt.close(fig)
    return p

# shared union crop across all (full-scale, grounded) renders
ux0=uy0=1e9; ux1=uy1=-1
for name in MODELS:
    bb=Image.open(draw(name,"_c",hex_rgb(TRIBES["nature"]))).convert("RGBA").getbbox()
    if bb:
        ux0=min(ux0,bb[0]); uy0=min(uy0,bb[1]); ux1=max(ux1,bb[2]); uy1=max(uy1,bb[3])
crop=(ux0,uy0,ux1,uy1); CW,CH=ux1-ux0,uy1-uy0
print("shared crop", crop, "size", (CW, CH))

def shrink_bottom_center(im, factor):
    """Scale a sprite down by `factor` and re-anchor bottom-centre on the same canvas
    so feet stay on the ground line and horizontal centre is preserved."""
    w,h=im.size
    nw,nh=max(1,int(w*factor)),max(1,int(h*factor))
    small=im.resize((nw,nh), Image.LANCZOS)
    canvas=Image.new("RGBA",(w,h),(0,0,0,0))
    canvas.paste(small,((w-nw)//2, h-nh),small)
    return canvas

# final sprites, per tribe; mounted types shrunk in 2D and re-grounded
for name in MODELS:
    utype=MODELS[name]; f=SCALE.get(utype,1.0)
    out=os.path.join(ASSETS,utype); os.makedirs(out,exist_ok=True)
    for key,hx in TRIBES.items():
        im=Image.open(draw(name,key,hex_rgb(hx))).convert("RGBA").crop(crop)
        if f!=1.0: im=shrink_bottom_center(im,f)
        im.save(os.path.join(out,f"{utype}_{key}.png"))
print("done; sprite size =", (CW, CH))
