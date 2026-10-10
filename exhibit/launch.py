#!/usr/bin/env python3
"""C/D 展場啟動器：開服務、把每個輸出用 Chrome kiosk 全螢幕放到指定螢幕。

  python3 D-Web/exhibit/launch.py screens        列出 macOS 看到的螢幕與序號
  python3 D-Web/exhibit/launch.py identify       在每台外接螢幕顯示大編號與序號，認出哪台是哪台
  python3 D-Web/exhibit/launch.py start C        開 C 區（窗景左右電視＋睡眠劇場投影）
  python3 D-Web/exhibit/launch.py start D        開 D 區（左右直立屏＋煙霧/IH 投影）
  python3 D-Web/exhibit/launch.py stop           關掉所有 kiosk 視窗與本工具開的服務
  python3 D-Web/exhibit/launch.py console        在目前的 Chrome 開控制台

outputs.json 的 screen 建議寫 "serial:序號"：序號是螢幕 EDID 裡的硬體序號，
不受接上順序、重開機或主螢幕拔掉影響；同型號的兩台電視名稱（1）（2）則可能對調。

每個輸出各用一個獨立 Chrome 設定檔（.exhibit-runtime/profiles/），所以位置與全螢幕互不干擾；
窗景左右台靠 kit_server 的同步中繼對齊，D 區左右屏與投影靠 D 服務的時鐘對齊。
"""
import json
import os
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path

# 這個工具放在 D-Web/exhibit/；C-Web、C-Digital-Window-demo 與 D-Web 放在同一個上層資料夾
HERE = Path(__file__).resolve().parent
REPO = HERE.parent
ROOT = REPO.parent
# 每台電腦各自產生的東西放在 repo 外，不進版控、也不會被 D 服務當靜態檔提供
RUNTIME = ROOT / '.exhibit-runtime'
PROFILES = RUNTIME / 'profiles'
LOGS = RUNTIME / 'logs'
PIDS = RUNTIME / 'pids.json'
CONFIG = HERE / 'outputs.json'
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

SERVICES = {
    'c': dict(port=8765, cmd=[sys.executable, str(ROOT / 'C-Web/tools/serve.py'), '--port', '8765']),
    'd': dict(port=8776, cmd=[sys.executable, str(REPO / 'tools/serve.py'), '--port', '8776']),
    'kit': dict(port=8790, cmd=[sys.executable, str(HERE / 'kit_server.py')]),
}
ZONE_SERVICES = {'C': ['c', 'kit'], 'D': ['d', 'kit']}


def screens():
    """回傳螢幕清單，座標換成 Chrome 用的「主螢幕左上角為原點、y 向下」。"""
    script = '''ObjC.import("AppKit");ObjC.import("CoreGraphics");var s=$.NSScreen.screens,o=[];
for(var i=0;i<s.count;i++){var c=s.objectAtIndex(i),f=c.frame,id=ObjC.unwrap(c.deviceDescription.objectForKey("NSScreenNumber"));
o.push({name:ObjC.unwrap(c.localizedName),x:f.origin.x,y:f.origin.y,w:f.size.width,h:f.size.height,
serial:$.CGDisplaySerialNumber(id),model:$.CGDisplayModelNumber(id),vendor:$.CGDisplayVendorNumber(id)})}
JSON.stringify(o)'''
    raw = json.loads(subprocess.check_output(['osascript', '-l', 'JavaScript', '-e', script], text=True))
    main_h = raw[0]['h']
    out = []
    for i, s in enumerate(raw):
        out.append(dict(name=s['name'], main=i == 0, w=int(s['w']), h=int(s['h']),
                        left=int(s['x']), top=int(main_h - (s['y'] + s['h'])),
                        serial=int(s['serial']), model=int(s['model']), vendor=int(s['vendor'])))
    # 編號：0 = 主螢幕；外接螢幕依「系統設定 › 顯示器」的排列由左到右、由上到下
    ext = sorted(out[1:], key=lambda s: (s['left'], s['top']))
    return [out[0], *ext]


def port_open(port):
    with socket.socket() as s:
        s.settimeout(0.3)
        return s.connect_ex(('127.0.0.1', port)) == 0


def load_pids():
    try:
        return json.loads(PIDS.read_text())
    except (OSError, ValueError):
        return {}


def save_pids(p):
    RUNTIME.mkdir(exist_ok=True)
    PIDS.write_text(json.dumps(p, indent=1))


def ensure_service(name, pids):
    svc = SERVICES[name]
    if port_open(svc['port']):
        print(f'  · {name} 服務已在 {svc["port"]} 執行，沿用')
        return
    LOGS.mkdir(exist_ok=True)
    log = open(LOGS / f'{name}.log', 'ab')
    proc = subprocess.Popen(svc['cmd'], stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
    for _ in range(50):
        if port_open(svc['port']):
            break
        time.sleep(0.1)
    else:
        sys.exit(f'  ✗ {name} 服務沒起來，看 {LOGS / (name + ".log")}')
    pids[f'svc:{name}'] = proc.pid
    print(f'  ✓ {name} 服務 http://127.0.0.1:{svc["port"]}  (pid {proc.pid})')


def pick_screen(spec, all_screens):
    if isinstance(spec, str) and spec.startswith('serial:'):
        return next((s for s in all_screens if str(s['serial']) == spec[len('serial:'):].strip()), None)
    if isinstance(spec, int):
        return all_screens[spec] if 0 <= spec < len(all_screens) else None
    for s in all_screens:
        if str(spec).lower() in s['name'].lower():
            return s
    return None


def open_kiosk(key, url, screen, pids):
    profile = PROFILES / key
    profile.mkdir(parents=True, exist_ok=True)
    args = [CHROME, f'--user-data-dir={profile}', '--no-first-run', '--no-default-browser-check',
            '--disable-session-crashed-bubble', '--hide-crash-restore-bubble', '--disable-infobars',
            '--disable-features=Translate,TranslateUI,MediaRouter', '--noerrdialogs',
            '--autoplay-policy=no-user-gesture-required',
            '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
            '--disable-backgrounding-occluded-windows',
            f'--window-position={screen["left"]},{screen["top"]}',
            f'--window-size={screen["w"]},{screen["h"]}', '--kiosk', url]
    proc = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    pids[f'kiosk:{key}'] = proc.pid
    print(f'  ✓ {key:<16} → 螢幕「{screen["name"]}」{screen["w"]}×{screen["h"]}  {url}')


def stop_kiosks(prefix=''):
    """用設定檔路徑找 kiosk Chrome，不碰你平常用的 Chrome。"""
    # kiosk Chrome 常常不理 SIGTERM；沒關乾淨的話，下一次啟動會把網址交給舊程序，
    # 視窗位置與狀態都沿用舊的。所以等不到就 SIGKILL，確定全部結束才回來。
    marker = f'--user-data-dir={PROFILES}/{prefix}'
    find = lambda: [int(p) for p in subprocess.run(['pgrep', '-f', '--', marker],
                                                    capture_output=True, text=True).stdout.split()]
    found = find()
    for sig, wait in ((signal.SIGTERM, 3), (signal.SIGKILL, 3)):
        for pid in find():
            try:
                os.kill(pid, sig)
            except ProcessLookupError:
                pass
        deadline = time.time() + wait
        while find() and time.time() < deadline:
            time.sleep(0.2)
        if not find():
            break
    if find():
        sys.exit('  ✗ 有 kiosk Chrome 關不掉，請手動結束後再試')
    return len(found)


def cmd_screens():
    for i, s in enumerate(screens()):
        tag = '主螢幕' if s['main'] else ('直式' if s['h'] > s['w'] else '橫式')
        print(f'  [{i}] {s["name"]:<16} serial:{s["serial"]:<10} {s["w"]}×{s["h"]}  位置 ({s["left"]},{s["top"]})  {tag}')


def cmd_identify(include_main):
    """每台外接螢幕開一個大編號頁；同時先關掉 C/D 展演視窗，免得被蓋住。"""
    from urllib.parse import urlencode
    pids = load_pids()
    ensure_service('kit', pids)
    stop_kiosks()
    targets = [s for s in screens() if include_main or not s['main']]
    for i, s in enumerate(targets, 1):
        q = urlencode({'n': i, 'name': s['name'], 'serial': s['serial'], 'size': f'{s["w"]}×{s["h"]}'})
        open_kiosk(f'identify-{i}', f'http://127.0.0.1:8790/exhibit/identify.html?{q}', s, pids)
    save_pids(pids)
    print('\n看完告訴我每個編號的實體位置；關掉：python3 D-Web/exhibit/launch.py stop')


def cmd_start(zone):
    cfg = json.loads(CONFIG.read_text())
    if zone not in cfg:
        sys.exit(f'outputs.json 沒有 {zone} 區')
    all_screens = screens()
    plan = []
    for name, out in cfg[zone].items():
        screen = pick_screen(out['screen'], all_screens)
        if screen is None:
            print(f'  ! {name}：找不到螢幕 {out["screen"]!r}（目前 {len(all_screens)} 個），先跳過')
        else:
            plan.append((name, out['url'], screen))
    if not plan:
        sys.exit('  ✗ 沒有任何輸出對得到螢幕，跑 screens 看看')
    used = [p[2]['name'] + str(p[2]['left']) for p in plan]
    if len(set(used)) != len(used):
        sys.exit('  ✗ 有兩個輸出被分到同一個螢幕，請檢查 outputs.json 與 screens 的編號')
    if any(p[2]['main'] for p in plan):
        print('  ! 有輸出被分到主螢幕（編號 0）；外接螢幕可能還沒被 macOS 偵測到')
    pids = load_pids()
    print(f'{zone} 區服務：')
    for name in ZONE_SERVICES[zone]:
        ensure_service(name, pids)
    print(f'{zone} 區輸出：')
    stop_kiosks(f'{zone}-')
    stop_kiosks('identify-')
    time.sleep(0.5)
    for name, url, screen in plan:
        open_kiosk(f'{zone}-{name}', url, screen, pids)
    if 'caffeinate' not in pids:
        pids['caffeinate'] = subprocess.Popen(['caffeinate', '-di'], start_new_session=True).pid
        print('  ✓ 展演期間不讓螢幕睡眠（caffeinate）')
    save_pids(pids)
    print('\n控制台：http://127.0.0.1:8790/exhibit/console.html（python3 D-Web/exhibit/launch.py console）')
    print('退出某個 kiosk 視窗：點它後按 ⌘Q；全部關掉：python3 D-Web/exhibit/launch.py stop')


def cmd_stop():
    n = stop_kiosks()
    pids = load_pids()
    for key, pid in pids.items():
        if key.startswith('svc:') or key == 'caffeinate':
            try:
                os.killpg(pid, signal.SIGTERM)
            except (ProcessLookupError, PermissionError):
                pass
    PIDS.unlink(missing_ok=True)
    print(f'已關閉 {n} 個 kiosk 程序與本工具啟動的服務（沿用的既有服務不動）')


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in ('screens', 'identify', 'start', 'stop', 'console'):
        print(__doc__)
        return
    if sys.argv[1] == 'screens':
        cmd_screens()
    elif sys.argv[1] == 'identify':
        cmd_identify('--all' in sys.argv)
    elif sys.argv[1] == 'start':
        if len(sys.argv) < 3 or sys.argv[2].upper() not in ZONE_SERVICES:
            sys.exit('用法：launch.py start C|D')
        cmd_start(sys.argv[2].upper())
    elif sys.argv[1] == 'stop':
        cmd_stop()
    else:
        pids = load_pids()
        ensure_service('kit', pids)
        save_pids(pids)
        subprocess.run(['open', '-a', 'Google Chrome', 'http://127.0.0.1:8790/exhibit/console.html'])


if __name__ == '__main__':
    main()
