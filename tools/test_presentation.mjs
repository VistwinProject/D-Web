import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildCaptions,captionAt} from '../caption-timeline.mjs';
import {equipmentAt} from '../presentation-cues.mjs';
import {roles,icon} from '../presentation-icons.mjs';
const show=JSON.parse(readFileSync(new URL('../show.json',import.meta.url))),cues=buildCaptions(show.clips);
test('all voice text survives segmentation, within its original clip and speaker',()=>{
 for(const clip of show.clips){const parts=cues.filter(c=>c.id.startsWith(clip.id+'-'));assert.equal(parts.map(p=>p.text).join(''),clip.text);assert.equal(parts[0].start,clip.start);assert.equal(parts.at(-1).end,clip.end);for(const p of parts){assert.ok([...p.text].length<=28);assert.ok(p.end>p.start);assert.equal(p.role,clip.role);assert.ok(roles[p.role]);assert.ok(icon(roles[p.role].icon).includes('<svg'));}}
});
test('fades, pause and backward seeks are clock-derived with no stale speaker',()=>{
 const first=cues[0];assert.equal(captionAt(cues,first.start).opacity,0);assert.ok(captionAt(cues,first.start+.15).opacity>0);assert.equal(captionAt(cues,first.start+.85).opacity,1);assert.ok(captionAt(cues,first.end-.05).opacity<.2);
 for(const id of ['d03-child','d03-mother','d04-alert']){const c=show.clips.find(c=>c.id===id);assert.equal(captionAt(cues,c.start+.5).cue.role,c.role);}assert.deepEqual(captionAt(cues,35),captionAt(cues,35));assert.equal(captionAt(cues,0).cue,null);assert.equal(captionAt(cues,show.duration-.1).cue,null);
});
test('equipment starts on real cue boundaries and survives heat-off until replay',()=>{
 for(const [id,event] of [['heat','heatOn'],['exhaust','exhaustOn'],['fresh','freshOn']]){const t=show.events[event];assert.equal(equipmentAt(show.events,t-.001,show.duration).find(e=>e.id===id).active,false);assert.equal(equipmentAt(show.events,t,show.duration).find(e=>e.id===id).status,'啟動中');assert.equal(equipmentAt(show.events,t+2,show.duration).find(e=>e.id===id).starting,false);}
 const after=equipmentAt(show.events,show.events.heatOff,show.duration);assert.equal(after[0].status,'已關火');assert.equal(after[1].active,true);assert.equal(after[2].active,true);assert.deepEqual(equipmentAt(show.events,64,show.duration),equipmentAt(show.events,64,show.duration));assert.ok(equipmentAt(show.events,0,show.duration).every(e=>!e.active&&e.rotation===0));
});

test('added introduction shifts equipment close-ups with the voice clock',()=>{
 const offset=show.events.heatOn-40.388,shots=kitchenShots([0,1,0],show.events,show.duration);
 for(const t of [0,show.intro.end/2,show.intro.end])assert.equal(cameraPose(shots,t).zoom,1);
 assert.ok(cameraPose(shots,42.5+offset).zoom>=1.4);
 assert.ok(cameraPose(shots,show.events.exhaustOn-2.649).zoom>=1.4);
 for(let i=1;i<shots.length;i++)assert.ok(shots[i].time>=shots[i-1].time);
});
import {kitchenShots,cameraPose} from '../camera-shots.mjs';

test('narration flows across scene boundaries without long silent holds',()=>{
 for(let i=1;i<show.clips.length;i++){
  const gap=show.clips[i].start-show.clips[i-1].end;
  assert.ok(gap>0&&gap<=(show.clips[i].id==='d05-fresh'?3.551:1.001),`${show.clips[i].id}: ${gap}s gap`);
 }
 assert.equal(show.duration-show.clips.at(-1).end,3.5);
});
