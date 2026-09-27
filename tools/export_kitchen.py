"""Export the actual kitchen bay (worktop, sink and cabinets) from the supplied 3DS.
Usage: python tools/export_kitchen.py --source path/to/0820_寶舖大安基地.3ds
Requires numpy, trimesh, scipy, shapely. The source is read-only.
See assets/kitchen-source.json for coordinates and source fingerprint.
"""
import struct,json
from pathlib import Path
import numpy as np,trimesh
import argparse
parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,required=True);args=parser.parse_args()
b=args.source.read_bytes();objects=[]
def chunks(s,e):
 while s+6<=e:
  k,n=struct.unpack_from('<HI',b,s)
  if n<6:break
  yield k,s+6,s+n
  s+=n
def string(s):
 e=b.index(0,s);return b[s:e].decode('cp950',errors='replace'),e+1
def visit(s,e):
 for k,a,z in chunks(s,e):
  if k in (0x4d4d,0x3d3d):visit(a,z)
  elif k==0x4000:
   name,x=string(a)
   for t,x,y in chunks(x,z):
    if t!=0x4100:continue
    verts=faces=None;mats=[]
    for typ,p,q in chunks(x,y):
     if typ==0x4110:
      n=struct.unpack_from('<H',b,p)[0];verts=np.frombuffer(b,dtype='<f4',count=n*3,offset=p+2).reshape(-1,3).copy()
     elif typ==0x4120:
      n=struct.unpack_from('<H',b,p)[0];faces=np.frombuffer(b,dtype='<u2',count=n*4,offset=p+2).reshape(-1,4)[:,:3].copy()
      for ft,fa,fz in chunks(p+2+n*8,q):
       if ft==0x4130:mats.append(string(fa)[0])
    if verts is not None and faces is not None:objects.append((name,verts,faces,mats))
visit(0,len(b))
scene=trimesh.Scene()
lo=np.array([1290,789,0]);hi=np.array([1585,930,245])
excluded={'Group286','Group296','Group597','Group687','Group712','Group753','Group759','Plane04_01','Plane04_02','Plane04_03'}
for name,v,f,m in objects:
 if name in excluded or np.any(v.max(0)<lo) or np.any(v.min(0)>hi):continue
 mesh=trimesh.Trimesh(v,f,process=False)
 for axis in range(3):
  for limit,sign in [(lo[axis],1),(hi[axis],-1)]:
   point=np.zeros(3);point[axis]=limit;normal=np.zeros(3);normal[axis]=sign
   mesh=mesh.slice_plane(point,normal,cap=False)
   if not len(mesh.faces):break
  if not len(mesh.faces):break
 if not len(mesh.faces):continue
 v=mesh.vertices;mesh.vertices=np.column_stack(((v[:,0]-1400)/100,v[:,2]/100,-(v[:,1]-780)/100));mesh.remove_unreferenced_vertices();scene.add_geometry(mesh,node_name=name,geom_name=name)
output=Path(__file__).resolve().parents[1]/'assets/kitchen.glb'
scene.export(output)
print(f'Exported {len(scene.geometry)} kitchen meshes to {output}')
