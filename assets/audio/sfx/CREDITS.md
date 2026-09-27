# D 區設備與生活音效

以下三個來源頁面在 2026-09-27 均標示 **CC0 1.0**。使用 Freesound 公開提供的高品質 MP3 預聽檔製作展示音效；並非現場設備的實測錄音。

| 本機音檔 | 原作／作者 | 來源 | 本次處理 |
| --- | --- | --- | --- |
| extractor-start.wav | extractor fan.wav — iccleste | https://freesound.org/people/iccleste/sounds/260817/ | 取原音 1–25 秒，保留風扇啟動；循環僅使用穩定運轉段 |
| ventilation.wav | Room Tone, Deep Ventilation — Kinoton | https://freesound.org/people/Kinoton/sounds/503255/ | 取原音 10–34 秒，濾除過低與尖銳頻率，作為新風運轉聲 |
| cooking-sizzle.wav | Frying Egg.wav — ciccarelli | https://freesound.org/people/ciccarelli/sounds/170416/ | 取原音 5–29 秒，作為 IH 加熱後的鍋內煎炒聲 |

授權：https://creativecommons.org/publicdomain/zero/1.0/

全部轉為單聲道 PCM16、32 kHz，調整音量後以交叉淡化銜接循環；新風以漸強表現啟動，不是新增的實錄開關聲。IH 使用煎炒聲，未加入不符合感應爐的瓦斯點火音效。來源下載 URL、SHA-256、裁切位置及處理參數見 `sources.json`。

`sound-effects.json` 決定入點、退場、音量與循環範圍。`tools/build_voice_show.py` 重建原配音軌後，自動由 `tools/build_soundtrack.py` 合成單一 `theatre-mix.wav`，保留既有暫停、跳幕、靜音與多分頁音軌所有權行為。
