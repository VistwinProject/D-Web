import * as THREE from 'three';
import {GLTFLoader} from './vendor/loaders/GLTFLoader.js';
import {mergeGeometries} from './vendor/utils/BufferGeometryUtils.js';
if(window.theaterActive) {
const stage=document.querySelector('.stage');document.body.classList.add('cinema');
const names=['隱形風險','正常偵測','烹飪污染','負壓排煙','正壓守護','持續淨化'];
const tones=['#a69bf5','#70df9f','#ff6258','#ffc278','#54ddab','#a9e1b8'];
const titles=['看不見的風險，\n從這裡被看見。','家的空氣，\n正在被照顧。','一餐之間，\n空氣正在改變。','在污染源頭，\n把油煙帶走。','讓乾淨的空氣，\n守護生活空間。','回到平穩，\n把安心留在家。'];
const descriptions=['呼吸、家具與烹飪，都會改變室內空氣。讓隱形的變化，成為看得見的訊息。','持續觀察六項指標，建立家的空氣基準。','爐台油煙向室內擴散，細懸浮微粒與揮發性有機物持續升高。','在集煙口形成負壓，將油煙集中帶離，減少向室內擴散。','補入過濾後的新鮮空氣，以氣流阻隔污染進入休息空間。','烹飪結束後持續淨化，確認空氣數值回穩，再回報處理結果。'];
const states=['辨識隱形污染','空氣品質穩定','烹飪污染升高','正在集中排煙','潔淨氣流守護','淨化完成'];
const ui=document.createElement('section');ui.className='cinema-ui';
ui.innerHTML=`<div class="left-screen"><header><span>寶舖 · 居家風險劇場</span><span>D / AIR</span></header><div class="chapter"><b class="chapter-number">01</b><span>/ 06</span><i class="chapter-name">隱形風險</i></div><h1></h1><p class="narration"></p><div class="state-label"><i></i><span></span></div><div class="primary-metric"><div><span id="primary-label">PM2.5</span><small id="primary-desc">細懸浮微粒</small></div><strong id="primary-value">10</strong><span id="primary-unit">µg/m³</span><p id="primary-note"></p></div><div class="metric-strip"></div><div class="history"><span>空氣變化 · 展演歷程</span><svg viewBox="0 0 400 65" preserveAspectRatio="none"><path id="history-fill"/><path id="history-line"/></svg></div><footer><span>展演模擬 · 非現場量測</span><span id="leftTime">00 / 90 s</span></footer></div><div class="right-screen"><header><span>廚房 · 空間演示</span><span>3D VIEW</span></header><div class="chapter"><b class="chapter-number">01</b><span>/ 06</span><i class="chapter-name">隱形風險</i></div><div id="kitchen-viewport" role="img" aria-label="由場地模型轉換的立體廚房，呈現檯面、櫃體及展演氣流"><div id="modelStatus">正在載入場地模型</div><span class="equipment-pin" id="hoodPin">集煙口</span><span class="equipment-pin" id="hobPin">烹飪源</span><span class="equipment-pin" id="freshPin">潔淨新風</span></div><div class="scene-explanation"><span class="process-number">01 — SENSE</span><h2></h2><p></p></div><footer><span>場地模型 · 氣流與設備為展演示意</span><span class="chapter-name">隱形風險</span></footer></div>`;
stage.append(ui);
const metricNames=['CO₂','HCHO','TVOC','PM1','PM2.5','PM10'];const units=['ppm','ppm','mg/m³','µg/m³','µg/m³','µg/m³'];
ui.querySelector('.metric-strip').innerHTML=metricNames.map((s,i)=>`<div><span>${s}</span><strong data-metric="${i}">—</strong><small>${units[i]}</small></div>`).join('');
const process=[['01 — SENSE','讓污染現形','六種空氣指標，描繪看不見的居家風險。'],['02 — MONITOR','持續感知','偵測室內變化，讓每次異常都有跡可循。'],['03 — DETECT','油煙正在擴散','暖色粒子由檯面升起，呈現污染的移動。'],['04 — EXHAUST','在源頭收束','污染粒子向上集中，經集煙口排出。'],['05 — PROTECT','建立潔淨屏障','青綠氣流補入，阻隔殘留油煙擴散。'],['06 — RESTORE','本輪淨化報告','PM2.5　200 → 10 µg/m³　·　模擬下降 95%']];
const viewport=ui.querySelector('#kitchen-viewport');
let renderer,scene,camera,room,glow,hoodLight,smoke,smokeGeo,fresh,freshGeo;
const origin=new THREE.Vector3(-.6,.85,1.05),exhaust=new THREE.Vector3(-.6,1.72,1.05),inlet=new THREE.Vector3(-1.6,1.9,-.5);
const smokeCount=90,freshCount=55;
const hash=n=>{const v=Math.sin(n*127.1)*43758.5453;return v-Math.floor(v);};
let current={time:0,scene:0,progress:0,values:[480,.03,.2,8,10,20]},lastScene=-1;
function box(w,h,d,material,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry,25),new THREE.LineBasicMaterial({color:0xc1d4da,transparent:true,opacity:.6})));scene.add(m);return m;}
function fitCamera(){
 if(!room||!camera)return;
 const bounds=new THREE.Box3().setFromObject(room),target=bounds.getCenter(new THREE.Vector3());
 const direction=new THREE.Vector3(-.53,.38,.74).normalize();
 const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize();
 const up=new THREE.Vector3().crossVectors(direction,right).normalize();
 const tanV=Math.tan(THREE.MathUtils.degToRad(camera.fov)/2),tanH=tanV*camera.aspect;
 let distance=0;
 // Fit the actual projected corners instead of the room's oversized diagonal sphere.
 for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
  const point=new THREE.Vector3(x,y,z).sub(target),depth=point.dot(direction);
  distance=Math.max(distance,depth+Math.abs(point.dot(right))/tanH,depth+Math.abs(point.dot(up))/tanV);
 }
 camera.position.copy(target).addScaledVector(direction,distance*1.04);camera.lookAt(target);camera.zoom=1.4;camera.updateProjectionMatrix();camera.updateMatrixWorld();
}
function pointTexture(){const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(32,32,1,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.3,'rgba(255,255,255,1)');g.addColorStop(.55,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);}
const renderKitchen=new URLSearchParams(location.search).get('side')!=='left';
let lastUIUpdate=-Infinity;
try{
 if(renderKitchen){
 renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;renderer.shadowMap.enabled=false;
 viewport.prepend(renderer.domElement);scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(36,1,.05,60);
 camera.position.set(-5.1,4.6,6.8);camera.lookAt(.05,1.0,0);
 const ambient=new THREE.HemisphereLight(0xddefff,0x61554b,.7);scene.add(ambient);
 const key=new THREE.DirectionalLight(0xffedda,1.8);key.position.set(-3,7,4);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-5;key.shadow.camera.right=5;key.shadow.camera.top=5;key.shadow.camera.bottom=-5;key.shadow.normalBias=.015;scene.add(key);
 glow=new THREE.PointLight(tones[0],9,5,2);glow.position.set(-.6,1.2,1.05);scene.add(glow);
 hoodLight=new THREE.PointLight(0xffe5b8,.5,2);hoodLight.position.set(-.6,1.55,1.05);scene.add(hoodLight);
 const metal=new THREE.MeshBasicMaterial({color:0x95bccb,transparent:true,opacity:.10,depthWrite:false,side:THREE.DoubleSide});
 const glass=new THREE.MeshBasicMaterial({color:0x8da9bc,transparent:true,opacity:.08,depthWrite:false,side:THREE.DoubleSide});
 box(.59,.025,.46,glass,-.6,.815,1.05);
 for(const dx of [-.16,.16]){const ring=new THREE.Mesh(new THREE.TorusGeometry(.09,.004,8,48),new THREE.MeshBasicMaterial({color:0xc1d4da,transparent:true,opacity:.65}));ring.rotation.x=-Math.PI/2;ring.position.set(-.6+dx,.832,1.05);scene.add(ring);}
 const pot=new THREE.Mesh(new THREE.CylinderGeometry(.095,.08,.075,48),metal);pot.position.set(-.76,.87,1.05);pot.castShadow=true;scene.add(pot);
 box(.74,.075,.55,metal,-.6,1.72,1.05);box(.25,.4,.2,metal,-.6,1.955,.9);
 box(.61,.008,.4,glass,-.6,1.678,1.05);
 const texture=pointTexture();smokeGeo=new THREE.BufferGeometry();smokeGeo.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(smokeCount*3),3));
 smoke=new THREE.Points(smokeGeo,new THREE.PointsMaterial({map:texture,color:0xff4036,size:.36,transparent:true,opacity:.95,depthWrite:false,depthTest:false,toneMapped:false}));smoke.renderOrder=5;scene.add(smoke);
 freshGeo=new THREE.BufferGeometry();freshGeo.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(freshCount*3),3));fresh=new THREE.Points(freshGeo,new THREE.PointsMaterial({map:texture,color:0x32ef82,size:.28,transparent:true,opacity:1,depthWrite:false,depthTest:false,toneMapped:false}));fresh.renderOrder=6;fresh.frustumCulled=false;smoke.frustumCulled=false;scene.add(fresh);
 new GLTFLoader().load('assets/kitchen.glb',g=>{g.scene.updateMatrixWorld(true);const batches=new Map();room=new THREE.Group();g.scene.traverse(o=>{if(o.isMesh){const geo=o.geometry.clone().applyMatrix4(o.matrixWorld);const key=Object.keys(geo.attributes).sort().join(',');if(!batches.has(key))batches.set(key,[]);batches.get(key).push(geo);}});const surface=new THREE.MeshBasicMaterial({color:0xa8bdc5,transparent:true,opacity:.028,depthWrite:false,side:THREE.DoubleSide});const outline=new THREE.LineBasicMaterial({color:0xb3c7cf,transparent:true,opacity:.4,depthWrite:false});for(const geos of batches.values()){const geometry=mergeGeometries(geos,false);room.add(new THREE.Mesh(geometry,surface));room.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry,35),outline));}scene.add(room);fitCamera();ui.querySelector('#modelStatus').hidden=true;viewport.dataset.ready='true';},undefined,()=>{ui.querySelector('#modelStatus').textContent='模型載入失敗 · 請重新整理';});
 new ResizeObserver(()=>{const w=viewport.clientWidth,h=viewport.clientHeight;if(w&&h){let ratio=1;if(new URLSearchParams(location.search).get('preview')==='1'&&window.parent!==window){try{ratio=Math.min(1,window.parent.document.querySelector('main').clientWidth/2160*devicePixelRatio);}catch{}}renderer.setPixelRatio(Math.max(.25,ratio));renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();fitCamera();}}).observe(viewport);
 }
}catch(e){ui.querySelector('#modelStatus').textContent='此瀏覽器無法啟動 3D，請使用支援 WebGL 的瀏覽器';}
function pin(id,point,visible){const el=ui.querySelector(id);el.hidden=!visible;if(!visible||!camera)return;const v=point.clone().project(camera);el.style.left=Math.max(8,Math.min(75,(v.x*.5+.5)*100))+'%';el.style.top=Math.max(8,Math.min(85,(-v.y*.5+.5)*100))+'%';}
function update(d){current=d;const i=d.scene,t=d.time,p=d.progress,v=d.values||[];
 const updateUI=i!==lastScene||performance.now()-lastUIUpdate>=150;
 if(updateUI){lastUIUpdate=performance.now();
 if(i!==lastScene){lastScene=i;stage.dataset.phase=i+1;stage.style.setProperty('--state',tones[i]);stage.style.setProperty('--wash',tones[i]+'20');ui.querySelectorAll('.chapter-number').forEach(e=>e.textContent=String(i+1).padStart(2,'0'));ui.querySelectorAll('.chapter-name').forEach(e=>e.textContent=names[i]);ui.querySelector('h1').textContent=titles[i];ui.querySelector('.narration').textContent=descriptions[i];ui.querySelector('.state-label span').textContent=states[i];ui.querySelector('.process-number').textContent=process[i][0];ui.querySelector('.scene-explanation h2').textContent=process[i][1];ui.querySelector('.scene-explanation p').textContent=process[i][2];if(glow)glow.color.set(tones[i]);}
 const introIndex=Math.min(5,Math.floor(p*6)),primary=i===0?introIndex:4;
 ui.querySelector('#primary-label').textContent=metricNames[primary];ui.querySelector('#primary-desc').textContent=['二氧化碳','甲醛','揮發性有機物','超細懸浮微粒','細懸浮微粒','懸浮微粒'][primary];
 ui.querySelector('#primary-unit').textContent=units[primary];ui.querySelector('#primary-value').textContent=primary===1||primary===2?Number(v[primary]||0).toFixed(2):Math.round(v[primary]||0);
 ui.querySelector('#primary-note').textContent=i===0?['呼吸累積 · 通風不足','裝潢與家具逸散','油煙與清潔用品揮發','高溫烹飪 · 煙霧','煎炒油煙 · 室外污染','灰塵 · 花粉'][introIndex]:i===2?'烹飪情境 · 最高模擬值 200':i===5?'本輪模擬下降 95%':'模擬濃度 · 隨展演情境變化';
 ui.querySelectorAll('[data-metric]').forEach(e=>{const k=+e.dataset.metric;e.textContent=k===1||k===2?Number(v[k]||0).toFixed(2):Math.round(v[k]||0);});
 stage.style.setProperty('--metric-state',i===0?tones[0]:Number(v[4])>35?tones[2]:tones[1]);
 ui.querySelector('#leftTime').textContent=`${Math.floor(t).toString().padStart(2,'0')} / 90 s`;
 const pts=document.querySelector('#sparkLine').getAttribute('points');if(pts){const arr=pts.split(' ').map(s=>s.split(',').map(Number));const path=arr.map(([x,y],j)=>`${j?'L':'M'}${x*400/260},${y*65/40}`).join(' ');ui.querySelector('#history-line').setAttribute('d',path);ui.querySelector('#history-fill').setAttribute('d',path+'L400 65L0 65Z');}
 if(d.external){ui.querySelector('#primary-note').textContent='外部展演數據接管';if(i===5)ui.querySelector('.scene-explanation p').textContent='目前顯示外部輸入數值，不套用固定模擬淨化報告。';}
 }
 if(!renderer||!smoke)return;
 // All positions derive from the shared exhibition clock, not random frame state.
 const arr=smokeGeo.attributes.position.array;smoke.visible=i!==1;smoke.material.opacity=i===0?.6:i===2?1:i===3?.95:i===4?.55:.3*(1-p);
 for(let k=0;k<smokeCount;k++){const f=(t*.22+hash(k+41))%1,a=hash(k+713)*Math.PI*2,spread=(i===3?.4*(1-f):.06+f*.95)*Math.sqrt(hash(k+313));
 arr[k*3]=origin.x+Math.cos(a)*spread;arr[k*3+1]=origin.y+f*(i===3?1.27:1.55);arr[k*3+2]=origin.z+Math.sin(a)*spread+(i===2?f*.55:0);}
 smokeGeo.attributes.position.needsUpdate=true;
 fresh.visible=i===1||i>=4;fresh.material.opacity=i===5?.65+.35*(1-p):1;
 const fp=freshGeo.attributes.position.array;for(let k=0;k<freshCount;k++){const f=(t*.18+hash(k+981))%1;fp[k*3]=inlet.x+f*2.9;fp[k*3+1]=inlet.y+Math.sin(f*Math.PI)*.28+Math.sin(k)*.1;fp[k*3+2]=inlet.z+f*1.5+Math.cos(k)*.1;}freshGeo.attributes.position.needsUpdate=true;
 glow.intensity=i===2?1+p*2:i===3?2:i===4?2:1;
 pin('#hobPin',origin,i===2);pin('#hoodPin',exhaust,i===3);pin('#freshPin',inlet,i===4);
 renderer.render(scene,camera);
}
window.addEventListener('dweb-frame',e=>update(e.detail));
}

