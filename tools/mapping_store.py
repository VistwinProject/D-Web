"""Durable, validated projection profiles outside the repository and browser."""
import hashlib, json, math, os, tempfile, threading
from pathlib import Path

class Conflict(Exception): pass
class ProfileStore:
    def __init__(self, directory=None):
        self.directory=Path(directory or os.environ.get('D_MAPPING_CONFIG_DIR',Path.home()/'.d-web-installation'))
        self.lock=threading.RLock()
    @staticmethod
    def validate(c):
        if not isinstance(c,dict) or c.get('version')!=1 or not isinstance(c.get('regions'),list) or len(c['regions'])!=4: raise ValueError('設定檔格式錯誤')
        def number(n,a,b): return type(n) in (int,float) and math.isfinite(n) and a<=n<=b
        for r in c['regions']:
            if not isinstance(r,dict): raise ValueError('區域格式錯誤')
            if r.get('content') not in ('ih','smoke') or type(r.get('enabled')) is not bool or type(r.get('mirror')) is not bool: raise ValueError('區域內容錯誤')
            if r.get('resolution') not in (640,1280,1920): raise ValueError('解析度錯誤')
            for k,a,b in [('aspect',.25,4),('zoom',1,4),('panX',0,1),('panY',0,1),('brightness',0,1.5),('layer',0,3),('lineWidth',.5,3)]:
                if not number(r.get(k,1 if k=='lineWidth' else None),a,b): raise ValueError('設定數值錯誤：'+k)
            q=r.get('points')
            if not isinstance(q,list) or len(q)!=4 or any(not isinstance(v,list) or len(v)!=2 or any(not number(n,0,1) for n in v) for v in q): raise ValueError('四角格式錯誤')
            for i,a in enumerate(q):
                b,d=q[(i+1)%4],q[(i+2)%4]
                if (b[0]-a[0])*(d[1]-b[1])-(b[1]-a[1])*(d[0]-b[0])<=.00002: raise ValueError('四角不可交叉或重疊')
        return c
    def _read(self):
        errors=[]
        for name in ('mapping.json','mapping.previous.json'):
            f=self.directory/name
            if not f.exists(): continue
            try:
                raw=f.read_bytes();c=self.validate(json.loads(raw))
                return {'config':c,'revision':hashlib.sha256(raw).hexdigest(),'recovered':name!='mapping.json'},raw
            except (ValueError,OSError) as e: errors.append(str(e))
        if errors: raise ValueError('現場設定與備份無法讀取；請匯入已匯出的備份')
        return {'config':None,'revision':None,'recovered':False},None
    def read(self):
        with self.lock: return self._read()[0]
    def _atomic(self,name,data):
        fd,path=tempfile.mkstemp(prefix='.mapping-',dir=self.directory)
        try:
            with os.fdopen(fd,'wb') as f: f.write(data);f.flush();os.fsync(f.fileno())
            os.replace(path,self.directory/name)
            if os.name!='nt':
                directory_fd=os.open(self.directory,os.O_RDONLY)
                try: os.fsync(directory_fd)
                finally: os.close(directory_fd)
        finally:
            if os.path.exists(path):os.unlink(path)
    def write(self,c,revision):
        self.validate(c)
        data=(json.dumps(c,ensure_ascii=False,allow_nan=False,indent=2)+'\n').encode()
        with self.lock:
            prior,raw=self._read()
            if revision!=prior['revision']: raise Conflict('其他頁面已更新現場設定；請先匯出你的調整，再重新載入')
            self.directory.mkdir(parents=True,exist_ok=True)
            if raw:self._atomic('mapping.previous.json',raw)
            self._atomic('mapping.json',data)
            # First installation also gets a recovery copy.
            if raw is None:self._atomic('mapping.previous.json',data)
            return self._read()[0]

store=ProfileStore()
def handle_mapping(handler):
    if handler.path.split('?')[0]!='/api/mapping/config':return False
    try:
        if handler.command=='GET':handler.reply(store.read());return True
        if handler.headers.get('Origin')!='http://'+handler.headers.get('Host',''):
            handler.reply({'error':'origin rejected'},403);return True
        size=int(handler.headers.get('Content-Length',0))
        if not 0<size<=65536:raise ValueError('設定檔過大')
        data=json.loads(handler.rfile.read(size))
        if not isinstance(data,dict) or 'revision' not in data:raise ValueError('缺少設定版本')
        handler.reply(store.write(data.get('config'),data['revision']))
    except Conflict as e:handler.reply({'error':str(e)},409)
    except (ValueError,TypeError) as e:handler.reply({'error':str(e)},400)
    except OSError:handler.reply({'error':'電腦寫入失敗，請檢查磁碟空間並匯出備份'},500)
    return True
