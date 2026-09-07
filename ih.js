(() => {
'use strict';
const $=id=>document.getElementById(id),defaults={x:0,y:0,scale:100,rotation:0,tilt:0,brightness:100,mirror:false},query=new URLSearchParams(location.search);
let config={...defaults};try{config={...config,...JSON.parse(localStorage.getItem('d-ih-projection')||'{}')};}catch{}
const fields=[['scale','投影尺寸',30,150,'%'],['x','水平位置',-40,40,'%'],['y','垂直位置',-40,40,'%'],['rotation','旋轉',-180,180,'°'],['tilt','梯形微調',-45,45,'°'],['brightness','亮度',40,150,'%']];
for(const [key,label,min,max,unit] of fields){if(query.has(key))config[key]=Number(query.get(key));config[key]=Number.isFinite(config[key])?Math.max(min,Math.min(max,config[key])):defaults[key];const el=document.createElement('label');el.textContent=label;el.innerHTML+=`<span id="read-${key}"></span><input aria-label="${label}" id="${key}" type="range" min="${min}" max="${max}" value="${config[key]}">`;$('sliders').append(el);$(key).oninput=e=>{config[key]=Number(e.target.value);calibrate();};}
if(query.has('mirror'))config.mirror=query.get('mirror')==='1';
function calibrate(){for(const [key,,, ,unit] of fields){$(key).value=config[key];$('read-'+key).textContent=config[key]+unit;}$('mirror').checked=config.mirror;$('surface').style.transform=`translate(${config.x}%,${config.y}%) perspective(1200px) rotateX(${config.tilt}deg) rotateZ(${config.rotation}deg) scale(${config.scale/100*(config.mirror?-1:1)},${config.scale/100})`;document.body.style.setProperty('--brightness',config.brightness/100);try{localStorage.setItem('d-ih-projection',JSON.stringify(config));}catch{}}
$('mirror').onchange=e=>{config.mirror=e.target.checked;calibrate();};$('grid').onchange=e=>$('calibration').style.display=e.target.checked?'block':'none';$('calibration').style.display='none';
$('reset').onclick=()=>{config={...defaults};calibrate();};calibrate();
const ns='http://www.w3.org/2000/svg';for(let i=0;i<72;i++){const a=i*Math.PI/36,r=i%6===0?275:270,node=document.createElementNS(ns,'line');node.setAttribute('x1',Math.cos(a)*r);node.setAttribute('y1',Math.sin(a)*r);node.setAttribute('x2',Math.cos(a)*281);node.setAttribute('y2',Math.sin(a)*281);node.setAttribute('stroke','#ff6857');node.setAttribute('opacity',i%6===0?'.8':'.3');$('ticks').append(node);}
const embers=Array.from({length:20},(_,i)=>{const node=document.createElementNS(ns,'circle');node.setAttribute('r',i%3===0?3:2);node.setAttribute('fill','#ff6752');$('embers').append(node);return node;});
const bars=Array.from({length:30},(_,i)=>{const node=document.createElementNS(ns,'rect');node.setAttribute('x',i*14.5);node.setAttribute('width',7);node.setAttribute('height',11);node.setAttribute('fill','#ff5946');$('bars').append(node);return node;});
let mode=query.get('mode')||'theater';if(!['theater','auto','0','1','2'].includes(mode))mode='theater';$('mode').value=mode;
let elapsed=0,last=performance.now(),lastData=-Infinity,paused=false;
$('mode').onchange=e=>{mode=e.target.value;elapsed=0;};
function togglePause(){if(mode==='theater'){$('message').textContent='跟隨劇場模式，請在雙電視頁控制暫停／播放。';return;}paused=!paused;document.body.classList.toggle('paused',paused);$('pause').textContent=paused?'繼續數值':'暫停數值';} $('pause').onclick=togglePause;
function togglePanel(){ $('controls').hidden=!$('controls').hidden;$('hint').classList.add('gone');} $('close').onclick=togglePanel;
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('message').textContent='請使用瀏覽器的全螢幕功能。';}}
$('fullscreen').onclick=fullscreen;document.getElementById('projection').ondblclick=fullscreen;
document.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;if(e.key.toLowerCase()==='f'){e.preventDefault();togglePanel();}if(e.code==='Space'){e.preventDefault();togglePause();}if(e.key==='Escape')$('controls').hidden=true;});
$('copy').onclick=async()=>{const url=new URL(location.href);for(const [k,v] of Object.entries(config))url.searchParams.set(k,typeof v==='boolean'?(v?'1':'0'):v);url.searchParams.set('mode',mode);try{await navigator.clipboard.writeText(url.href);$('message').textContent='已複製，開啟網址即可套用此校正。';}catch{$('message').textContent=url.href;}};
setTimeout(()=>$('hint').classList.add('gone'),6500);if(query.get('calibrate')==='1')$('controls').hidden=false;
// Read-only cue follower: IH never echoes playback states to the theatre.
const starts=[0,12,24,40,56,72],colors=['#a69bf5','#70df9f','#ff6258','#ffc278','#54ddab','#a9e1b8'];
let cue=null,cueAt=0,cueOwner='',cuePriority=-1;
function acceptCue(s){if(!Number.isFinite(s.time)||typeof s.playing!=='boolean')return;if(s.priority!=null&&s.priority<cuePriority&&performance.now()-cueAt<4000)return;cue=s;cueAt=performance.now();cueOwner=s.owner||'server';cuePriority=s.priority??0;}
const endpoint=query.get('sync')||(location.port==='8776'?'/api/state':null);
if(endpoint){(async function poll(){try{const r=await fetch(endpoint,{cache:'no-store'});if(r.ok)acceptCue(await r.json());}catch{}setTimeout(poll,250);})();}
else{const cueBus=new BroadcastChannel('dweb-exhibit-cue');cueBus.onmessage=e=>{if(e.data.source==='preview-clock')acceptCue(e.data);};cueBus.postMessage({request:'cue'});}
// Exhibition values only; this page does not measure or control an IH appliance.
const demo=[{name:'01 / 熱能啟動',power:[600,1800],temp:[70,140],pm:[25,80],action:'產生熱能',status:'熱能累積 · 油煙開始生成'},{name:'02 / 烹飪升溫',power:[1800,2100],temp:[140,185],pm:[80,200],action:'產生熱能',status:'油煙生成 · 持續觀察'},{name:'03 / 排煙降溫',power:[2100,600],temp:[185,70],pm:[200,25],action:'熱能調節',status:'集中排煙 · 濃度逐步下降'}];
const theatre=[
{name:'01 / 隱形風險',power:[0,0],temp:[25,25],pm:[10,10],action:'待機中',status:'熱能未啟動 · 辨識環境風險'},
{name:'02 / 正常偵測',power:[0,0],temp:[25,25],pm:[10,10],action:'待機偵測',status:'空氣品質穩定 · 熱能未啟動'},
{name:'03 / 烹飪污染',power:[600,2100],temp:[25,185],pm:[10,200],action:'產生熱能',status:'烹飪升溫 · 油煙持續生成'},
{name:'04 / 負壓排煙',power:[2100,0],temp:[185,80],pm:[200,60],action:'降低熱能',status:'集中排煙 · 逐步降低功率'},
{name:'05 / 正壓守護',power:[0,0],temp:[80,35],pm:[60,10],action:'熱能關閉',status:'潔淨新風 · 熱能已關閉'},
{name:'06 / 持續淨化',power:[0,0],temp:[35,25],pm:[10,10],action:'本輪結束',status:'持續淨化 · 等待下一輪'}];
let lastColor='';
function frame(now){const dt=Math.min((now-last)/1000,.1);last=now;if(!paused&&!document.hidden)elapsed+=dt;
let index,p,phase,t,active,live=true,isPlaying=!paused;
if(mode==='theater'){
 live=!!cue&&now-cueAt<4000;
 t=cue?(cue.time+(live&&cue.playing?(now-cueAt)/1000:0))%90:0;
 index=Math.max(0,starts.findLastIndex(n=>t>=n));p=(t-starts[index])/((starts[index+1]||90)-starts[index]);phase=theatre[index];active=live&&(index===2||index===3);isPlaying=live&&cue.playing;
 if(!live){phase={name:cue?'同步中斷':'等待劇場分鏡',power:[0,0],temp:[25,25],pm:[10,10],action:'待機中',status:'請開啟同一瀏覽器的雙電視展演'};p=0;}
}else{index=mode==='auto'?Math.floor(elapsed/20)%3:Number(mode);p=mode==='auto'?(elapsed%20)/20:Math.min(elapsed/20,1);phase=demo[index];t=elapsed;active=true;}
const e=p*p*(3-2*p),mix=a=>a[0]+(a[1]-a[0])*e,color=mode==='theater'?(live?colors[index]:'#91a2ad'):'#ff6258';
if(color!==lastColor){lastColor=color;document.body.style.setProperty('--cue-color',color);}
document.body.classList.toggle('paused',!isPlaying);document.body.classList.toggle('heat-off',!active);
if(now-lastData>150){lastData=now;$('energy').textContent=(Math.round(mix(phase.power)/10)*10).toLocaleString('en-US');$('temperature').textContent=live?Math.round(mix(phase.temp)):'—';let pm=Math.round(mix(phase.pm));if(mode==='theater'&&live&&cue.values?.[4]!=null)pm=Math.round(cue.values[4]);$('concentration').textContent=live?pm:'—';$('phase').textContent=phase.name;$('action').textContent=phase.action;$('status').textContent=phase.status;$('energy-state').textContent=active?'INDUCTION · ENERGY ON':'INDUCTION · STANDBY';bars.forEach((b,i)=>b.setAttribute('opacity',live&&i<pm/200*30?'.9':'.15'));if(mode==='theater')$('message').textContent=live?`已同步劇場 ${String(index+1).padStart(2,'0')} / 06 · ${cue.playing?'播放中':'已暫停'}`:'等待劇場連線 · IH 保持待機';}
embers.forEach((node,i)=>{const a=i*2.399+t*.13,r=222+((t*12+i*17)%47);node.setAttribute('cx',Math.cos(a)*r);node.setAttribute('cy',Math.sin(a)*r);node.setAttribute('opacity',active?String((1-(r-222)/47)*.85):'0');});requestAnimationFrame(frame);}
requestAnimationFrame(frame);
})();
