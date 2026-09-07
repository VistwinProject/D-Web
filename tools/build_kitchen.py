"""Import the supplied 3DS mesh data with original UV/material assignments.
Run with Blender --background --python tools/build_kitchen.py.
Coordinates in the inventory are centimetres, Z up. No source changes.
"""
import bpy,struct,json,math,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent.parent
SOURCE=Path(r'C:\Users\visio\桌面\寶鋪硬體盤點文件\寶鋪大安硬體盤點 3D')
b=(SOURCE/'0820_寶舖大安基地.3ds').read_bytes()
def chunks(s,e):
 while s+6<=e:
  k,n=struct.unpack_from('<HI',b,s)
  if n<6:break
  yield k,s+6,s+n
  s+=n
def string(s):
 e=b.index(0,s);return b[s:e].decode('cp950',errors='replace'),e+1
def color(s,e):
 for k,a,z in chunks(s,e):
  if k in (0x10,0x13):return struct.unpack_from('<fff',b,a)
  if k in (0x11,0x12):return [v/255 for v in b[a:a+3]]
 return (.65,.65,.65)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
mats={};inventory=[]
def visit(s,e):
 for k,a,z in chunks(s,e):
  if k in (0x4d4d,0x3d3d):visit(a,z)
  elif k==0xafff:
   name='';rgb=(.65,.65,.65);tex=None
   for t,x,y in chunks(a,z):
    if t==0xa000:name=string(x)[0]
    if t==0xa020:rgb=color(x,y)
    if t==0xa200:
     for tt,xx,yy in chunks(x,y):
      if tt==0xa300:tex=string(xx)[0]
   m=bpy.data.materials.new(name);m.diffuse_color=(*rgb,1);m.use_nodes=True
   bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*rgb,1);bs.inputs['Roughness'].default_value=.65
   if tex and (SOURCE/tex).exists():
    im=m.node_tree.nodes.new('ShaderNodeTexImage');im.image=bpy.data.images.load(str(SOURCE/tex),check_existing=True)
    m.node_tree.links.new(im.outputs['Color'],bs.inputs['Base Color'])
   mats[name]=m
  elif k==0x4000:
   name,x=string(a)
   for t,x,y in chunks(x,z):
    if t!=0x4100:continue
    verts=[];faces=[];uv=[];groups=[]
    for typ,p,q in chunks(x,y):
     if typ==0x4110:
      n=struct.unpack_from('<H',b,p)[0];verts=list(struct.iter_unpack('<fff',b[p+2:p+2+n*12]))
     elif typ==0x4140:
      n=struct.unpack_from('<H',b,p)[0];uv=list(struct.iter_unpack('<ff',b[p+2:p+2+n*8]))
     elif typ==0x4120:
      n=struct.unpack_from('<H',b,p)[0];faces=[f[:3] for f in struct.iter_unpack('<HHHH',b[p+2:p+2+n*8])]
      for ft,fa,fz in chunks(p+2+n*8,q):
       if ft==0x4130:
        mat,fi=string(fa);count=struct.unpack_from('<H',b,fi)[0];ids=struct.unpack_from('<'+'H'*count,b,fi+2);groups.append((mat,ids))
    if not verts or not faces:continue
    mn=[min(v[j] for v in verts) for j in range(3)];mx=[max(v[j] for v in verts) for j in range(3)]
    inventory.append({'name':name,'min':mn,'max':mx,'mats':[g[0] for g in groups]})
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob)
    for mat,ids in groups:
     if mat in mats:
      index=len(mesh.materials);mesh.materials.append(mats[mat])
      for fi in ids:
       if fi<len(mesh.polygons):mesh.polygons[fi].material_index=index
    if uv:
     layer=mesh.uv_layers.new()
     for poly in mesh.polygons:
      for loop in poly.loop_indices:
       vi=mesh.loops[loop].vertex_index
       if vi<len(uv):layer.data[loop].uv=uv[vi]
    if len(verts)>1000:
     for poly in mesh.polygons:poly.use_smooth=True
visit(0,len(b))
(ROOT/'assets'/'material-inventory.json').write_text(json.dumps(inventory,ensure_ascii=False),encoding='utf8')
print('IMPORTED',len(inventory),flush=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets'/'source-scene.blend'))
# Overhead diagnostic: clip ceiling faces above 225 cm.
import bmesh
for ob in list(bpy.context.scene.objects):
 if ob.type!='MESH':continue
 bm=bmesh.new();bm.from_mesh(ob.data)
 remove=[f for f in bm.faces if all(v.co.z>225 for v in f.verts)]
 bmesh.ops.delete(bm,geom=remove,context='FACES');bm.to_mesh(ob.data);bm.free()
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.light='STUDIO';scene.display.shading.color_type='MATERIAL'
scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True
scene.display.shading.background_type='WORLD';scene.world.color=(.08,.08,.08)
scene.render.resolution_x=1600;scene.render.resolution_y=1600;scene.render.resolution_percentage=100
points=[v.co for o in scene.objects if o.type=='MESH' for v in o.data.vertices]
mn=Vector(tuple(min(v[j] for v in points) for j in range(3)));mx=Vector(tuple(max(v[j] for v in points) for j in range(3)));center=(mn+mx)/2
print('BOUNDS',list(mn),list(mx),flush=True)
bpy.ops.object.camera_add(location=(center.x,center.y,6000));cam=bpy.context.object;cam.rotation_euler=(0,0,0);cam.data.type='ORTHO';cam.data.ortho_scale=max(mx.x-mn.x,mx.y-mn.y)*1.05;cam.data.clip_end=10000;scene.camera=cam
scene.render.filepath=str(ROOT/'assets'/'plan-review.png');bpy.ops.render.render(write_still=True)
