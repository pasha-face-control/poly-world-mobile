#!/usr/bin/env python3
"""Re-render ONLY the Rider unit from the updated model, keeping the exact same
on-map size as the current sprites. Blank (~0.8 grey) vertices are recoloured per
tribe; all other painted vertex colours are preserved.

Prereq: assimp export <rider.fbx> /tmp/model/rider.gltf  (produces rider.gltf + rider.bin)
"""
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

# Match the CURRENT rider sprites exactly so size stays unchanged.
CANVAS = (213, 175)
CONTENT_H = 77          # rider pixel height in the existing sprites
BASELINE_Y = 165        # bottom (feet) y of the existing sprite content
CENTER_X = 106          # horizontal centre of the existing sprite content

COMP = {5120:("b",1),5121:("B",1),5122:("h",2),5123:("H",2),5125:("I",4),5126:("f",4)}
NUM = {"SCALAR":1,"VEC2":2,"VEC3":3,"VEC4":4}
LIGHT = np.array([0.4,0.5,0.8]); LIGHT /= np.linalg.norm(LIGHT)

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
            Rm=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w),0],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w),0],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y),0],[0,0,0,1]]);M=M@Rm
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
    # remap Y-up -> Z-up
    Rm=np.column_stack([tris.reshape(-1,3)[:,0],tris.reshape(-1,3)[:,2],tris.reshape(-1,3)[:,1]]).reshape(tris.shape)
    mn=Rm.reshape(-1,3).min(0); mx=Rm.reshape(-1,3).max(0)
    cx=(mn[0]+mx[0])/2; cy=(mn[1]+mx[1])/2
    Rm[:,:,0]-=cx; Rm[:,:,1]-=cy; Rm[:,:,2]-=mn[2]
    return Rm, cols, hasc

def is_blank(c):
    return bool(np.all(np.abs(c-0.8)<0.03))

def draw(R, cols, hasc, tint, L):
    polys=[];fc=[]
    for t,c,h in zip(R,cols,hasc):
        base=tint if (not h or is_blank(c)) else c
        n=np.cross(t[1]-t[0],t[2]-t[0]);ln=np.linalg.norm(n)
        b=0.55 if ln==0 else 0.5+0.5*max(0.0,float(np.dot(n/ln,LIGHT)))
        polys.append(t);fc.append(np.clip(base*b,0,1).tolist()+[1.0])
    fig=plt.figure(figsize=(4,4),dpi=150)
    ax=fig.add_axes([0,0,1,1],projection="3d")
    ax.add_collection3d(Poly3DCollection(polys,facecolors=fc,edgecolors=(0,0,0,0.22),linewidths=0.25))
    ax.set_xlim(-L/2,L/2); ax.set_ylim(-L/2,L/2); ax.set_zlim(0,L)
    ax.set_box_aspect((1,1,1)); ax.view_init(elev=18,azim=-55); ax.set_axis_off()
    try: ax.set_proj_type("persp",focal_length=0.6)
    except Exception: pass
    fig.canvas.draw()
    w,h=fig.canvas.get_width_height()
    argb=np.frombuffer(fig.canvas.buffer_rgba(),dtype=np.uint8).reshape(h,w,4)
    plt.close(fig)
    return Image.fromarray(argb.copy(),"RGBA")

def main():
    R,cols,hasc=load("rider")
    flat=R.reshape(-1,3)
    L=max(2*np.abs(flat[:,:2]).max(), flat[:,2].max())*1.08
    out=os.path.join(ASSETS,"rider"); os.makedirs(out,exist_ok=True)
    for key,hx in TRIBES.items():
        im=draw(R,cols,hasc,hex_rgb(hx),L)
        bb=im.getbbox()
        content=im.crop(bb)
        scale=CONTENT_H/content.height
        nw=max(1,round(content.width*scale)); nh=CONTENT_H
        content=content.resize((nw,nh),Image.LANCZOS)
        canvas=Image.new("RGBA",CANVAS,(0,0,0,0))
        x=int(round(CENTER_X-nw/2)); y=BASELINE_Y-nh
        canvas.paste(content,(x,y),content)
        canvas.save(os.path.join(out,f"rider_{key}.png"))
        print(f"rider_{key}.png  content {nw}x{nh} @ ({x},{y})")
    print("done")

if __name__ == "__main__":
    main()
