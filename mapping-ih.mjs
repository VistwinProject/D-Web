import {ihState} from './ih-simple-state.mjs';
let cue=null,received=0,lastWidth=0,lineWidth=1,layout='';
const svg=document.getElementById('surface');
const singleMarkup=svg.innerHTML,singleViewBox=svg.getAttribute('viewBox');
const reactorMarkup=document.getElementById('reactor').innerHTML;
let strokes=[];
function collect(){strokes=[...svg.querySelectorAll('rect,path,circle,line')].map(el=>{el.style.strokeWidth='';return [el,parseFloat(getComputedStyle(el).strokeWidth)||1];});}
function thickness(value){const width=Math.max(.5,Math.min(3,Number(value)||1));if(width===lastWidth)return;lastWidth=width;for(const [el,base] of strokes)el.style.strokeWidth=base*width;}

// 雙口爐：一個共用的大紅框，裡面左右兩個加熱環。viewBox 跟著該區的裁切比例，
// 所以框會貼滿裁切範圍，四角對到實體爐面後兩個環仍是正圓。
function dualMarkup(W,H){
 const ctrl=H-150,cy=(41+ctrl)/2,s=Math.min((ctrl-41)/2/300,(W/2-60)/300)*.8;
 const reactor=x=>`<g transform="translate(${x} ${cy}) scale(${s.toFixed(3)})">${reactorMarkup}</g>`;
 return `<g id="hob-frame" aria-label="俯視雙口 IH 爐，共用玻璃外框">
<rect x="20" y="43" width="${W-40}" height="${H-70}" rx="37" class="chassis" />
<rect x="30" y="30" width="${W-60}" height="${H-80}" rx="30" class="glass-edge" />
<rect x="41" y="41" width="${W-82}" height="${H-102}" rx="22" class="glass-inner" />
<path d="M30 70L21 83M${W-30} 70L${W-21} 83M30 ${H-89}L21 ${H-76}M${W-30} ${H-89}L${W-21} ${H-76}" class="edge-joins" />
<path d="M30 114V${H-176}M${W-30} 114V${H-176}" class="edge-glint" />
<path d="M52 ${H-92}Q52 ${H-73} 71 ${H-73}H${W-71}Q${W-52} ${H-73} ${W-52} ${H-92}" class="front-lip" />
<path d="M54 ${ctrl}H${W-54}" class="control-divider" />
<g class="touch-controls" transform="translate(${W/2} ${H-109})"><circle r="22" /><path d="M0 -14V1M-10 -8A14 14 0 1 0 10 -8" /><path d="M-170 0H-148M148 0H170M159 -11V11" /><path d="M-115 0H-60M60 0H115" stroke-dasharray="2 9" /></g>
</g>
<g id="reactor">${reactor(W/4)}${reactor(W*3/4)}</g>
<g id="ih-icon" transform="translate(124 96)" aria-label="IH 感應爐標示">
<g fill="none" stroke="currentColor" stroke-width="2"><path d="M-32 -6C-44 -20 -7 -24 -10 -8S-37 12 -29 20M-20 -6C-32 -20 5 -24 2 -8S-25 12 -17 20M-8 -6C-20 -20 17 -24 14 -8S-13 12 -5 20" /><path d="M-44 28H22" /></g>
<text x="42" y="2" class="ih-mark">IH</text>
</g>`;
}

// 裁切比例 ≥ 1（16:9、21:9、1:1）畫雙口；直式（預設 9:14）維持原本單口。
function arrange(aspect){
 const a=Number(aspect),dual=Number.isFinite(a)&&a>=1,key=dual?'dual:'+a.toFixed(3):'single';
 if(key===layout)return;layout=key;
 if(dual){const H=900,W=Math.round(H*a);svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.innerHTML=dualMarkup(W,H);}
 else{svg.setAttribute('viewBox',singleViewBox);svg.innerHTML=singleMarkup;}
 collect();lastWidth=0;thickness(lineWidth);
}
collect();

window.addEventListener('message',e=>{if(e.source!==parent||e.origin!==location.origin||e.data?.type!=='d-mapping-cue')return;lineWidth=e.data.lineWidth;arrange(e.data.aspect);thickness(lineWidth);cue=e.data.cue;received=performance.now();});
function frame(){const s=ihState(cue,(performance.now()-received)/1000,window.D_SHOW);document.body.classList.toggle('is-on',s.on);document.getElementById('state-label').textContent=s.on?'開啟':'關閉';requestAnimationFrame(frame);}frame();
