// 電視實體直立、macOS 仍輸出橫向時，由網頁把 #stage 轉 90°，裡面的 iframe 就拿到真正的直式視口。
// 方向存在 kit 的 display.json（/exhibit-api/display）；控制台切換時經 8787 中繼即時通知。
// 網址帶 ?rotate=0|90|-90|180 時以網址為準，不受控制台影響。
//
// 搭配樣式：
//   #stage[data-rotate="90"]   內容順時針轉：畫面上緣朝向電視的右側
//   #stage[data-rotate="-90"]  內容逆時針轉：畫面上緣朝向電視的左側
window.exhibitRotation = function (key, stage, onChange) {
  const q = new URLSearchParams(location.search);
  const fixed = q.has('rotate');
  function apply(deg) {
    deg = [0, 90, -90, 180].includes(+deg) ? +deg : 0;
    if (stage.dataset.rotate === String(deg)) return;
    stage.dataset.rotate = String(deg);
    onChange?.(deg);
  }
  if (fixed) apply(q.get('rotate'));
  else {
    apply(0);
    fetch('/exhibit-api/display', { cache: 'no-store' })
      .then(r => r.json()).then(d => apply(d[key] ?? 0)).catch(() => {});
  }
  (function listen() {
    const ws = new WebSocket(`ws://${location.hostname}:8787`);
    ws.onmessage = e => {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'display' && m.key === key && !fixed) apply(m.rotate);
    };
    ws.onclose = () => setTimeout(listen, 3000);
  })();
};
