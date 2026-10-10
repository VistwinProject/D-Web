#!/bin/sh
# 下載 C 區數位窗景的 9 支背景影片（約 290 MB）到 C-Digital-Window-demo/videos/。
# 影片不在 git 裡，放在 VistwinProject/C-Digital-Window-demo 的 videos Release。
set -e
DEST="$(cd "$(dirname "$0")/../.." && pwd)/C-Digital-Window-demo/videos"
mkdir -p "$DEST"
for n in 1 2 3 4 5 6 7 8 9; do
  if [ -s "$DEST/$n.mp4" ]; then echo "已存在 $n.mp4，略過"; continue; fi
  echo "下載 $n.mp4 …"
  curl -fL --retry 3 -o "$DEST/$n.mp4.part" \
    "https://github.com/VistwinProject/C-Digital-Window-demo/releases/download/videos/$n.mp4"
  mv "$DEST/$n.mp4.part" "$DEST/$n.mp4"
done
echo "完成：$DEST"
