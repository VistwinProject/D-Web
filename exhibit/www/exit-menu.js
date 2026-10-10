// 隱藏的展演選單：在畫面左上角（依觀看方向）連點三下叫出來。
// 放在 #stage 裡，跟著畫面一起旋轉，所以直立電視上看也是正的。
// 動作交給 kit 的 /exhibit-api/session：暫停（關掉全部畫面、看守程式停手）、重新排列、取消。
(() => {
  const stage = document.getElementById('stage') || document.body;
  const css = document.createElement('style');
  css.textContent = `
    #exit-hot { position: absolute; left: 0; top: 0; width: 72px; height: 72px; z-index: 50; }
    #exit-menu { position: absolute; inset: 0; z-index: 60; display: none; place-items: center;
                 background: rgba(0, 0, 0, .55); cursor: auto !important; }
    #exit-menu.open { display: grid; }
    #exit-menu * { cursor: pointer !important; }
    #exit-menu .card { display: grid; gap: 14px; min-width: 340px; padding: 28px 30px; border-radius: 16px;
                       background: #141a24; border: 1px solid #334055; color: #e8eef8;
                       font: 17px/1.5 -apple-system, 'PingFang TC', sans-serif; text-align: center; }
    #exit-menu h3 { margin: 0 0 4px; font-size: 22px; font-weight: 600; }
    #exit-menu button { font: inherit; color: #e8eef8; background: #1d2533; border: 1px solid #3b4a62;
                        border-radius: 10px; padding: 12px 18px; }
    #exit-menu button.primary { background: #7f1d1d; border-color: #b91c1c; }
    #exit-menu button:hover { border-color: #60a5fa; }
    #exit-menu p { margin: 0; min-height: 1.5em; color: #94a3b8; font-size: 14px; }`;
  document.head.append(css);

  const hot = document.createElement('div');
  hot.id = 'exit-hot';
  const menu = document.createElement('div');
  menu.id = 'exit-menu';
  menu.innerHTML = `<div class="card"><h3>展演選單</h3>
    <button class="primary" data-act="pause">暫停展演（關閉全部畫面）</button>
    <button data-act="refresh">重新排列全部畫面</button>
    <button data-act="close">取消</button>
    <p>暫停後可以正常操作電腦；繼續展演用控制台或「繼續展演」捷徑</p></div>`;
  stage.append(hot, menu);

  let clicks = [], timer = null;
  const status = menu.querySelector('p');
  function close() { menu.classList.remove('open'); clearTimeout(timer); }
  function open() {
    menu.classList.add('open');
    clearTimeout(timer);
    timer = setTimeout(close, 20000);  // 沒動作就自己收起來，不會一直蓋著展演畫面
  }
  hot.addEventListener('click', () => {
    const now = performance.now();
    clicks = clicks.filter(t => now - t < 2000).concat(now);
    if (clicks.length >= 3) { clicks = []; open(); }
  });
  menu.addEventListener('click', async e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) { if (e.target === menu) close(); return; }
    if (act === 'close') return close();
    status.textContent = act === 'pause' ? '暫停中…' : '重新排列中…';
    try {
      const r = await fetch('/exhibit-api/session', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: act }) });
      if (!r.ok) throw Error((await r.json()).error || r.status);
    } catch (err) { status.textContent = `失敗：${err.message || err}`; }
  });
})();
