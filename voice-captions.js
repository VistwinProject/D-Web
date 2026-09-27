import {buildCaptions,captionAt} from './caption-timeline.mjs?v=slow-1';
import {equipmentAt} from './presentation-cues.mjs';
import {icon,roles} from './presentation-icons.mjs?v=roles-2';
const show=window.D_SHOW;
if(show){
 const cues=buildCaptions(show.clips,28),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let previous='',host,rail;
 window.addEventListener('dweb-frame',({detail:d})=>{
  const found=document.querySelector('.left-screen .narration');
  if(!found||!Number.isFinite(d.time))return;
  if(found!==host){
   host=found;previous='';host.setAttribute('aria-live','polite');host.setAttribute('aria-atomic','true');
   host.innerHTML='<div class="subtitle-idle" aria-hidden="true"></div><div class="subtitle-content"><div class="speaker-line"><span class="speaker-icon"></span><strong class="speaker-name" hidden></strong><span class="speaking-bars" aria-hidden="true">▂ ▅ ▃ ▆</span></div><p class="subtitle-text"></p></div>';
   rail=document.createElement('section');rail.className='equipment-status';rail.setAttribute('aria-label','展演設備狀態');
   rail.innerHTML=equipmentAt(show.events,0,show.duration).map(e=>`<div class="equipment-state" data-equipment="${e.id}"><span class="machine-icon">${icon(e.id)}</span><div><b>${e.label}</b><span class="machine-state">待機</span></div><i class="machine-led" aria-hidden="true"></i></div>`).join('');
   document.querySelector('.right-screen').append(rail);
  }
  const {cue,opacity}=captionAt(cues,d.time),key=cue?.id||'idle';
  if(key!==previous){
   previous=key;host.classList.toggle('is-speaking',!!cue);host.dataset.speaker=cue?.role||'';host.querySelector('.subtitle-content').setAttribute('aria-hidden',String(!cue));
   if(!cue){host.querySelector('.subtitle-text').textContent='';host.querySelector('.speaker-name').textContent='';host.querySelector('.speaker-name').hidden=true;host.classList.remove('has-character');}
   if(cue){const role=roles[cue.role]||roles['旁白'];host.style.setProperty('--speaker-color',role.color);const name=host.querySelector('.speaker-name');name.textContent=role.label||'';name.hidden=!role.label;host.classList.toggle('has-character',!!role.label);host.querySelector('.speaker-icon').innerHTML=icon(role.icon);host.querySelector('.subtitle-text').textContent=cue.text;}
  }
  host.querySelector('.subtitle-content').style.opacity=String(reduced.matches&&cue?1:opacity);
  host.classList.toggle('is-paused',!d.playing);
  for(const e of equipmentAt(show.events,d.time,show.duration)){
   const el=rail.querySelector(`[data-equipment="${e.id}"]`);
   el.classList.toggle('is-on',e.active);el.classList.toggle('is-starting',e.starting);
   el.style.setProperty('--spin',(reduced.matches?0:e.rotation)+'deg');el.style.setProperty('--pulse',String(reduced.matches?1:e.pulse));
   const status=el.querySelector('.machine-state');if(status.textContent!==e.status)status.textContent=e.status;
   el.setAttribute('aria-label',e.label+'：'+e.status);
  }
 });
}
