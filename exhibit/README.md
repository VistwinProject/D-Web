# C・D 展場輸出工具

一台 Mac 透過 USB-C 四口 HDMI hub（DisplayLink）接兩台直立電視和一台投影機，用 Chrome kiosk 把 C、D 區的網頁全螢幕放到正確的螢幕上。三個展演 repo 的程式都不改，旋轉、隱藏播放列和同步都在這個工具裡處理。

| 區 | 左電視 | 右電視 | 投影機 |
|---|---|---|---|
| C | 數位窗景・左半 | 數位窗景・右半 | 睡眠劇場 3D |
| D | 數據與字幕 | 3D 廚房 | 煙霧＋IH 空間投影（`mapping.html`） |

## 換到新電腦

### 1. 放好三個 repo

這個工具在 D-Web 的 `exhibit/` 資料夾（`exhibit-kit` 分支）。三個 repo 要放在同一個資料夾：

```bash
mkdir VistwinProject && cd VistwinProject
git clone -b exhibit-kit https://github.com/VistwinProject/D-Web.git
git clone https://github.com/VistwinProject/C-Web.git
git clone https://github.com/VistwinProject/C-Digital-Window-demo.git
```

C 區窗景要背景影片（約 290 MB，不在 git 裡）：

```bash
sh D-Web/exhibit/fetch_videos.sh
```

### 2. 電腦需要的東西

- Google Chrome
- Python 3（macOS 執行一次 `python3` 會提示安裝命令列工具）
- DisplayLink Manager：裝好後要**走完設定精靈**，並在「系統設定 › 隱私權與安全性 › 螢幕與系統錄音」打開 DisplayLink Manager。沒給權限的話，hub 上的螢幕不會出現。

### 3. 確認螢幕

```bash
python3 D-Web/exhibit/launch.py screens     # 列出螢幕與硬體序號
python3 D-Web/exhibit/launch.py identify    # 每台外接螢幕顯示大編號，用來對位置
```

`outputs.json` 用硬體序號指定螢幕，同樣兩台電視搬到新電腦序號不變：左 `serial:16780800`、右 `serial:16780933`。投影機用名稱 `Optoma`。換了電視的話，看 `screens` 的序號改這個檔。

### 4. 開始

```bash
python3 D-Web/exhibit/launch.py start D     # 或 start C
python3 D-Web/exhibit/launch.py console     # 在 Chrome 開控制台
python3 D-Web/exhibit/launch.py stop        # 全部關掉
```

控制台網址是 `http://127.0.0.1:8790/exhibit/console.html`，提供以下功能：

- **劇場控制**：C、D 劇場的開始、暫停、繼續、重播、回待機。
- **自動循環**：頁面就緒後自動開始，播完停 N 秒再重播。中途手動暫停的話，不會自動接續。
- **窗景切換**：影片 1–9、面板樣式。左右兩台會一起切。
- **螢幕方向**：每台電視和投影機各自設定 0、90、-90、180 度，按下立即生效並記住。

## 目前現場設定

- `display.json`：螢幕方向。D 左 -90、D 右 90、D 投影 0（C 窗景左右跟同一台電視一樣）。
- `autoplay.json`：自動循環。目前 D 開、C 關，片尾停 10 秒。
- `outputs.json`：哪個輸出放哪台螢幕、開哪個網址。

## D 區投影（IH 與煙霧）校正

投影機跑的是 D repo 的 `mapping.html`（可調整的新版）。舊版 `ih.html` 只有爐面開關示意，不能對位。校正步驟：

1. 在投影畫面點一下，按 **F** 開啟校正。
2. 選 IH 區或煙霧區，把四個角拖到實體位置。
3. 按「**儲存為現場設定**」，看到「已存入此電腦」才算存好。
4. 按「**投影**」隱藏介面。

校正結果存在**那台電腦**的 `~/.d-web-installation/mapping.json`，不在這個 repo 裡。換電腦後要重新校正，或在校正面板用「匯出設定／匯入設定」搬過去。詳見 `D-Web/MAPPING.md`。

## 埠與元件

| 埠 | 用途 |
|---|---|
| 8765 | C-Web 服務（repo 自帶 `tools/serve.py`） |
| 8776 | D-Web 服務（repo 自帶 `tools/serve.py`，劇場時鐘） |
| 8790 | 本工具：控制台、窗景頁、X API 轉送、方向與自動循環設定 |
| 8780 | C 投影代理：隱藏 C 劇場的播放列，並提供旋轉外框 |
| 8781 | D 代理：直立屏與投影的旋轉外框，跟 D 頁面同源 |
| 8787 | 窗景左右同步中繼（WebSocket） |

服務都只綁 127.0.0.1。`launch.py start` 會在服務沒開時自動啟動，並用 `caffeinate` 防止螢幕睡眠。每台電腦各自產生的 Chrome 設定檔、日誌與 pid 放在上層資料夾的 `.exhibit-runtime/`，不在 repo 裡。

`display.json`、`autoplay.json` 會在控制台調整時被改寫；現場調好後記得 commit，換電腦才會帶著走。

## 已知事項

- D 的舞台是 1:1 正方形（1920×1920），兩屏併起來寬 2160，所以每台外側各有約 120px 黑邊。這是 D repo 原本的設計。
- 開機自動啟動、斷電恢復、長時間運轉還沒在正式主機上設定與驗證。
