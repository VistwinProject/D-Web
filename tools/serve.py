"""D-Web static + authoritative exhibition clock. Python stdlib only."""
import argparse, json, time, threading, functools
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

STARTS = [0, 12, 24, 40, 56, 72]
METRICS = ['co2','hcho','tvoc','pm1','pm25','pm10']
NORMAL = [480,.03,.2,8,10,20]
TARGETS = [NORMAL,NORMAL,[900,.07,2.5,100,200,150],[650,.045,.8,35,60,65],NORMAL,NORMAL]
lock = threading.Lock()
state = dict(time=0., playing=True, values=None, mode='auto')
anchor = time.monotonic()

def snapshot():
    global anchor
    elapsed = time.monotonic()-anchor if state['playing'] else 0
    t = state['time']+elapsed
    start_scene = max(i for i,s in enumerate(STARTS) if state['time'] >= s)
    boundary = (STARTS+[90])[start_scene+1]
    if state['mode'] == 'wait' and t >= boundary:
        state.update(time=boundary-.001, playing=False)
        t=state['time']; anchor=time.monotonic()
    elif state['mode'] == 'hold':
        t = STARTS[start_scene]+(t-STARTS[start_scene])%(boundary-STARTS[start_scene])
    else: t %= 90
    return {**state, 'time':t, 'stamp':time.monotonic()}

def command(p):
    global anchor
    s=snapshot(); t=s['time']; i=max(i for i,v in enumerate(STARTS) if t>=v)
    c=p.get('cmd',p.get('command',''))
    if c in ('goto','stage','scene'):
        n=int(p.get('stage',p.get('n',p.get('value',0))))
        if not 1 <= n <= 6: raise ValueError('scene must be 1..6')
        t=STARTS[n-1]
    elif c in ('next','trigger','advance'):
        t=STARTS[(i+1)%6]
        if state['mode']=='wait': state['playing']=True
    elif c=='prev': t=STARTS[(i+5)%6]
    elif c=='seek': t=max(0,min(89.999,float(p['time'])))
    elif c=='reset': t=0; state.update(playing=True,values=None)
    elif c=='play': state['playing']=True
    elif c=='pause': state['playing']=False
    elif c=='mode':
        if p['value'] not in ('auto','hold','wait'): raise ValueError('invalid mode')
        state['mode']=p['value']
    elif c=='simulate': state['values']=None
    elif c=='data':
        f=(t-STARTS[i])/((STARTS+[90])[i+1]-STARTS[i]); e=f*f*(3-2*f)
        before=TARGETS[max(0,i-1)]; after=TARGETS[i]
        vals=(state['values'] or [a+(b-a)*e for a,b in zip(before,after)]).copy()
        import math
        for j,k in enumerate(METRICS):
            v=p.get(k,p.get('values',[])[j] if j<len(p.get('values',[])) else vals[j])
            v=float(v)
            if not math.isfinite(v) or v<0: raise ValueError('invalid metric')
            vals[j]=v
        state['values']=vals
    else: raise ValueError('unknown command')
    state['time']=t; anchor=time.monotonic()
    return snapshot()

class Handler(SimpleHTTPRequestHandler):
    def handle(self):
        try: super().handle()
        except (BrokenPipeError,ConnectionResetError,ConnectionAbortedError): pass
    def log_message(self,*args): pass
    def reply(self,body,status=200):
        data=json.dumps(body,allow_nan=False).encode()
        self.send_response(status); self.send_header('Content-Type','application/json')
        self.send_header('Cache-Control','no-store'); self.send_header('Content-Length',str(len(data)))
        self.end_headers();self.wfile.write(data)
    def do_GET(self):
        if self.path.split('?')[0]=='/api/state':
            with lock: self.reply(snapshot())
        elif self.path.split('?')[0]=='/film.mp4':
            file=Path(self.directory)/'film.mp4';size=file.stat().st_size
            start,end=0,size-1
            import re
            requested=self.headers.get('Range')
            if requested:
                match=re.fullmatch(r'bytes=(\d+)-(\d*)',requested)
                if not match: return self.reply({'error':'invalid range'},416)
                start=int(match[1]);end=min(size-1,int(match[2]) if match[2] else size-1)
                if start>end: return self.reply({'error':'invalid range'},416)
            self.send_response(206 if requested else 200)
            self.send_header('Content-Type','video/mp4');self.send_header('Accept-Ranges','bytes')
            self.send_header('Content-Length',str(end-start+1))
            if requested:self.send_header('Content-Range',f'bytes {start}-{end}/{size}')
            self.end_headers()
            try:
                with file.open('rb') as f:
                    f.seek(start);remaining=end-start+1
                    while remaining:
                        data=f.read(min(65536,remaining))
                        if not data:break
                        self.wfile.write(data);remaining-=len(data)
            except (BrokenPipeError,ConnectionResetError,ConnectionAbortedError):pass
        else: super().do_GET()
    def do_POST(self):
        if self.path!='/api/state': return self.reply({'error':'not found'},404)
        try:
            length=int(self.headers.get('Content-Length',0))
            if not 0<length<=8192: raise ValueError('invalid body')
            p=json.loads(self.rfile.read(length))
            with lock: result=command(p)
            self.reply(result)
        except (ValueError,TypeError,KeyError,OverflowError): self.reply({'error':'invalid command'},400)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8776)
    parser.add_argument('--host',default='127.0.0.1');a=parser.parse_args()
    root=Path(__file__).resolve().parent.parent
    print(f'D-Web: http://{a.host}:{a.port}/Dweb.html',flush=True)
    ThreadingHTTPServer((a.host,a.port),functools.partial(Handler,directory=str(root))).serve_forever()
