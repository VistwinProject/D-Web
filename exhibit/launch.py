#!/usr/bin/env python3
"""C/D 展場啟動器：開服務、把每個輸出用 Chrome kiosk 全螢幕放到指定螢幕。

  python3 D-Web/exhibit/launch.py screens        列出 macOS 看到的螢幕與序號
  python3 D-Web/exhibit/launch.py identify       在每台外接螢幕顯示大編號與序號，認出哪台是哪台
  python3 D-Web/exhibit/launch.py start C        開 C 區（窗景左右電視＋睡眠劇場投影）
  python3 D-Web/exhibit/launch.py start D        開 D 區（左右直立屏＋煙霧/IH 投影）
  python3 D-Web/exhibit/launch.py calibrate D    只把投影機切到校正模式（打開 mapping 校正面板）
  python3 D-Web/exhibit/launch.py start D projector   只重開指定輸出（例如校正完切回投影畫面）
  python3 D-Web/exhibit/launch.py backup-mapping 把這台電腦的 D 投影現場校正複製進 repo（exhibit/mapping.json）
  python3 D-Web/exhibit/launch.py pause          暫停展演：關掉全部畫面、看守程式停手，方便操作電腦
  python3 D-Web/exhibit/launch.py resume         繼續展演：照上次的區域重新放好全部畫面
  python3 D-Web/exhibit/launch.py stop           關掉所有 kiosk 視窗與本工具開的服務
  python3 D-Web/exhibit/launch.py console        在目前的 Chrome 開控制台

outputs.json 的 screen 建議寫 "serial:序號"：序號是螢幕 EDID 裡的硬體序號，
不受接上順序、重開機或主螢幕拔掉影響；同型號的兩台電視名稱（1）（2）則可能對調。

start 會一併啟動看守程式（watch）：畫面被蓋住、跑到別的螢幕、程式掛掉或螢幕排列改變時，
自動把該畫面放回正確位置。暫停展演時看守程式不動作。展演畫面左上角連點三下可叫出暫停選單。

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
SESSION = RUNTIME / 'session.json'      # 目前哪一區、是否暫停、每個輸出開的網址
WINLIST_SRC = HERE / 'winlist.swift'
# D 投影現場校正：D 服務存在這台電腦的設定目錄；repo 裡的 mapping.json 是備份，新電腦第一次啟動時套用
MAPPING_BACKUP = HERE / 'mapping.json'
MAPPING_DIR = Path(os.environ.get('D_MAPPING_CONFIG_DIR', Path.home() / '.d-web-installation'))
WINLIST_BIN = RUNTIME / 'winlist'
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
    RUNTIME.mkdir(parents=True, exist_ok=True)
    PIDS.write_text(json.dumps(p, indent=1))


def load_session():
    try:
        return json.loads(SESSION.read_text())
    except (OSError, ValueError):
        return {}


def save_session(s):
    RUNTIME.mkdir(parents=True, exist_ok=True)
    SESSION.write_text(json.dumps(s, ensure_ascii=False, indent=1))


def alive(pid):
    try:
        os.kill(pid, 0)
        return True
    except (ProcessLookupError, PermissionError, TypeError):
        return False


_winlist_failed = False


def windows():
    """Chrome 視窗清單 [(pid, x, y, w, h, onscreen)]；查不到時回傳 None（只做程式存活檢查）。"""
    global _winlist_failed
    if _winlist_failed:
        return None
    if not WINLIST_BIN.exists() or WINLIST_BIN.stat().st_mtime < WINLIST_SRC.stat().st_mtime:
        try:
            RUNTIME.mkdir(parents=True, exist_ok=True)
            subprocess.run(['swiftc', '-O', str(WINLIST_SRC), '-o', str(WINLIST_BIN)],
                           check=True, capture_output=True, timeout=300)
        except (OSError, subprocess.SubprocessError):
            _winlist_failed = True
            return None
    try:
        out = subprocess.run([str(WINLIST_BIN)], capture_output=True, text=True, timeout=5).stdout
    except (OSError, subprocess.SubprocessError):
        return None
    return [tuple(int(v) for v in line.split()) for line in out.splitlines() if len(line.split()) == 6]


def seed_mapping():
    """這台電腦還沒有 D 投影校正時，套用 repo 裡的備份；已經有的話不動。"""
    if not MAPPING_BACKUP.exists() or any((MAPPING_DIR / n).exists() for n in ('mapping.json', 'mapping.previous.json')):
        return
    MAPPING_DIR.mkdir(parents=True, exist_ok=True)
    target = MAPPING_DIR / 'mapping.json'
    target.write_bytes(MAPPING_BACKUP.read_bytes())
    target.chmod(0o600)
    print(f'  ✓ 套用 repo 裡的 D 投影校正備份 → {target}')


def cmd_backup_mapping():
    source = MAPPING_DIR / 'mapping.json'
    if not source.exists():
        sys.exit(f'這台電腦還沒有 D 投影現場校正（{source}）：先在校正畫面按「儲存為現場設定」')
    MAPPING_BACKUP.write_bytes(source.read_bytes())
    print(f'已備份到 {MAPPING_BACKUP}，記得 commit 並推上去')


def ensure_watch(pids):
    if alive(pids.get('watch')):
        return
    LOGS.mkdir(parents=True, exist_ok=True)
    log = open(LOGS / 'watch.log', 'ab')
    pids['watch'] = subprocess.Popen([sys.executable, '-I', str(Path(__file__).resolve()), 'watch'],
                                     stdout=log, stderr=subprocess.STDOUT, start_new_session=True).pid
    print(f'  ✓ 看守程式（畫面跑掉自動放回）  (pid {pids["watch"]})')


def ensure_service(name, pids):
    svc = SERVICES[name]
    if port_open(svc['port']):
        print(f'  · {name} 服務已在 {svc["port"]} 執行，沿用')
        return
    LOGS.mkdir(parents=True, exist_ok=True)
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


def cmd_start(zone, calibrate=False, only=()):
    cfg = json.loads(CONFIG.read_text())
    if zone not in cfg:
        sys.exit(f'outputs.json 沒有 {zone} 區')
    outputs = cfg[zone]
    if calibrate:  # 只重開有 calibrate_url 的輸出（投影機），其他畫面不動
        outputs = {k: {**v, 'url': v['calibrate_url']} for k, v in outputs.items() if 'calibrate_url' in v}
        if not outputs:
            sys.exit(f'{zone} 區沒有可校正的輸出（outputs.json 沒有 calibrate_url）')
    if only:
        unknown = set(only) - set(outputs)
        if unknown:
            sys.exit(f'{zone} 區沒有輸出：{", ".join(unknown)}（可用：{", ".join(outputs)}）')
        outputs = {k: v for k, v in outputs.items() if k in only}
    all_screens = screens()
    plan = []
    for name, out in outputs.items():
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
    for name, _, screen in plan:
        if screen['main']:
            print(f'  ! {name} 所在的「{screen["name"]}」是主螢幕：選單列、通知與其他 App 視窗會開在這台，'
                  '可能蓋住展演畫面（建議用 HDMI 假螢幕插頭當主螢幕）')
    pids = load_pids()
    print(f'{zone} 區服務：')
    if zone == 'D':
        seed_mapping()
    for name in ZONE_SERVICES[zone]:
        ensure_service(name, pids)
    print(f'{zone} 區輸出：')
    for name in (outputs if calibrate or only else ['']):
        stop_kiosks(f'{zone}-{name}')
    stop_kiosks('identify-')
    time.sleep(0.5)
    for name, url, screen in plan:
        open_kiosk(f'{zone}-{name}', url, screen, pids)
    session = load_session()
    if session.get('zone') != zone or not (calibrate or only):
        session['outputs'] = {}
    session['zone'] = zone
    if not (calibrate or only):  # 只重開某幾個輸出時不動暫停狀態：暫停中單開投影機，不會把其他畫面也拉回來
        session['paused'] = False
    for name, url, _ in plan:
        session['outputs'][name] = {'url': url, 'screen': outputs[name]['screen']}
    save_session(session)
    ensure_watch(pids)
    if 'caffeinate' not in pids:
        pids['caffeinate'] = subprocess.Popen(['caffeinate', '-di'], stdout=subprocess.DEVNULL,
                                              stderr=subprocess.DEVNULL, start_new_session=True).pid
        print('  ✓ 展演期間不讓螢幕睡眠（caffeinate）')
    save_pids(pids)
    print('\n控制台：http://127.0.0.1:8790/exhibit/console.html（python3 D-Web/exhibit/launch.py console）')
    print('暫停展演（關掉畫面、方便操作電腦）：在任一展演畫面左上角連點三下，'
          '或 python3 D-Web/exhibit/launch.py pause')


def cmd_pause():
    session = load_session()
    session['paused'] = True
    save_session(session)
    n = stop_kiosks()
    print(f'已暫停展演：關閉 {n} 個畫面程序，看守程式暫停。繼續：python3 D-Web/exhibit/launch.py resume')


def cmd_resume():
    zone = load_session().get('zone')
    if zone not in ZONE_SERVICES:
        sys.exit('沒有上次的展演紀錄，請用 start C 或 start D')
    cmd_start(zone)


def log(msg):
    print(time.strftime('%Y-%m-%d %H:%M:%S'), msg, flush=True)


def relaunch(zone, name, entry, all_screens):
    screen = pick_screen(entry['screen'], all_screens)
    if screen is None:
        return
    stop_kiosks(f'{zone}-{name}')
    pids = load_pids()
    open_kiosk(f'{zone}-{name}', entry['url'], screen, pids)
    save_pids(pids)


def cmd_watch():
    """每 4 秒檢查一次；同一個問題連續兩次才動手，剛放好的畫面給 15 秒緩衝。"""
    log('看守程式啟動')
    last_sig, grace, strikes = None, {}, {}
    while True:
        time.sleep(4)
        try:
            session = load_session()
            zone, outs = session.get('zone'), session.get('outputs') or {}
            if session.get('paused') or zone not in ZONE_SERVICES or not outs:
                last_sig = None
                continue
            all_screens = screens()
            sig = sorted((x['serial'], x['left'], x['top'], x['w'], x['h']) for x in all_screens)
            if last_sig is not None and sig != last_sig:
                log('螢幕排列改變，3 秒後全部重新放置')
                time.sleep(3)
                all_screens = screens()
                sig = sorted((x['serial'], x['left'], x['top'], x['w'], x['h']) for x in all_screens)
                for name, entry in outs.items():
                    relaunch(zone, name, entry, all_screens)
                    grace[name] = time.time() + 15
                last_sig = sig
                continue
            last_sig = sig
            wins, pids, now = windows(), load_pids(), time.time()
            for name, entry in outs.items():
                screen = pick_screen(entry['screen'], all_screens)
                if grace.get(name, 0) > now or screen is None:
                    continue
                pid, problem = pids.get(f'kiosk:{zone}-{name}'), None
                if not alive(pid):
                    problem = '畫面程式不在'
                elif wins is not None:
                    mine = [w for w in wins if w[0] == pid]
                    if not mine:
                        problem = '找不到畫面視窗'
                    else:
                        _, x, y, w, h, on = mine[0]
                        cx, cy = x + w / 2, y + h / 2
                        if not (screen['left'] <= cx < screen['left'] + screen['w'] and
                                screen['top'] <= cy < screen['top'] + screen['h']):
                            problem = '跑到別的螢幕'
                        elif not on:
                            problem = '被其他視窗蓋住'
                strikes[name] = strikes.get(name, 0) + 1 if problem else 0
                if strikes[name] >= 2:
                    log(f'{name}：{problem}，重新放回「{screen["name"]}」')
                    relaunch(zone, name, entry, all_screens)
                    grace[name], strikes[name] = time.time() + 15, 0
        except SystemExit as e:
            log(f'略過這一輪：{e}')
        except Exception as e:  # 看守程式不能因為一次錯誤就停
            log(f'錯誤：{e!r}')


def cmd_stop():
    n = stop_kiosks()
    pids = load_pids()
    SESSION.unlink(missing_ok=True)
    for key, pid in pids.items():
        if key.startswith('svc:') or key in ('caffeinate', 'watch'):
            try:
                os.killpg(pid, signal.SIGTERM)
            except (ProcessLookupError, PermissionError):
                pass
    PIDS.unlink(missing_ok=True)
    print(f'已關閉 {n} 個 kiosk 程序與本工具啟動的服務（沿用的既有服務不動）')


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in ('screens', 'identify', 'start', 'calibrate', 'stop', 'console',
                                                'pause', 'resume', 'watch', 'backup-mapping'):
        print(__doc__)
        return
    if sys.argv[1] == 'screens':
        cmd_screens()
    elif sys.argv[1] == 'identify':
        cmd_identify('--all' in sys.argv)
    elif sys.argv[1] in ('start', 'calibrate'):
        if len(sys.argv) < 3 or sys.argv[2].upper() not in ZONE_SERVICES:
            sys.exit(f'用法：launch.py {sys.argv[1]} C|D')
        cmd_start(sys.argv[2].upper(), calibrate=sys.argv[1] == 'calibrate', only=tuple(sys.argv[3:]))
    elif sys.argv[1] == 'stop':
        cmd_stop()
    elif sys.argv[1] == 'pause':
        cmd_pause()
    elif sys.argv[1] == 'resume':
        cmd_resume()
    elif sys.argv[1] == 'watch':
        cmd_watch()
    elif sys.argv[1] == 'backup-mapping':
        cmd_backup_mapping()
    else:
        pids = load_pids()
        ensure_service('kit', pids)
        save_pids(pids)
        subprocess.run(['open', '-a', 'Google Chrome', 'http://127.0.0.1:8790/exhibit/console.html'])


if __name__ == '__main__':
    main()
