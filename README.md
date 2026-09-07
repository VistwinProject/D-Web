# D-Web — 寶舖知行案 展區 D「居家風險劇場」影片輪播與空氣數據疊層

單檔 `Dweb.html`，無 build。1:1 舞台（同 C 區窗景）上三段影片依分鏡腳本輪播，舞台左側資訊疊層顯示 AQI、六項空氣指標與趨勢；
按 **F** 開側邊工作面（影片來源 / Trigger 通道 / WebSocket 主用 + HTTP 備援 / 事件日誌）。

```
npx http-server . -p 8099      # 或任何靜態伺服器，開 Dweb.html
```

## 基準畫布

**1:1 舞台，同 C 區窗景**（[`C-Digital-Window/apps/window`](https://github.com/VistwinProject/C-Digital-Window) UI-SPEC §1 / §2.5）。

- 舞台邊長 `S = min(100vw, 100dvh)`，置中於黑底；`.stage` 標記 `container-type`，**訪客面所有尺寸用 `cqw`**（1cqw = 舞台寬 1%），換任何 1:1 螢幕等比縮放，不改任何數值。
- 雙螢幕：兩台直式電視各開**同一個網址**，`L` / `R`（或 `?side=left|right`、面板「舞台 · 雙螢幕」選單）只看完整畫布的左半 / 右半。`S = min(200vw, 100dvh)`，兩台算式相同、只有 `left` 差一個螢幕寬，接縫必然銜接。以 1080×1920 面板為例：合併 2160×1920，舞台 1920×1920 置中，左右外緣各留約 120px 黑邊。
- 位移用 `left` / `top` 直接算，不用 `transform`（玻璃祖先不得有 transform）。
- 工作面 `#panel` 固定在視口、400px，不隨舞台縮。

| | 字級階梯 | 字重 |
|---|---|---|
| 疊層（訪客面，cqw） | **1.2 · 1.4 · 1.6 · 1.9 · 2.4**<br>1080 舞台 = 13 · 15 · 17 · 21 · 26px；1920 舞台 = 23 · 27 · 31 · 36 · 46px | 400 / 500 / 600 |
| 工作面 `#panel`（px） | **11 · 12 · 13 · 15** | 400 / 500 |

無 0.5px 階，相鄰級 ≥ 1.15×。

> **尚未移植的一項**：C 區雙螢幕的**影片時間同步**（`npm run sync` WebSocket 中繼 8787，左半發布、右半以 `playbackRate` 漸進校正）。D-Web 兩台各自輪播，不同步；要上雙螢幕前得把 C 的同步層搬過來或走 X-Controller 統一觸發。

## 字型自帶（展場離線）

`fonts/fonts.css` 由 `tools/build-fonts.mjs` 產生：

- **Inter** — `@fontsource-variable/inter` 可變字型，latin + latin-ext，wght 100–900
- **Chiron Hei HK** — `@fontsource/chiron-hei-hk` 分塊中「本頁用到的中文」所在的塊，再以 pyftsubset 裁到實際字元；四級真實字重 400 / 500 / 600 / 700

**改了頁面上的中文之後要重跑**，否則新字會掉回微軟正黑（只有 400 / 700，字重階層會塌）：

```
node tools/build-fonts.mjs
```

需要本機任一 repo 的 `node_modules/@fontsource/chiron-hei-hk` 與 `@fontsource-variable/inter`（預設路徑寫在腳本開頭，可用 `CHIRON_DIR` / `INTER_DIR` 覆寫），以及 Python `fonttools` + `brotli`。

驗收不要用肉眼：DevTools → Network 勾 Offline → 重新整理 → Elements → Computed 最下方 **Rendered Fonts**。

## 與 Z-Design-System 的對應

值來自 [`Z-Design-System/tokens/`](https://github.com/VistwinProject/Z-Design-System)，**改要一起改**。變數名沿用本頁原名，只換值：

| 這裡 | 值 | Z 來源 |
|---|---|---|
| `--cyan` | `--blue-300 #6fc8f6`（原 `#2fd8ff`，ΔE 4.9） | `blue.css` |
| 分鏡三亮藍 | `--blue-400 #3fb4f0`（原 `#4aa8ff`；E 的 ANLB 藍 = 現場燈條色） | `blue.css` |
| `--ink` / `--ink-2` | `#eaf1ff` / `#cfe2ff` | `stage/_shared.css` |
| `--ink-dim` / `--ink-faint` | `--slate-400 #95aac5` / `--slate-700 #516587` | `blue.css` 藍灰軌 |
| 白 alpha、字距三帶、行高、圓角、線寬、時長 | 十一級 / `.30 .14 .06 .04em` / … | `core.css` |
| `--st-ok` / `--st-warn` / `--st-err` | 只用在 `#panel` 工作面（連線燈、日誌、通道燈） | `semantic.css` |
| `--ease` | `cubic-bezier(.16,1,.3,1)` expo.out | `motion.css` |

- 訪客面一律**藍白單色調**（Z `docs/05` 對 D 的建議）：三個分鏡用 blue.css 不同階的明度區分（靜 · 亮 · 深），數據超標用白階提亮，不用紅 / 橘 / 綠。
- `--violet #8b5cff` 已移除（全區唯一的紫，見 Z `docs/05`）。
- 品牌名用**寶舖**（舖）。
- 玻璃層只剩 `.ibody::before` 一層 backdrop-filter；疊層垂直置中改用 grid，不用 `transform`；側邊面板用 `right` 位移不用 `transform`（Z `glass.css` 三個坑）。
- 文案：眉標 `NN · 英文全大寫`、中文在前英文在後、英文靠內容大寫不用 `text-transform`（E 規範 §10）。

自檢：

```
node ../../Z-Design-System/tools/verify-zone.mjs
```

## 影片

**影片不進 git**（同 C / G 區慣例，見 `.gitignore`）。把檔案放在 repo 根目錄即可自動載入：

| 檔名 | 模式 |
|---|---|
| `film.mp4` | **單支影片**：一支影片依兩個時間點切成三個分鏡（01 從 0 秒起；02 / 03 起點在面板設定或 `?cues=10,20`，留空 = 三等分）。到時間點切疊層分鏡並送出該銜接點 trigger，片尾回 01 |
| `stage1.mp4` / `stage2.mp4` / `stage3.mp4` | **三段**：三支影片交叉淡入，每段結束送 trigger |

目前素材：`D區_smoke_0907_2.mov`（Google Drive，5120×2880 ProRes 422 Proxy，30 秒，無聲）。
瀏覽器播不了 ProRes，要先轉 H.264；ffmpeg 可用 `pip install imageio-ffmpeg` 取得：

```
ffmpeg -i "D區_smoke_0907_2.mov" -vf scale=2560:-2 -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -movflags +faststart -an film.mp4
```

展場 Chrome 請帶 `--autoplay-policy=no-user-gesture-required`（同 kiosk 慣例），否則瀏覽器會擋下靜音自動播放；頁面另有保險：任一鍵或點一下畫面即開始。

⚠ 素材是 16:9，舞台是 1:1（同 C 區窗景）。影片以 `object-fit: cover` 填滿舞台，**左右各裁掉約 22%**，只留中央正方形；接雙螢幕時裁切較少（合併畫布 2160×1920 ≈ 1.125:1）。要保留全幅得改 `contain`（上下黑邊）或請影片端出 1:1 / 1.125:1 版本。

## 對外介面

```
window.Dweb.next() / prev() / goto(n) / play() / pause()
window.Dweb.scene(n)                   強制切分鏡（顏色 / 文案）
window.Dweb.data({co2:700, pm25:200})  外部數據接管
window.Dweb.send(payload)              手動送出 trigger
window.Dweb.onTrigger = fn             接收外部 trigger
postMessage({cmd:'next'})              亦可觸發
```

送出：`{src:'Dweb', junction:'D_T1', type:'stage_end', from:1, to:2, ts}`
接收：`{cmd:'next'}` · `{cmd:'goto', stage:2}` · `{cmd:'play'}` · `{cmd:'pause'}` · `{cmd:'scene', n:2}` ·
`{cmd:'data', co2, hcho, tvoc, pm1, pm25, pm10, alert, sub}`

網址參數：`?trigger=next`、`#goto=2`。快捷鍵：F 開合 · Space 播放/暫停 · 1/2/3 跳段 · N 下一段 · T 送 trigger · Q/W/E 切分鏡配色 · O 疊層開關。

## 分鏡對應

| 眉標 | 中文 | 配色 | 數據走向 |
|---|---|---|---|
| `01 · DETECTION` | 偵測數據啟動 | 靜 · blue-300 / 500 | 正常值 |
| `02 · NEGATIVE PRESSURE` | 負壓防護 | 亮 · blue-100 / 600，近白提亮 | 油煙 → 數值飆升 → 抽油煙機排出 |
| `03 · POSITIVE PRESSURE` | 正壓守護 · 深層淨化 | 深 · blue-400 / 700 | 微正壓 → 曲線下降 → 淨化報告 |

## 相關

- 佔位 repo：[`VistwinProject/D-Home-Risk-Theater`](https://github.com/VistwinProject/D-Home-Risk-Theater) — 展演內容仍在設計公司重新提案中
- 全區總控：[`VistwinProject/X-Controller`](https://github.com/VistwinProject/X-Controller)
- 介面規範：[`VistwinProject/Z-Design-System`](https://github.com/VistwinProject/Z-Design-System)（`ADOPTING.md`）
