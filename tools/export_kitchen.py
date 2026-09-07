import bpy,bmesh,math,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent.parent
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/source-scene.blend'))
# Kitchen bay to the right of the living room, above the adjoining bedroom.
BOUNDS=(1200,1585,940,1220)
count=0
for ob in list(bpy.context.scene.objects):
 if ob.type!='MESH':continue
 bm=bmesh.new();bm.from_mesh(ob.data)
 for axis,limit,positive in [(0,BOUNDS[0],False),(0,BOUNDS[1],True),(1,BOUNDS[2],False),(1,BOUNDS[3],True),(2,245,True)]:
  point=Vector((0,0,0));point[axis]=limit;normal=Vector((0,0,0));normal[axis]=1
  if bm.verts:bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.001,plane_co=point,plane_no=normal,clear_outer=positive,clear_inner=not positive)
 if not bm.faces:bm.free();bpy.data.objects.remove(ob,do_unlink=True);continue
 # Cut away tall perimeter walls for an exhibition dollhouse view.
 remove=[f for f in bm.faces if min(v.co.z for v in f.verts)>225]
 bmesh.ops.delete(bm,geom=remove,context='FACES')
 bm.to_mesh(ob.data);bm.free();count+=1
 # Centre locally and use metres.
 for v in ob.data.vertices:v.co=Vector(((v.co.x-1400)/100,(v.co.y-1080)/100,v.co.z/100))
 ob.data.update()
scene=bpy.context.scene
scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.light='STUDIO';scene.display.shading.color_type='MATERIAL';scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True
scene.render.resolution_x=1000;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
bpy.ops.object.camera_add(location=(-5,-6,6));cam=bpy.context.object;target=Vector((0,0,1));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=7;scene.camera=cam
scene.render.filepath=str(ROOT/'assets/kitchen-review.png');bpy.ops.render.render(write_still=True)
bpy.data.objects.remove(cam,do_unlink=True)
for im in bpy.data.images:
 if im.size[0]>1024 or im.size[1]>1024:
  ratio=1024/max(im.size);im.scale(max(1,int(im.size[0]*ratio)),max(1,int(im.size[1]*ratio)))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'assets/kitchen.glb'),export_format='GLB',export_cameras=False,export_lights=False)
print('KITCHEN',count,flush=True)
