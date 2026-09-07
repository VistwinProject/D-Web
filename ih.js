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
let mode=query.get('mode')||'auto';if(!['auto','0','1','2'].includes(mode))mode='auto';$('mode').value=mode;
let elapsed=0,last=performance.now(),lastData=-Infinity,paused=false;
$('mode').onchange=e=>{mode=e.target.value;elapsed=0;};
function togglePause(){paused=!paused;document.body.classList.toggle('paused',paused);$('pause').textContent=paused?'繼續數值':'暫停數值';} $('pause').onclick=togglePause;
function togglePanel(){ $('controls').hidden=!$('controls').hidden;$('hint').classList.add('gone');} $('close').onclick=togglePanel;
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('message').textContent='請使用瀏覽器的全螢幕功能。';}}
$('fullscreen').onclick=fullscreen;document.getElementById('projection').ondblclick=fullscreen;
document.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;if(e.key.toLowerCase()==='f'){e.preventDefault();togglePanel();}if(e.code==='Space'){e.preventDefault();togglePause();}if(e.key==='Escape')$('controls').hidden=true;});
$('copy').onclick=async()=>{const url=new URL(location.href);for(const [k,v] of Object.entries(config))url.searchParams.set(k,typeof v==='boolean'?(v?'1':'0'):v);url.searchParams.set('mode',mode);try{await navigator.clipboard.writeText(url.href);$('message').textContent='已複製，開啟網址即可套用此校正。';}catch{$('message').textContent=url.href;}};
setTimeout(()=>$('hint').classList.add('gone'),6500);if(query.get('calibrate')==='1')$('controls').hidden=false;
// Deliberate exhibition values: no physical temperature prediction or equipment control.
const phases=[{name:'01 / 熱能啟動',power:[600,1800],temp:[70,140],pm:[25,80],action:'產生熱能',status:'熱能累積 · 油煙開始生成'},{name:'02 / 烹飪升溫',power:[1800,2100],temp:[140,185],pm:[80,200],action:'產生熱能',status:'油煙生成 · 持續觀察'},{name:'03 / 排煙降溫',power:[2100,600],temp:[185,70],pm:[200,25],action:'熱能調節',status:'集中排煙 · 濃度逐步下降'}];
function frame(now){const dt=Math.min((now-last)/1000,.1);last=now;if(!paused&&!document.hidden)elapsed+=dt;const index=mode==='auto'?Math.floor(elapsed/20)%3:Number(mode),p=mode==='auto'?(elapsed%20)/20:Math.min(elapsed/20,1),e=p*p*(3-2*p),phase=phases[index],mix=a=>a[0]+(a[1]-a[0])*e;
if(now-lastData>200){lastData=now;$('energy').textContent=Math.round(mix(phase.power)/10)*10;$('energy').textContent=Number($('energy').textContent).toLocaleString('en-US');$('temperature').textContent=Math.round(mix(phase.temp));const pm=Math.round(mix(phase.pm));$('concentration').textContent=pm;$('phase').textContent=phase.name;$('action').textContent=phase.action;$('status').textContent=phase.status;bars.forEach((b,i)=>b.setAttribute('opacity',i<pm/200*30?'.9':'.15'));}
embers.forEach((node,i)=>{const a=i*2.399+elapsed*.13,r=222+((elapsed*12+i*17)%47);node.setAttribute('cx',Math.cos(a)*r);node.setAttribute('cy',Math.sin(a)*r);node.setAttribute('opacity',String((1-(r-222)/47)*.85));});requestAnimationFrame(frame);}
requestAnimationFrame(frame);
})();
