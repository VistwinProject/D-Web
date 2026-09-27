import {ihState} from './ih-simple-state.mjs';
const $=id=>document.getElementById(id),query=new URLSearchParams(location.search);
const defaults={x:0,y:0,scale:100,rotation:0,tilt:0,brightness:100,mirror:false};
let config={...defaults};try{config={...config,...JSON.parse(localStorage.getItem('d-ih-projection')||'{}')};}catch{}
const fields=[['scale','投影尺寸',30,150,'%'],['x','水平位置',-40,40,'%'],['y','垂直位置',-40,40,'%'],['rotation','旋轉',-180,180,'°'],['tilt','梯形微調',-45,45,'°'],['brightness','亮度',40,150,'%']];
for(const [key,label,min,max,unit] of fields){if(query.has(key))config[key]=Number(query.get(key));config[key]=Number.isFinite(config[key])?Math.max(min,Math.min(max,config[key])):defaults[key];const el=document.createElement('label');el.innerHTML=`${label}<span id="read-${key}"></span><input aria-label="${label}" id="${key}" type="range" min="${min}" max="${max}">`;$('sliders').append(el);$(key).oninput=e=>{config[key]=Number(e.target.value);calibrate();};}
if(query.has('mirror'))config.mirror=query.get('mirror')==='1';
function calibrate(){for(const [key,,,,unit] of fields){$(key).value=config[key];$('read-'+key).textContent=config[key]+unit;}$('mirror').checked=config.mirror;$('surface').style.transform=`translate(${config.x}%,${config.y}%) perspective(1200px) rotateX(${config.tilt}deg) rotateZ(${config.rotation}deg) scale(${config.scale/100*(config.mirror?-1:1)},${config.scale/100})`;document.body.style.setProperty('--brightness',config.brightness/100);try{localStorage.setItem('d-ih-projection',JSON.stringify(config));}catch{}}
$('mirror').onchange=e=>{config.mirror=e.target.checked;calibrate();};$('grid').onchange=e=>$('calibration').hidden=!e.target.checked;$('reset').onclick=()=>{config={...defaults};calibrate();};calibrate();
let mode=['theater','off','on'].includes(query.get('mode'))?query.get('mode'):'theater';$('mode').value=mode;$('mode').onchange=e=>mode=e.target.value;
function togglePanel(){$('controls').hidden=!$('controls').hidden;$('hint').classList.add('gone');}$('close').onclick=togglePanel;
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('message').textContent='請使用瀏覽器全螢幕。';}}
$('fullscreen').onclick=fullscreen;$('projection').ondblclick=fullscreen;
document.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;if(e.key.toLowerCase()==='f'){e.preventDefault();togglePanel();}if(e.key==='Escape')$('controls').hidden=true;});
$('copy').onclick=async()=>{const url=new URL(location.href);for(const [k,v] of Object.entries(config))url.searchParams.set(k,typeof v==='boolean'?(v?'1':'0'):v);url.searchParams.set('mode',mode);try{await navigator.clipboard.writeText(url.href);$('message').textContent='已複製校正網址。';}catch{$('message').textContent=url.href;}};
setTimeout(()=>$('hint').classList.add('gone'),6500);if(query.get('calibrate')==='1')$('controls').hidden=false;
let cue=null,cueAt=0,priority=-1;
function acceptCue(s){if(!s||!Number.isFinite(s.time)||typeof s.playing!=='boolean')return;if(s.priority!=null&&s.priority<priority&&performance.now()-cueAt<4000)return;cue=s;cueAt=performance.now();priority=s.priority??0;}
const endpoint=query.get('sync')||(location.port==='8776'?'/api/state':null);
if(endpoint){(async function poll(){try{const r=await fetch(endpoint,{cache:'no-store'});if(r.ok)acceptCue(await r.json());}catch{}setTimeout(poll,250);})();}
else{const bus=new BroadcastChannel('dweb-exhibit-cue');bus.onmessage=e=>{if(e.data?.source==='preview-clock')acceptCue(e.data);};bus.postMessage({request:'cue'});}
function frame(){const s=ihState(cue,(performance.now()-cueAt)/1000,window.D_SHOW,mode);document.body.classList.toggle('is-on',s.on);$('state-label').textContent=s.on?'開啟':'關閉';$('message').textContent=mode!=='theater'?'獨立介面示意':s.connected?'已同步劇場':'等待劇場同步，保持關閉';requestAnimationFrame(frame);}requestAnimationFrame(frame);
