import {ihState} from './ih-simple-state.mjs';
let cue=null,received=0,lastWidth=0;
const strokes=[...document.querySelectorAll('svg rect,svg path,svg circle,svg line')].map(el=>[el,parseFloat(getComputedStyle(el).strokeWidth)||1]);
function thickness(value){const width=Math.max(.5,Math.min(3,Number(value)||1));if(width===lastWidth)return;lastWidth=width;for(const [el,base] of strokes)el.style.strokeWidth=base*width;}

window.addEventListener('message',e=>{if(e.source!==parent||e.origin!==location.origin||e.data?.type!=='d-mapping-cue')return;thickness(e.data.lineWidth);cue=e.data.cue;received=performance.now();});
function frame(){const s=ihState(cue,(performance.now()-received)/1000,window.D_SHOW);document.body.classList.toggle('is-on',s.on);document.getElementById('state-label').textContent=s.on?'開啟':'關閉';requestAnimationFrame(frame);}frame();
