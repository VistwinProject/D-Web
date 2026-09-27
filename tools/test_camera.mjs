import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraPose} from '../camera-timeline.mjs';
import {kitchenShots} from '../camera-shots.mjs';
import {equipmentAppearance} from '../equipment-appearance.mjs';
const events={heatOn:40.388,heatOff:100.458,exhaustOn:62.649,freshOn:75};const shots=kitchenShots([0,1,0],events);
test('camera remains continuous at every cue and independent of playback history',()=>{
 for(let i=1;i<shots.length;i++){
 const t=shots[i].time,a=cameraPose(shots,t-.0001),b=cameraPose(shots,t+.0001);
 for(const key of ['zoom','yaw','pitch'])assert.ok(Math.abs(a[key]-b[key])<.001);
 a.target.forEach((v,k)=>assert.ok(Math.abs(v-b.target[k])<.001));
 }
 const first=cameraPose(shots,12);cameraPose(shots,80);assert.deepEqual(cameraPose(shots,12),first);
 assert.deepEqual(cameraPose(shots,20,true),cameraPose(shots,0));
 assert.deepEqual(cameraPose(shots,999),cameraPose(shots,shots.at(-1).time));
 assert.deepEqual(shots.at(-1).target,shots[0].target);
});
test('IH and hood fade on their equipment cues, cool down and reset',()=>{
 assert.equal(equipmentAppearance(40,events).heatLevel,0);
 assert.ok(equipmentAppearance(41,events).heatLevel>0);
 assert.equal(equipmentAppearance(46,events).heatRed,1);
 assert.equal(equipmentAppearance(61,events).hoodLevel,0);
 assert.equal(equipmentAppearance(66,events).hoodLevel,1);
 assert.ok(equipmentAppearance(103,events).heatLevel<1);
 assert.equal(equipmentAppearance(109,events).heatLevel,0);
 assert.equal(equipmentAppearance(128,events).hoodLevel,0);
 assert.deepEqual(equipmentAppearance(0,events),{heatLevel:0,heatRed:0,hoodLevel:0});
});

test("spoken object gets a moderate close-up, followed by a full-room hold",()=>{
 for(const t of [42.5, 60.0, 78.0, 100.5])assert.ok(cameraPose(shots,t).zoom>=1.4);
 for(const t of [0, 20, 35, 48, 70, 85, 94, 106, 128]){const pose=cameraPose(shots,t);assert.equal(pose.zoom,1);assert.deepEqual(pose.target,shots[0].target);}
 assert.ok(shots.every(s=>s.yaw===0&&s.pitch===0&&s.zoom<=1.65));
});

import {focusEmphasis} from '../focus-emphasis.mjs';
test('focus stays on the named object, fades continuously and respects pause/reduced motion',()=>{
 const cue=shots.find(s=>s.focus),t=cue.time;
 assert.equal(focusEmphasis(shots,t).weights[cue.focus],1);
 const paused=focusEmphasis(shots,t+.1);focusEmphasis(shots,90);assert.deepEqual(focusEmphasis(shots,t+.1),paused);
 assert.equal(focusEmphasis(shots,t,true).pulse,focusEmphasis(shots,t+1,true).pulse);
 for(const s of shots.slice(1)) {const a=focusEmphasis(shots,s.time-.0001),b=focusEmphasis(shots,s.time+.0001);for(const k of new Set([...Object.keys(a.weights),...Object.keys(b.weights)]))assert.ok(Math.abs((a.weights[k]||0)-(b.weights[k]||0))<.001);}
 assert.deepEqual(focusEmphasis(shots,0).weights,{});assert.deepEqual(focusEmphasis(shots,999).weights,{});
});
