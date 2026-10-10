// 列出 Chrome 的一般視窗：「pid x y 寬 高 是否在畫面上」，給 launch.py 的看守程式判斷 kiosk 有沒有跑掉。
// 座標是全域座標（主螢幕左上角為原點、y 向下），跟 Chrome 的 --window-position 一致。
// launch.py 第一次需要時用 swiftc 編譯到 .exhibit-runtime/winlist。
import CoreGraphics
import Foundation

let list = CGWindowListCopyWindowInfo([.optionAll, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
for w in list {
  guard let owner = w[kCGWindowOwnerName as String] as? String, owner.contains("Chrome"),
        let layer = w[kCGWindowLayer as String] as? Int, layer == 0,
        let b = w[kCGWindowBounds as String] as? [String: CGFloat],
        let height = b["Height"], height > 200 else { continue }
  let pid = w[kCGWindowOwnerPID as String] as? Int ?? 0
  let onscreen = (w[kCGWindowIsOnscreen as String] as? Bool ?? false) ? 1 : 0
  print(pid, Int(b["X"] ?? 0), Int(b["Y"] ?? 0), Int(b["Width"] ?? 0), Int(height), onscreen)
}
