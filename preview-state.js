// Local installations use the server; GitHub Pages shares a browser clock across both panels.
const main=document.querySelector('main'),duration=window.D_SHOW?.duration||90,starts=window.D_SHOW?.starts||[0,12,24,40,56,72],names=['隱形風險','正常偵測','烹飪污染','負壓排煙','正壓守護','持續淨化'];
new ResizeObserver(()=>document.querySelector('.screens').style.transform=`scale(${main.clientWidth/2160})`).observe(main);
const server=location.port==='8776';
// Each preview owns its two panels; independent tabs must not echo clocks into one another.
const channelName='dweb-preview-'+crypto.randomUUID();
const bus=server?null:new BroadcastChannel(channelName);
const cues=server?null:new BroadcastChannel('dweb-exhibit-cue');
let cuePriority=Date.now();
function publish(state){bus?.postMessage(state);cues?.postMessage({...state,owner:channelName,priority:cuePriority});}
if(cues)cues.onmessage=e=>{if(e.data.request==='cue')cues.postMessage({...snapshot(),owner:channelName,priority:cuePriority});};
document.addEventListener('visibilitychange',()=>{if(!document.hidden){cuePriority=Date.now();if(!server)publish(snapshot());}});
// Set the clock before the first navigation; replacing an already-loading src
// used to restart both panels and amplify the old interface's startup flash.
document.querySelectorAll('iframe').forEach(frame=>{const url=new URL(frame.dataset.src||frame.getAttribute('src'),location.href);if(!server)url.searchParams.set('syncChannel',channelName);frame.src=url.href;});
let position=0,anchor=performance.now(),playing=false,values=null;
function snapshot(){const t=Math.min(duration,position+(playing?(performance.now()-anchor)/1000:0));if(t>=duration){position=duration;playing=false;}return {source:'preview-clock',time:t,playing,values,mode:'auto',stamp:Date.now()/1000};}
function apply(s){position=s.time;anchor=performance.now();playing=s.playing;values=s.values||null;}
function offline(){window.dispatchEvent(new CustomEvent('dweb-frame',{detail:{time:position,playing:false}}));}
function display(s){if(server)apply(s);window.dispatchEvent(new CustomEvent('dweb-frame',{detail:s}));}
async function command(p){
 cuePriority=Date.now();
 if(server){try{const r=await fetch('/api/state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});if(!r.ok)throw Error();display(await r.json());}catch{offline();}return;}
 const s=snapshot();position=s.time;anchor=performance.now();
 if(p.cmd==='goto')position=starts[p.stage-1];
 if(p.cmd==='pause')playing=false;
 if(p.cmd==='play')playing=true;
 if(p.cmd==='reset'){position=0;playing=true;values=null;}
 const state=snapshot();publish(state);display(state);
}
if(bus)bus.onmessage=e=>{if(e.data.source==='preview-clock')return;if(e.data.request)publish(snapshot());else if(Number.isFinite(e.data.time)){apply(e.data);publish(snapshot());}};
window.addEventListener('dweb-command',e=>command(e.detail));
document.getElementById('guide').onclick=e=>e.target.setAttribute('aria-pressed',main.classList.toggle('guide'));
async function observe(){if(server){try{const r=await fetch('/api/state',{cache:'no-store'});if(!r.ok)throw Error();display(await r.json());}catch{offline();}}else{const s=snapshot();publish(s);display(s);}setTimeout(observe,250);}observe();
