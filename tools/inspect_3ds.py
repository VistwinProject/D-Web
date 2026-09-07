import struct,json
from pathlib import Path
source=Path(r'C:\Users\visio\桌面\寶鋪硬體盤點文件\寶鋪大安硬體盤點 3D\0820_寶舖大安基地.3ds')
b=source.read_bytes();objects=[];materials=[]
def chunks(start,end):
 while start+6<=end:
  kind,size=struct.unpack_from('<HI',b,start)
  if size<6:break
  yield kind,start+6,start+size
  start+=size
def string(start):
 end=b.index(0,start)
 return b[start:end].decode('cp950',errors='replace'),end+1
def visit(start,end):
 for k,s,e in chunks(start,end):
  if k in (0x4d4d,0x3d3d):visit(s,e)
  elif k==0x4000:
   name,at=string(s)
   for kk,ss,ee in chunks(at,e):
    if kk!=0x4100:continue
    obj={'name':name,'start':ss,'end':ee}
    for typ,a,z in chunks(ss,ee):
     if typ==0x4110:
      n=struct.unpack_from('<H',b,a)[0];v=list(struct.iter_unpack('<fff',b[a+2:a+2+n*12]));obj['vertices']=n
      obj['min']=[round(min(p[j] for p in v),2) for j in range(3)];obj['max']=[round(max(p[j] for p in v),2) for j in range(3)]
    objects.append(obj)
  elif k==0xafff:
   mat={}
   for typ,a,z in chunks(s,e):
    if typ==0xa000:mat['name']=string(a)[0]
    if typ==0xa200:
     for tk,ta,tz in chunks(a,z):
      if tk==0xa300:mat['texture']=string(ta)[0]
   materials.append(mat)
visit(0,len(b))
out=Path(__file__).resolve().parent.parent/'assets';out.mkdir(exist_ok=True)
(out/'model-inventory.json').write_text(json.dumps({'objects':objects,'materials':materials},ensure_ascii=False),encoding='utf8')
print('Objects',len(objects),'Materials',len(materials))
print(json.dumps(objects[:18],ensure_ascii=False))
print(json.dumps(materials[:20],ensure_ascii=False))
