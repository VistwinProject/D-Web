# D 區 · 居家風險劇場

六段、90 秒雙直立屏展演。左屏呈現空氣指標，右屏呈現透明框線廚房與紅色污染、綠色新風粒子。煙霧影片全程常駐。

## 業主分享

GitHub Pages：https://VistwinProject.github.io/D-Web/

首頁進入雙屏預覽，可切換 01–06、暫停、播放及重新開始。靜態預覽以同一瀏覽器的共用時鐘同步兩屏，不需要 Python 服務；沒有連接現場感測器或投影硬體。顯示數據為展演模擬。

## 現場本機

執行 `python tools/serve.py --port 8776`，開啟 `http://127.0.0.1:8776/preview.html`。
兩個實體畫面分別使用 `Dweb.html?side=left`、`Dweb.html?side=right`。跨電腦需連到同一 LAN 同步主機；GitHub Pages 的瀏覽器同步不提供跨電腦同步。保留原 Trigger、WebSocket / HTTP 控制。

## 版本保留

舊版 commit：`aa39d7f5738590e55cf7f60e5802e877c0ff5cee`。
舊版備份分支：`backup/d-area-before-20260908`，另有相同名稱標籤。
目前版本也保留 `Dweb.html?legacy=1` 的三段播放器。

## 視覺與效能

中央 12 cqw 不放內容，兩屏各自保留分鏡編號。模型使用透明表面與框線，鏡頭放大 40%；90 顆紅色粒子與 55 顆綠色粒子。左屏不建立 WebGL renderer，縮小預覽依可見尺寸降低 3D 繪製解析度。煙霧以平滑校時播放，講解暫停不會停止背景。

## 素材

`assets/kitchen.glb` 由提供的場地 3DS 裁切轉換；爐台設備和氣流為展演示意，不代表施工校正。原始完整場地檔與中間檔不發布。`film.mp4` 為既有煙霧影片。Three.js 0.180 runtime、授權與字型均放在本 repo，離開本機後也可載入。

## 檢查

`node --check theater.js`、`node --check kitchen-stage.js`、`node --check preview-state.js`。
`python -m unittest discover -s tools -p test_clock.py` 驗證伺服器時間軸控制。
