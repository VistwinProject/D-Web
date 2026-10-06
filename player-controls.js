(()=>{
 const q=new URLSearchParams(location.search);if(window.parent!==window||q.get('side')||q.get('legacy')==='1')return;
 document.body.classList.add('has-preview-player');
 const show=window.D_SHOW,names=['隱形風險','正常偵測','烹飪污染','AI 提醒','正壓守護','持續淨化'];
 const bar=document.createElement('footer');bar.className='preview-player';
 bar.innerHTML=`<div class="playback"><button id="playPause" class="primary">▶ 播放</button><button id="reset" aria-label="重新開始">↺</button><span id="time">00:00 / 02:08</span></div><div class="timeline"><div id="progress"></div>${names.map((n,i)=>`<button data-stage="${i+1}"><b>0${i+1}</b>${n}</button>`).join('')}</div><details class="preview-options"><summary>預覽設定</summary><div>${document.body.classList.contains('preview-page')?'<button id="guide" aria-pressed="false">邊框安全範圍</button><a href="Dweb.html?v=once-1">完整舞台</a>':'<a href="preview.html?v=once-1">雙屏預覽</a>'}</div></details>`;
 document.body.append(bar);let state={time:0,playing:false};
 const send=p=>window.dispatchEvent(new CustomEvent('dweb-command',{detail:{...p,source:'local-ui'}}));
 const unlock=()=>window.dispatchEvent(new CustomEvent('dweb-user-play'));
 bar.querySelector('#playPause').onclick=()=>{if(!state.playing)unlock();send({cmd:state.playing?'pause':state.time>=show.duration?'reset':'play'});};
 bar.querySelector('#reset').onclick=()=>{unlock();send({cmd:'reset'});};
 bar.querySelectorAll('[data-stage]').forEach(b=>b.onclick=()=>send({cmd:'goto',stage:+b.dataset.stage}));
 const format=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
 window.addEventListener('dweb-frame',e=>{state=e.detail;const t=Math.min(show.duration,state.time);bar.querySelector('#playPause').textContent=state.playing?'Ⅱ 暫停':t>=show.duration?'↺ 重播':'▶ 播放';bar.querySelector('#time').textContent=format(t)+' / '+format(show.duration);bar.querySelector('#progress').style.width=t/show.duration*100+'%';const chapter=show.starts.findLastIndex(s=>t>=s);bar.querySelectorAll('[data-stage]').forEach((b,i)=>b.classList.toggle('active',i===chapter));});
})();
