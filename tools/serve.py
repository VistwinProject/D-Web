"""D-Web static + authoritative exhibition clock. Python stdlib only."""
import argparse, json, time, threading, functools, uuid
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from mapping_store import handle_mapping

show_file = Path(__file__).resolve().parents[1] / 'show.json'
SHOW = json.loads(show_file.read_text(encoding='utf-8')) if show_file.exists() else {}
STARTS = SHOW.get('starts', [0, 12, 24, 40, 56, 72])
DURATION = SHOW.get('duration', 90)
METRICS = ['co2','hcho','tvoc','pm1','pm25','pm10']
NORMAL = [480,.03,.2,8,10,20]
TARGETS = [NORMAL,NORMAL,[900,.07,2.5,100,200,150],[650,.045,.8,35,60,65],NORMAL,NORMAL]
lock = threading.Lock()
state = dict(time=0., playing=False, values=None, mode='auto')
anchor = time.monotonic()
epoch = uuid.uuid4().hex
revision = 0
outputs = {}
x_commands = {}
control_history = []
x_controlled = False


def x_status():
    s = snapshot()
    live = {side: bool(outputs.get(side) and time.monotonic()-outputs[side]['seen'] < 4 and outputs[side]['ready']) for side in ('left','right')}
    last = list(x_commands.values())[-1] if x_commands else None
    if last and last['state'] == 'accepted':
        if revision > last['revision']:
            last.update(state='rejected', note='開始或播放操作被另一個控制覆蓋，請確認 D 播放頁的語音與其他分頁')
        elif all(live[side] and outputs[side]['revision'] == last['revision'] for side in live):
            last['state'] = 'applied'
        elif time.monotonic() - last['issued'] > 4:
            last['state'] = 'unknown'
    chapter = max(i for i,start in enumerate(STARTS) if s['time'] >= start)
    return dict(protocol='x-playback-v1', zoneId='D', epoch=epoch, ready=all(live.values()),
        playback=dict(position=s['time'],duration=DURATION,playing=s['playing'],complete=s['time']>=DURATION,
            chapter=chapter+1,title=['隱形風險','正常偵測','烹飪污染','AI 提醒','正壓守護','持續淨化'][chapter],mode=s['mode']),
        outputs=[dict(id=side,ready=ready,visible=outputs.get(side,{}).get('visible'),rendering=outputs.get(side,{}).get('rendering')) for side,ready in live.items()],
        command={k:v for k,v in last.items() if k!='issued'} if last else None,
        recentControls=control_history[-8:],
        scope='左右屏時間軸與頁面回報；IH 獨立投影、音訊授權與實體設備未驗證')


def x_report(p):
    side, identity = p.get('side'), p.get('instance')
    if side not in ('left','right') or not isinstance(identity,str) or not 1<=len(identity)<=80:
        raise ValueError('invalid output')
    old = outputs.get(side)
    if old and old['id'] != identity and time.monotonic()-old['seen'] < 4:
        return {'error':'同一輸出已有主頁，請勿重複開啟'},409
    if p.get('epoch') != epoch: return {'epoch':epoch},200
    if type(p.get('revision')) is not int or type(p.get('ready')) is not bool:
        raise ValueError('invalid report')
    outputs[side] = dict(id=identity,seen=time.monotonic(),ready=p['ready'],revision=p['revision'],
        visible=p.get('visible'),rendering=p.get('rendering'))
    return {'epoch':epoch},200


def x_control(p):
    global x_controlled
    current = x_status()
    if p.get('epoch') != epoch: return {'error':'服務已重開，請重新取得狀態'},409
    cid, operation = p.get('id'),p.get('operation')
    if not isinstance(cid,str) or not 1<=len(cid)<=80 or operation not in ('start','play','pause','replay','standby'):
        raise ValueError('invalid operation')
    if cid in x_commands: return {k:v for k,v in x_commands[cid].items() if k!='issued'},200
    if not current['ready']: return {'error':'左右播放頁尚未全部就緒'},503
    if current['command'] and current['command']['state']=='accepted': return {'error':'上一個操作尚未完成'},409
    if operation=='play' and current['playback']['complete']: return {'error':'展演已結束，請按重播'},409
    command({'cmd':operation})
    x_controlled = True
    x_commands[cid]=dict(id=cid,state='accepted',revision=revision,issued=time.monotonic())
    while len(x_commands)>100: x_commands.pop(next(iter(x_commands)))
    return {k:v for k,v in x_commands[cid].items() if k!='issued'},202

def snapshot():
    global anchor
    elapsed = time.monotonic()-anchor if state['playing'] else 0
    t = state['time']+elapsed
    start_scene = max(i for i,s in enumerate(STARTS) if state['time'] >= s)
    boundary = (STARTS+[DURATION])[start_scene+1]
    end = boundary if state['mode'] in ('wait','hold') else DURATION
    if t >= end:
        state.update(time=end-.001 if end < DURATION else DURATION, playing=False)
        t=state['time']; anchor=time.monotonic()
    return {**state, 'time':t, 'stamp':time.monotonic(), 'epoch':epoch, 'revision':revision}

def command(p):
    global anchor, revision
    s=snapshot(); t=s['time']; i=max(i for i,v in enumerate(STARTS) if t>=v)
    c=p.get('cmd',p.get('command',''))
    if c in ('goto','stage','scene'):
        n=int(p.get('stage',p.get('n',p.get('value',0))))
        if not 1 <= n <= 6: raise ValueError('scene must be 1..6')
        t=STARTS[n-1]
    elif c in ('next','trigger','advance'):
        t=STARTS[min(i+1,5)]
        if state['mode']=='wait': state['playing']=True
    elif c=='prev': t=STARTS[max(i-1,0)]
    elif c=='seek': t=max(0,min(DURATION-.001,float(p['time'])))
    elif c in ('start','replay'):
        if c=='replay' or not state['playing']: t=0
        state.update(playing=True,values=None,mode='auto')
    elif c=='standby': t=0; state.update(playing=False,values=None,mode='auto')
    elif c=='reset': t=0; state.update(playing=True,values=None)
    elif c=='play': state['playing']=True
    elif c=='pause': state['playing']=False
    elif c=='mode':
        if p['value'] not in ('auto','hold','wait'): raise ValueError('invalid mode')
        state['mode']=p['value']
    elif c=='simulate': state['values']=None
    elif c=='data':
        begin=SHOW.get('events',{}).get('heatOn',STARTS[i]) if i==2 else SHOW.get('events',{}).get('exhaustOn',STARTS[i]) if i==3 else STARTS[i]
        f=max(0,(t-begin)/((STARTS+[DURATION])[i+1]-begin)); e=f*f*(3-2*f)
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
    state['time']=t; anchor=time.monotonic(); revision+=1
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
        if handle_mapping(self): return
        if self.path.split('?')[0]=='/api/x/status':
            with lock: self.reply(x_status())
        elif self.path.split('?')[0]=='/api/state':
            with lock: self.reply(snapshot())
        elif self.path.split('?')[0] in ('/film.mp4','/assets/film/pollution-red.mp4','/assets/film/negative-pressure.mp4','/assets/film/purification-green.mp4','/assets/audio/theatre-voice.wav','/assets/audio/theatre-mix.wav','/assets/audio/theatre-mix.mp3'):
            relative=self.path.split('?')[0].lstrip('/')
            file=Path(self.directory)/relative
            if not file.is_file():return self.send_error(404)
            size=file.stat().st_size
            start,end=0,size-1
            import re
            requested=self.headers.get('Range')
            if requested:
                match=re.fullmatch(r'bytes=(\d+)-(\d*)',requested)
                if not match: return self.reply({'error':'invalid range'},416)
                start=int(match[1]);end=min(size-1,int(match[2]) if match[2] else size-1)
                if start>end: return self.reply({'error':'invalid range'},416)
            self.send_response(206 if requested else 200)
            self.send_header('Content-Type','audio/wav' if relative.endswith('.wav') else 'audio/mpeg' if relative.endswith('.mp3') else 'video/mp4');self.send_header('Accept-Ranges','bytes')
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
        if handle_mapping(self): return
        if self.path not in ('/api/state','/api/x/control','/api/x/report'): return self.reply({'error':'not found'},404)
        if self.headers.get('Origin') not in (None,'http://'+self.headers.get('Host','')):
            return self.reply({'error':'origin rejected'},403)
        try:
            length=int(self.headers.get('Content-Length',0))
            if not 0<length<=8192: raise ValueError('invalid body')
            p=json.loads(self.rfile.read(length))
            if not isinstance(p,dict): raise ValueError('invalid payload')
            with lock:
                if self.path=='/api/x/control': result,code=x_control(p)
                elif self.path=='/api/x/report': result,code=x_report(p)
                else:
                    # Once X owns this clock, stale pages must not silently override it.
                    # Updated local operator controls explicitly identify their protocol.
                    if x_controlled and p.get('controlProtocol') != 'd-local-v2':
                        return self.reply({'error':'此展演由 X 控制；請更新 D 頁面後再使用本機按鈕'},409)
                    result,code=command(p),200
                    from urllib.parse import urlsplit, parse_qs
                    ref = urlsplit(self.headers.get('Referer',''))
                    query = parse_qs(ref.query)
                    control_history.append(dict(operation=p.get('cmd',p.get('command')), revision=revision,
                        page=ref.path, x=query.get('x',[''])[0], audio=query.get('audio',[''])[0], source=p.get('source','page')))
                    del control_history[:-8]
            self.reply(result,code)
        except (ValueError,TypeError,KeyError,OverflowError): self.reply({'error':'invalid command'},400)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8776)
    parser.add_argument('--host',default='127.0.0.1');a=parser.parse_args()
    root=Path(__file__).resolve().parent.parent
    print(f'D-Web: http://{a.host}:{a.port}/Dweb.html',flush=True)
    ThreadingHTTPServer((a.host,a.port),functools.partial(Handler,directory=str(root))).serve_forever()
