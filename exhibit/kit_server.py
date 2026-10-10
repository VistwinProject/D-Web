"""C/D 展場本機輔助服務（只用 Python 標準函式庫，只綁 127.0.0.1）。

- 8790  窗景頁 /C-Digital-Window-demo/（支援 Range）、/exhibit/ 包裝頁與控制台、
        /api/c|d/status|control 轉送到 C(8765)、D(8776) 的 X API。
- 8787  窗景同步中繼（WebSocket）：把每則訊息轉給其他連線，讓分屬不同
        Chrome 的左右兩台電視也能同步。窗景頁預設就連 ws://<host>:8787。
- 8780  C 睡眠劇場投影代理：原樣轉送到 8765，只在 HTML 注入投影用樣式
        （隱藏底部播放列與滑鼠游標）。repo 本身不改。
- 8781  D 直立屏代理：原樣轉送到 8776，並提供 /exhibit/d-screen.html，
        讓旋轉用的包裝頁與 D 頁面同源（語音、隱藏狀態標籤都需要同源）。
- 自動循環播放存在 exhibit/autoplay.json（/exhibit-api/autoplay）：就緒且停在開頭就開始，
        播完等 gap 秒重播；中途手動暫停則不自動接續。
- 螢幕方向存在 exhibit/display.json，各埠 /exhibit-api/display 讀寫；
        控制台切換時經 8787 通知包裝頁即時套用。
"""
import argparse
import base64
import hashlib
import json
import mimetypes
import re
import socket
import socketserver
import struct
import threading
import time
import urllib.error
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent          # D-Web/exhibit → 放所有 repo 的上層資料夾
WINDOW_DIR = ROOT / 'C-Digital-Window-demo'
WWW = HERE / 'www'
ZONES = {'c': 8765, 'd': 8776}
# 播放列拿掉後，主畫面原本預留給它的 84／112px 也一併收回（見 C-Web/floating-ui.css）
PROJECTOR_CSS = ('<style id="exhibit-projector">footer.preview-player{display:none!important}'
                 'body.headerless main.exhibition-stage{height:100dvh!important}'
                 'body.headerless{padding-bottom:0!important}'
                 'html,body,*{cursor:none!important}</style>')

mimetypes.add_type('application/javascript', '.mjs')
mimetypes.add_type('text/plain; charset=utf-8', '.txt')


# ---------- 8790：靜態檔（含 Range）＋ X API 轉送 ----------

def resolve(base, rel):
    target = (base / rel).resolve()
    if base.resolve() not in (target, *target.parents) or '.git' in target.parts:
        return None
    if target.is_dir():
        target = target / 'index.html'
    if not target.is_file() and target.with_suffix('.html').is_file():
        target = target.with_suffix('.html')
    return target if target.is_file() else None


class KitHandler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, *args):
        pass

    def reply(self, code, body, ctype='application/json; charset=utf-8'):
        data = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = self.path.split('?')[0]
        if handle_display(self) or handle_autoplay(self):
            return
        if path == '/':
            self.send_response(302)
            self.send_header('Location', '/exhibit/console.html')
            self.send_header('Content-Length', '0')
            self.end_headers()
        elif path.startswith('/api/'):
            self.proxy_api(path)
        elif path.startswith('/exhibit/'):
            self.send_file(resolve(WWW, path[len('/exhibit/'):]))
        elif path.startswith('/C-Digital-Window-demo/') or path == '/C-Digital-Window-demo':
            self.send_file(resolve(WINDOW_DIR, path[len('/C-Digital-Window-demo/'):]))
        else:
            self.reply(404, {'error': 'not found'})

    def do_POST(self):
        path = self.path.split('?')[0]
        if path == '/exhibit-api/display':
            return handle_display(self)
        if path == '/exhibit-api/autoplay':
            return handle_autoplay(self)
        if not path.startswith('/api/'):
            return self.reply(404, {'error': 'not found'})
        if self.headers.get('Origin') not in (None, 'http://' + self.headers.get('Host', '')):
            return self.reply(403, {'error': 'origin rejected'})
        self.proxy_api(path)

    def proxy_api(self, path):
        m = re.fullmatch(r'/api/([cd])/(status|control)', path)
        if not m or (m[2] == 'control') != (self.command == 'POST'):
            return self.reply(404, {'error': 'not found'})
        url = f'http://127.0.0.1:{ZONES[m[1]]}/api/x/{m[2]}'
        body = None
        if self.command == 'POST':
            size = int(self.headers.get('Content-Length', 0))
            if not 0 < size <= 8192:
                return self.reply(400, {'error': 'invalid body'})
            body = self.rfile.read(size)
        req = urllib.request.Request(url, data=body, method=self.command,
                                     headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=3) as r:
                self.reply(r.status, r.read())
        except urllib.error.HTTPError as e:
            self.reply(e.code, e.read())
        except (urllib.error.URLError, OSError):
            self.reply(503, {'error': f'{m[1].upper()} 區服務未啟動'})

    def send_file(self, file):
        if file is None:
            return reply_json(self, 404, {'error': 'not found'})
        size = file.stat().st_size
        start, end = 0, size - 1
        requested = self.headers.get('Range')
        if requested:
            m = re.fullmatch(r'bytes=(\d*)-(\d*)', requested.strip())
            if not m or not (m[1] or m[2]):
                return reply_json(self, 416, {'error': 'invalid range'})
            if m[1]:
                start = int(m[1])
                end = min(size - 1, int(m[2])) if m[2] else size - 1
            else:
                start = max(0, size - int(m[2]))
            if start > end:
                self.send_response(416)
                self.send_header('Content-Range', f'bytes */{size}')
                self.send_header('Content-Length', '0')
                self.end_headers()
                return
        ctype = mimetypes.guess_type(file.name)[0] or 'application/octet-stream'
        if ctype.startswith('text/html'):
            ctype = 'text/html; charset=utf-8'
        self.send_response(206 if requested else 200)
        self.send_header('Content-Type', ctype)
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Length', str(end - start + 1))
        self.send_header('Cache-Control', 'no-cache')
        if requested:
            self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.end_headers()
        if self.command == 'HEAD':
            return
        try:
            with file.open('rb') as f:
                f.seek(start)
                remaining = end - start + 1
                while remaining:
                    chunk = f.read(min(1 << 16, remaining))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass

    do_HEAD = do_GET


# ---------- 螢幕方向（實體直立、輸出仍是橫向時由網頁旋轉） ----------

DISPLAY_FILE = HERE / 'display.json'
display_lock = threading.Lock()


def load_display():
    try:
        return json.loads(DISPLAY_FILE.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return {}


def save_display(key, rotate):
    with display_lock:
        data = load_display()
        data[key] = rotate
        tmp = DISPLAY_FILE.with_suffix('.tmp')
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding='utf-8')
        tmp.replace(DISPLAY_FILE)
    broadcast(json.dumps({'t': 'display', 'key': key, 'rotate': rotate}).encode())
    return data


def handle_display(handler):
    """GET/POST /exhibit-api/display；各埠共用。回傳 True 表示已處理。"""
    if handler.path.split('?')[0] != '/exhibit-api/display':
        return False
    if handler.command == 'POST':
        try:
            size = int(handler.headers.get('Content-Length', 0))
            p = json.loads(handler.rfile.read(size)) if 0 < size <= 1024 else None
            key, rotate = p['key'], int(p['rotate'])
            if not re.fullmatch(r'[A-Za-z]-[a-z]+', key) or rotate not in (0, 90, -90, 180):
                raise ValueError
        except (ValueError, TypeError, KeyError):
            reply_json(handler, 400, {'error': 'invalid display setting'})
            return True
        reply_json(handler, 200, save_display(key, rotate))
    else:
        reply_json(handler, 200, load_display())
    return True


def reply_json(handler, code, value):
    data = json.dumps(value, ensure_ascii=False).encode()
    handler.send_response(code)
    handler.send_header('Content-Type', 'application/json; charset=utf-8')
    handler.send_header('Cache-Control', 'no-store')
    handler.send_header('Content-Length', str(len(data)))
    handler.end_headers()
    handler.wfile.write(data)


# ---------- 自動循環播放（在服務端跑，控制台沒開也有效） ----------

AUTOPLAY_FILE = HERE / 'autoplay.json'
AUTOPLAY_DEFAULT = {'enabled': False, 'gap': 10}
START_DELAY = 3          # 頁面就緒、停在開頭後等幾秒才自動開始
autoplay_lock = threading.Lock()
autoplay_state = {z: {'note': '關閉', 'since': None} for z in ZONES}


def load_autoplay():
    try:
        data = json.loads(AUTOPLAY_FILE.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        data = {}
    return {z: {**AUTOPLAY_DEFAULT, **data.get(z, {})} for z in ZONES}


def autoplay_view():
    cfg = load_autoplay()
    with autoplay_lock:
        return {z: {**cfg[z], 'note': autoplay_state[z]['note']} for z in ZONES}


def handle_autoplay(handler):
    if handler.path.split('?')[0] != '/exhibit-api/autoplay':
        return False
    if handler.command == 'POST':
        try:
            size = int(handler.headers.get('Content-Length', 0))
            p = json.loads(handler.rfile.read(size)) if 0 < size <= 1024 else None
            zone = p['zone']
            if zone not in ZONES:
                raise ValueError
            with autoplay_lock:
                cfg = load_autoplay()
                if 'enabled' in p:
                    cfg[zone]['enabled'] = bool(p['enabled'])
                if 'gap' in p:
                    cfg[zone]['gap'] = max(0, min(600, int(p['gap'])))
                tmp = AUTOPLAY_FILE.with_suffix('.tmp')
                tmp.write_text(json.dumps(cfg, ensure_ascii=False, indent=1), encoding='utf-8')
                tmp.replace(AUTOPLAY_FILE)
                autoplay_state[zone]['since'] = None
        except (ValueError, TypeError, KeyError):
            reply_json(handler, 400, {'error': 'invalid autoplay setting'})
            return True
    reply_json(handler, 200, autoplay_view())
    return True


def x_call(zone, path, body=None):
    req = urllib.request.Request(f'http://127.0.0.1:{ZONES[zone]}/api/x/{path}',
                                 data=json.dumps(body).encode() if body else None,
                                 method='POST' if body else 'GET', headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=2) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        return json.load(e)


def autoplay_tick(zone, cfg, now):
    st = autoplay_state[zone]
    def note(text, waiting=False):
        st['note'] = text
        if not waiting:
            st['since'] = None
    if not cfg['enabled']:
        return note('關閉')
    try:
        s = x_call(zone, 'status')
    except (urllib.error.URLError, OSError, ValueError):
        return note('服務未啟動')
    pb = s.get('playback') or {}
    if not s.get('ready'):
        return note('等待頁面就緒')
    if s.get('command') and s['command'].get('state') == 'accepted':
        return note('指令執行中')
    if pb.get('playing'):
        return note('播放中')
    if pb.get('complete'):
        op, wait = 'replay', cfg['gap']
    elif (pb.get('position') or 0) < 0.05:
        op, wait = 'start', START_DELAY
    else:
        return note('已手動暫停（不自動接續）')
    st['since'] = st['since'] or now
    left = wait - (now - st['since'])
    if left > 0:
        return note(f'{left:.0f} 秒後{"重播" if op == "replay" else "開始"}', waiting=True)
    x_call(zone, 'control', {'id': str(uuid.uuid4()), 'epoch': s.get('epoch'), 'operation': op})
    note('已送出' + ('重播' if op == 'replay' else '開始'))


def autoplay_loop():
    while True:
        cfg = load_autoplay()
        now = time.monotonic()
        for zone in ZONES:
            with autoplay_lock:
                try:
                    autoplay_tick(zone, cfg[zone], now)
                except Exception as e:  # 不讓單次錯誤停掉整個迴圈
                    autoplay_state[zone]['note'] = f'錯誤：{e}'
        time.sleep(1)


# ---------- 8780 / 8781：同源代理（C 投影、D 直立屏包裝頁） ----------

def make_proxy(upstream, inject_css=''):
    """原樣轉送到 upstream；另外提供 /exhibit/ 包裝頁與 /exhibit-api/，讓包裝頁與展演頁同源。"""

    class Proxy(BaseHTTPRequestHandler):
        protocol_version = 'HTTP/1.1'

        def log_message(self, *args):
            pass

        def handle(self):
            try:
                super().handle()
            except (BrokenPipeError, ConnectionResetError):
                pass

        def forward(self):
            path = self.path.split('?')[0]
            if handle_display(self):
                return
            if path.startswith('/exhibit/') and self.command in ('GET', 'HEAD'):
                return KitHandler.send_file(self, resolve(WWW, path[len('/exhibit/'):]))
            body = None
            if 'Content-Length' in self.headers:
                body = self.rfile.read(int(self.headers['Content-Length']))
            # 不轉條件式請求：否則瀏覽器拿到 304 會沿用舊的（未注入或舊版注入的）HTML
            headers = {k: v for k, v in self.headers.items()
                       if k.lower() not in ('host', 'origin', 'accept-encoding', 'connection', 'referer',
                                            'if-modified-since', 'if-none-match')}
            req = urllib.request.Request(f'http://127.0.0.1:{upstream}{self.path}',
                                         data=body, method=self.command, headers=headers)
            try:
                r = urllib.request.urlopen(req, timeout=10)
            except urllib.error.HTTPError as e:
                r = e
            except (urllib.error.URLError, OSError):
                data = f'上游服務（{upstream}）未啟動'.encode()
                self.send_response(503)
                self.send_header('Content-Type', 'text/plain; charset=utf-8')
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return
            with r:
                ctype = r.headers.get('Content-Type', '')
                html_page = ctype.startswith('text/html')
                skip = {'content-length', 'connection', 'transfer-encoding', 'date', 'server'}
                if html_page:
                    skip |= {'last-modified', 'etag', 'cache-control'}
                    data = r.read()
                    if inject_css:
                        html = data.decode('utf-8', 'replace')
                        html = html.replace('</head>', inject_css + '</head>', 1) if '</head>' in html \
                            else inject_css + html
                        data = html.encode()
                    length = len(data)
                else:
                    length = r.headers.get('Content-Length')
                self.send_response(r.status)
                for k, v in r.headers.items():
                    if k.lower() not in skip:
                        self.send_header(k, v)
                if html_page:
                    self.send_header('Cache-Control', 'no-store')
                if length is not None:
                    self.send_header('Content-Length', str(length))
                else:
                    self.send_header('Connection', 'close')
                    self.close_connection = True
                self.end_headers()
                if self.command == 'HEAD':
                    return
                if html_page:
                    self.wfile.write(data)
                else:  # 影片、音檔用串流，不整檔讀進記憶體
                    while chunk := r.read(1 << 16):
                        self.wfile.write(chunk)

        do_GET = do_POST = do_HEAD = forward

    return Proxy


# ---------- 8787：窗景同步中繼（最小 WebSocket 廣播） ----------

GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
clients = {}
clients_lock = threading.Lock()


def ws_frame(opcode, payload):
    n = len(payload)
    head = bytes([0x80 | opcode])
    if n < 126:
        head += bytes([n])
    elif n < 1 << 16:
        head += bytes([126]) + struct.pack('>H', n)
    else:
        head += bytes([127]) + struct.pack('>Q', n)
    return head + payload


def ws_send(sock, data):
    lock = clients.get(sock)
    if lock is None:
        return
    try:
        with lock:
            sock.sendall(data)
    except OSError:
        pass


def broadcast(text):
    frame = ws_frame(1, text)
    with clients_lock:
        targets = list(clients)
    for c in targets:
        ws_send(c, frame)


def recv_exact(sock, n):
    buf = b''
    while len(buf) < n:
        chunk = sock.recv(n - len(buf))
        if not chunk:
            raise ConnectionError
        buf += chunk
    return buf


class RelayHandler(socketserver.BaseRequestHandler):
    def handle(self):
        sock = self.request
        raw = b''
        while b'\r\n\r\n' not in raw:
            chunk = sock.recv(4096)
            if not chunk or len(raw) > 16384:
                return
            raw += chunk
        headers = {}
        for line in raw.split(b'\r\n')[1:]:
            if b':' in line:
                k, v = line.split(b':', 1)
                headers[k.strip().lower().decode()] = v.strip().decode()
        key = headers.get('sec-websocket-key')
        if not key:
            sock.sendall(b'HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n')
            return
        accept = base64.b64encode(hashlib.sha1((key + GUID).encode()).digest()).decode()
        sock.sendall(('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\n'
                      f'Connection: Upgrade\r\nSec-WebSocket-Accept: {accept}\r\n\r\n').encode())
        with clients_lock:
            clients[sock] = threading.Lock()
        try:
            while True:
                b0, b1 = recv_exact(sock, 2)
                opcode, masked, n = b0 & 0x0F, b1 & 0x80, b1 & 0x7F
                if n == 126:
                    n = struct.unpack('>H', recv_exact(sock, 2))[0]
                elif n == 127:
                    n = struct.unpack('>Q', recv_exact(sock, 8))[0]
                if n > 1 << 20:
                    break
                mask = recv_exact(sock, 4) if masked else b'\0\0\0\0'
                payload = bytes(c ^ mask[i % 4] for i, c in enumerate(recv_exact(sock, n)))
                if opcode == 8:
                    ws_send(sock, ws_frame(8, b''))
                    break
                if opcode == 9:
                    ws_send(sock, ws_frame(10, payload))
                elif opcode == 1:
                    frame = ws_frame(1, payload)
                    with clients_lock:
                        others = [c for c in clients if c is not sock]
                    for c in others:
                        ws_send(c, frame)
        except (ConnectionError, OSError, ValueError):
            pass
        finally:
            with clients_lock:
                clients.pop(sock, None)


class RelayServer(socketserver.ThreadingTCPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--port', type=int, default=8790)
    p.add_argument('--relay-port', type=int, default=8787)
    p.add_argument('--projector-port', type=int, default=8780)
    p.add_argument('--d-port', type=int, default=8781)
    a = p.parse_args()
    servers = [
        ThreadingHTTPServer(('127.0.0.1', a.port), KitHandler),
        ThreadingHTTPServer(('127.0.0.1', a.projector_port), make_proxy(ZONES['c'], PROJECTOR_CSS)),
        ThreadingHTTPServer(('127.0.0.1', a.d_port), make_proxy(ZONES['d'])),
        RelayServer(('127.0.0.1', a.relay_port), RelayHandler),
    ]
    for s in servers:
        s.daemon_threads = True
    for s in servers[1:]:
        threading.Thread(target=s.serve_forever, daemon=True).start()
    threading.Thread(target=autoplay_loop, daemon=True).start()
    print(f'控制台   http://127.0.0.1:{a.port}/exhibit/console.html', flush=True)
    print(f'窗景左   http://127.0.0.1:{a.port}/exhibit/c-window.html?side=left', flush=True)
    print(f'C 投影   http://127.0.0.1:{a.projector_port}/Cweb-3d.html?x=1', flush=True)
    print(f'D 直立屏 http://127.0.0.1:{a.d_port}/exhibit/d-screen.html?side=left', flush=True)
    print(f'同步中繼 ws://127.0.0.1:{a.relay_port}', flush=True)
    servers[0].serve_forever()


if __name__ == '__main__':
    main()
