#!/bin/sh
# 雙擊開始 D 區展演（服務、三個畫面、看守程式、自動循環）
cd "$(dirname "$0")" && python3 -I launch.py start D
