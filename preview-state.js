// Local installations use the server; GitHub Pages shares a browser clock across both panels.
const main=document.querySelector('main'),starts=[0,12,24,40,56,72],names=['隱形風險','正常偵測','烹飪污染','負壓排煙','正壓守護','持續淨化'];
new ResizeObserver(()=>document.querySelector('.screens').style.transform=`scale(${main.clientWidth/2160})`).observe(main);
const server=location.port==='8776',bus=server?null:new BroadcastChannel('dweb-preview-six-scenes');
let position=0,anchor=performance.now(),playing=true,values=null;
function snapshot(){return {time:(position+(playing?(performance.now()-anchor)/1000:0))%90,playing,values,mode:'auto',stamp:Date.now()/1000};}
function apply(s){position=s.time;anchor=performance.now();playing=s.playing;values=s.values||null;}
function display(s){const i=starts.findLastIndex(t=>s.time>=t),select=document.getElementById('scene');if(document.activeElement!==select)select.value=i+1;document.getElementById('status').textContent=`${String(i+1).padStart(2,'0')} / 06 ${names[i]} · ${s.playing?'播放中':'已暫停'}`;}
async function command(p){
 if(server){try{const r=await fetch('/api/state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});if(!r.ok)throw Error();display(await r.json());}catch{document.getElementById('status').textContent='同步服務離線';}return;}
 const s=snapshot();position=s.time;anchor=performance.now();
 if(p.cmd==='goto')position=starts[p.stage-1];
 if(p.cmd==='pause')playing=false;
 if(p.cmd==='play')playing=true;
 if(p.cmd==='reset'){position=0;playing=true;values=null;}
 const state=snapshot();bus.postMessage(state);display(state);
}
if(bus)bus.onmessage=e=>{if(e.data.request)bus.postMessage(snapshot());else if(Number.isFinite(e.data.time)){apply(e.data);bus.postMessage(snapshot());}};
['play','pause','reset'].forEach(cmd=>document.getElementById(cmd).onclick=()=>command({cmd}));
document.getElementById('scene').onchange=e=>command({cmd:'goto',stage:+e.target.value});
document.getElementById('guide').onclick=e=>e.target.setAttribute('aria-pressed',main.classList.toggle('guide'));
async function observe(){if(server){try{const r=await fetch('/api/state',{cache:'no-store'});if(!r.ok)throw Error();display(await r.json());}catch{document.getElementById('status').textContent='同步服務離線';}}else{const s=snapshot();bus.postMessage(s);display(s);}setTimeout(observe,250);}observe();
