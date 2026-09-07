/* Six-scene exhibition, one deterministic clock. ?legacy=1 retains original player. */
if(new URLSearchParams(location.search).get('legacy')!=='1') (()=>{
window.theaterActive=true; document.body.classList.add('theater');
S.junction.push('D_T4','D_T5','D_T6');renderChain();
clearInterval(simTimer);
const q=new URLSearchParams(location.search), duration=90, starts=[0,12,24,40,56,72];
const normal=[480,.03,.20,8,10,20], peak=[900,.07,2.5,100,200,150], reduced=[650,.045,.8,35,60,65], clean=[480,.03,.20,8,10,20];
const scenes=[
 ['ARRIVAL','看不見，也需要被看見','每一次呼吸，都與室內空氣相連。','PM2.5 懸浮微粒 · TVOC 揮發性有機物 · HCHO 甲醛',normal,normal,'flat'],
 ['DETECTION','安靜守候，每一次呼吸','六項空氣指標，持續感知家的變化。','正常偵測 · 建立室內空氣基準',normal,normal,'flat'],
 ['COOKING','一餐之間，空氣正在改變','烹飪油煙從爐台升起，向室內擴散。','烹飪污染 · PM2.5 與 TVOC 上升',normal,peak,'up'],
 ['NEGATIVE PRESSURE','在源頭，帶走油煙','集煙口形成負壓，將污染收束並排出。','負壓排煙 · 污染粒子朝集煙口移動',peak,reduced,'down'],
 ['POSITIVE PRESSURE','讓乾淨的空氣，向內流動','新風補入室內，建立守護家的空氣屏障。','正壓守護 · 潔淨氣流阻隔外來污染',reduced,clean,'down'],
 ['PURIFICATION','把安心，留在家裡','持續淨化，讓空氣回到平穩。','淨化報告 · 從感知、排煙到持續守護',clean,clean,'flat']
];
SCENES.splice(0,SCENES.length,...scenes.map((s,i)=>({tag:`0${i+1} · ${s[0]}`,en:s[0],name:['隱形風險','正常偵測','烹飪污染','負壓排煙','正壓守護','持續淨化'][i],cls:`s${i%3+1}`,trend:s[6],from:s[4],to:s[5],beats:[[0,s[3],'展演模擬 · 非現場量測']]})));
const stage=document.querySelector('.stage'), story=document.createElement('section');story.className='story';
story.innerHTML=`<header><span>寶舖 · 居家風險劇場</span><span>空氣的旅程 / AIR IN MOTION</span></header><h1></h1><p class="desc"></p>
<svg class="air-diagram" viewBox="0 0 560 400" aria-label="廚房氣流原理示意：左側爐台與集煙口，右側新風入口">
<path class="room" d="M35 345V40H515V345Z"/><path class="flow" d="M35 345H515"/>
<path class="equipment" d="M80 295H245V320H80ZM85 310V345M235 310V345"/>
<ellipse class="equipment" cx="155" cy="290" rx="38" ry="10"/><path class="equipment" d="M115 115H195L220 140H90ZM145 40H170V115"/>
<text x="90" y="375">爐台 / 污染源</text><text x="85" y="92">集煙口</text>
<path class="equipment" d="M475 145H515V195H475Z"/><text x="390" y="125">新風入口</text>
<path id="barrier" d="M345 60V335" stroke="#6fc8f6" stroke-width="4" opacity="0"/>
<g id="particles"></g><g id="flowLines"></g></svg>
<div class="pollutants">${[['CO₂','二氧化碳','呼吸累積 · 通風不足'],['HCHO','甲醛','裝潢 · 家具逸散'],['TVOC','揮發性有機物','油煙 · 清潔用品'],['PM1','超細懸浮微粒','高溫烹飪 · 煙霧'],['PM2.5','細懸浮微粒','煎炒油煙 · 室外污染'],['PM10','懸浮微粒','灰塵 · 花粉']].map(a=>`<div><b>${a[0]}</b><span>${a[1]}</span><small>${a[2]}</small></div>`).join('')}</div>
<div class="report">本輪展演淨化報告<br>PM2.5　200 → 10 µg/m³　｜　下降 95%<br>TVOC　2.50 → 0.20 mg/m³<br>模擬情境結果，非設備實測效能</div>
<div class="caption">廚房氣流原理示意 · 位置不代表現場施工配置</div>
<div class="story-progress">${scenes.map(()=>'<span></span>').join('')}</div>
<footer><span>展演模擬數據 · 非現場量測</span><span id="storyTime"></span></footer>`;
stage.append(story);
const control=document.createElement('section');control.id='storyControl';control.innerHTML=`<h2>六段展演 · 90 秒</h2><div class="buttons">${SCENES.map((s,i)=>`<button data-scene="${i+1}">${i+1} ${s.name}</button>`).join('')}</div><input aria-label="展演時間" type="range" min="0" max="89.9" step=".1"><div class="buttons"><button data-action="play">播放</button><button data-action="pause">暫停</button><button data-action="reset">重新開始</button></div><output id="syncState">單機預覽</output>`;
panel.querySelector('.pb').prepend(control);
const particles=story.querySelector('#particles');
for(let i=0;i<65;i++) particles.insertAdjacentHTML('beforeend','<circle r="2" fill="#c0e6fa"/>');
let anchor=performance.now(), pos=0, playing=true, lastScene=-1, lastRender=0, connected=false, external=null, lost=false, mode='auto',lastStamp=0;
let ambientPos=Date.now()/1000%30,ambientAnchor=performance.now(),lastVideoSeek=-Infinity;
const endpoint=q.get('sync')|| (location.port==='8776'?'/api/state':null);
let channel= !endpoint && typeof BroadcastChannel!=='undefined' ?new BroadcastChannel(q.get('preview')==='1'?'dweb-preview-six-scenes':'dweb-six-scenes'):null;
function time(){const raw=Math.max(0,pos+(playing?(performance.now()-anchor)/1000:0));if(!endpoint&&mode==='hold'){const i=idx(pos),end=starts[i+1]||duration;return starts[i]+(raw-starts[i])%(end-starts[i]);}if(!endpoint&&mode==='wait'){const end=starts[idx(pos)+1]||duration;return Math.min(end-.001,raw);}return raw%duration;}
function idx(t){return starts.findLastIndex(s=>t>=s);}
function updateState(s){if(s.stamp&&s.stamp<lastStamp)return;if(s.stamp){lastStamp=s.stamp;ambientPos=s.stamp;ambientAnchor=performance.now();}pos=s.time;anchor=performance.now();playing=s.playing;external=s.values||null;mode=s.mode||'auto';}
function localCommand(p){let t=time();const c=String(p.cmd||p.command||'').toLowerCase();
 if(['goto','stage','scene'].includes(c)){const n=Number(p.stage??p.n??p.value);if(!Number.isInteger(n)||n<1||n>6)return;t=starts[n-1];}
 if(['next','trigger','advance'].includes(c)){t=starts[(idx(t)+1)%6];if(mode==='wait')playing=true;}if(c==='prev')t=starts[(idx(t)+5)%6];
 if(c==='reset'){t=0;external=null;}if(c==='play'||c==='reset')playing=true;if(c==='pause')playing=false;
 if(c==='mode'&&['auto','wait','hold'].includes(p.value))mode=p.value;
 if(c==='simulate')external=null;
 if(c==='data'){const vals=external?.slice()||S.values.slice();METRICS.forEach((m,i)=>{const v=p.values?.[i]??p[m.k];if(v!=null&&Number.isFinite(Number(v)))vals[i]=Math.max(0,Number(v));});external=vals;}
 pos=t;anchor=performance.now();}
async function command(p){if(endpoint){try{const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});if(!r.ok)throw Error();updateState(await r.json());}catch{log('同步命令失敗，請確認同步服務','e');}return;}
 localCommand(p);channel?.postMessage({time:time(),playing,values:external,mode});}
if(channel){channel.onmessage=e=>{if(e.data.request)channel.postMessage({time:time(),playing,values:external,mode});else updateState(e.data);};channel.postMessage({request:true});}
const oldReceive=receive;
receive=function(p,src){if(typeof p==='string'){try{p=JSON.parse(p);}catch{p={cmd:p};}}if(!p||p.src==='Dweb')return;
const c=p.cmd||p.command||p.type;if(['next','prev','trigger','advance','goto','stage','scene','play','pause','data','reset','simulate','mode'].includes(c)){command({...p,cmd:c});if(typeof Dweb.onTrigger==='function')Dweb.onTrigger(p);}else oldReceive(p,src);};
Object.assign(Dweb,{next:()=>command({cmd:'next'}),prev:()=>command({cmd:'prev'}),goto:n=>command({cmd:'goto',stage:n}),scene:n=>command({cmd:'scene',n}),play:()=>command({cmd:'play'}),pause:()=>command({cmd:'pause'}),data:p=>command({cmd:'data',...p}),receive});
show=i=>command({cmd:'goto',stage:i+1});filmKick=()=>{};
sceneProgress=()=>{const t=time(),i=idx(t);return (t-starts[i])/((starts[i+1]||duration)-starts[i]);};
control.onclick=e=>{const b=e.target.closest('button');if(!b)return;command(b.dataset.scene?{cmd:'goto',stage:+b.dataset.scene}:{cmd:b.dataset.action});};
control.querySelector('input').oninput=e=>{const t=+e.target.value;if(endpoint){fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cmd:'seek',time:t})}).then(r=>r.json()).then(updateState).catch(()=>{});}else{pos=t;anchor=performance.now();channel?.postMessage({time:t,playing,values:external,mode});}};
document.getElementById('btnPlay').onclick=()=>command({cmd:playing?'pause':'play'});
document.getElementById('btnNext').onclick=Dweb.next;document.getElementById('btnPrev').onclick=Dweb.prev;
document.getElementById('mode').onchange=e=>command({cmd:'mode',value:e.target.value});
document.getElementById('ovSim').onchange=e=>command(e.target.checked?{cmd:'simulate'}:{cmd:'data',values:S.values});
document.getElementById('ovScene').innerHTML='<option value="auto">依六段時間軸</option>'+SCENES.map((s,i)=>`<option value="${i+1}">${i+1} ${s.name}</option>`).join('');
document.getElementById('ovScene').onchange=e=>{if(e.target.value!=='auto')Dweb.goto(+e.target.value);};
document.addEventListener('keydown',e=>{if(typing(e))return;const k=e.key.toLowerCase();if('123456'.includes(k)&&k.length===1||[' ','n','q','w','e'].includes(k)){e.preventDefault();e.stopImmediatePropagation();if(k===' ')command({cmd:playing?'pause':'play'});else if(k==='n')Dweb.next();else Dweb.goto(({q:1,w:4,e:5})[k]||+k);}},true);
async function poll(){if(!endpoint)return;const begin=performance.now();try{const r=await fetch(endpoint,{cache:'no-store'});if(!r.ok)throw Error();const s=await r.json();s.time+=s.playing?(performance.now()-begin)/2000:0;updateState(s);connected=true;lost=false;}catch{connected=false;lost=true;playing=false;}
 document.getElementById('syncState').textContent=connected?'已同步 · 共用分鏡 / 影片 / 數據': '同步中斷 · 展演暫停，等待重新連線';setTimeout(poll,200);}
poll();
function frame(now){let t=time();if(!endpoint&&mode==='wait'&&t>=(starts[idx(pos)+1]||duration)-.002){pos=t;anchor=now;playing=false;}
 const i=idx(t),p=(t-starts[i])/((starts[i+1]||duration)-starts[i]);
 if(i!==lastScene){const prev=lastScene;lastScene=i;setScene(i,true);story.dataset.scene=i+1;story.querySelector('h1').textContent=scenes[i][1];story.querySelector('.desc').textContent=scenes[i][2];
 chainEl.querySelectorAll('.node').forEach(el=>el.classList.toggle('act',el.firstElementChild?.textContent===`STAGE 0${i+1}`));
 story.querySelectorAll('.story-progress span').forEach((el,k)=>el.classList.toggle('active',k<=i));control.querySelectorAll('[data-scene]').forEach((b,k)=>b.setAttribute('aria-pressed',String(k===i)));
 if(prev>=0&&q.get('side')!=='right')send({src:'Dweb',junction:S.junction[prev]||`D_T${prev+1}`,type:i===(prev+1)%6?'stage_end':'stage_start',from:prev+1,to:i+1,ts:Date.now(),timeline:t});}
 if(now-lastRender>150){lastRender=now;S.override=!!external;if(external)S.values=external.slice();renderInfo(true);
 story.querySelector('.report').style.visibility=external?'hidden':'visible';
 aqiHist=Array.from({length:90},(_,k)=>{const at=Math.max(0,t-(89-k)),j=idx(at),f=(at-starts[j])/((starts[j+1]||duration)-starts[j]),e=f*f*(3-2*f);return aqiFromPM25(scenes[j][4][4]+(scenes[j][5][4]-scenes[j][4][4])*e);});drawSpark();
 story.querySelector('#storyTime').textContent=`0${i+1} / 06　·　${Math.floor(t).toString().padStart(2,'0')} / 90 s`;
 if(document.activeElement!==control.querySelector('input'))control.querySelector('input').value=t;
 const ambient=document.body.classList.contains('cinema'),period=Number.isFinite(filmV.duration)?filmV.duration:30,target=ambient?(ambientPos+(now-ambientAnchor)/1000)%period:t%period;
 if(filmV.readyState>=2&&!filmV.seeking){
  const drift=ambient?((target-filmV.currentTime+period*1.5)%period)-period/2:target-filmV.currentTime;
  // Small clock differences are corrected through playback speed, avoiding repeated decoder seeks.
  if(Math.abs(drift)>(ambient?1.2:.18)&&now-lastVideoSeek>3000){filmV.currentTime=target;lastVideoSeek=now;}
  filmV.playbackRate=ambient?1+Math.max(-.04,Math.min(.04,drift*.1)):1;
  if(ambient)filmV.loop=true;if(ambient||playing){if(filmV.paused)filmV.play().catch(()=>{});}else filmV.pause();
 }
 }
 window.dispatchEvent(new CustomEvent('dweb-frame',{detail:{time:t,scene:i,progress:p,playing,values:S.values.slice(),external:!!external}}));
 if(!document.body.classList.contains('cinema')){
 story.querySelector('#barrier').setAttribute('opacity',i===4?'.8':'0');
 story.querySelectorAll('.pollutants>div').forEach((el,k)=>el.classList.toggle('active',k===Math.min(5,Math.floor(p*6))));
 filmV.style.opacity=document.body.classList.contains('cinema')?'.42':i===5?String(.16*(1-p)):'.16';
 particles.querySelectorAll('circle').forEach((c,k)=>{const f=(t*.24+k*.618)%1,spread=Math.sin(k*8.31),drift=Math.cos(k*3.7);let x,y,alpha;
 if(i===2){x=155+spread*f*150;y=282-f*170;alpha=Math.sin(f*Math.PI)*(.3+.7*p);}
 else if(i===3){x=155+spread*130*(1-f);y=280-f*230;alpha=Math.sin(f*Math.PI);}
 else if(i===4){if(k<50){x=490-f*125;y=175-f*100+Math.sin(k)*12;alpha=.7;}else{x=210+f*130;y=245+drift*65;alpha=1-f;}}
 else if(i===5){x=490-f*390;y=170+Math.sin(f*5+k)*32+f*80;alpha=.3*(1-p);}
 else{x=75+(k*73%420);y=170+drift*75+Math.sin(t*.4+k)*10;alpha=i===0?.45:.12;}
 c.setAttribute('cx',x);c.setAttribute('cy',y);c.setAttribute('opacity',alpha);c.setAttribute('r',i===2?2.5:1.8);});
 }
 if(document.body.classList.contains('cinema'))filmV.style.opacity='.42';
 requestAnimationFrame(frame);}
requestAnimationFrame(frame);
})();
