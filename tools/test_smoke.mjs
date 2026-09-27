import test from 'node:test';
import assert from 'node:assert/strict';
import {smokeParticle} from '../smoke-particles.mjs';
const options={heatOff:110.569,exhaustOn:87.003,hoodOffset:[0,.595,.02]};
test('capture persists through fresh-air and purification scenes without scattering',()=>{
 for(let k=0;k<90;k++)for(let t=89;t<116;t+=.1){
  const p=smokeParticle(k,t,options);
  assert.ok(p.y>=0&&p.y<=.595);assert.ok(Math.abs(p.x)<.28&&Math.abs(p.z-.02)<.18);
 }
});
test('continuous emission occupies source and broad intake until heat is off',()=>{
 for(let t=93;t<110.5;t+=.2){
  const points=Array.from({length:90},(_,k)=>smokeParticle(k,t,options));
  assert.ok(points.filter(p=>p.y<.12&&p.alpha>.1).length>=4);
  const top=points.filter(p=>p.y>.42&&p.alpha>.1);
  assert.ok(top.length>=5);
  assert.ok(Math.max(...top.map(p=>p.x))-Math.min(...top.map(p=>p.x))>.25);
 }
});
test('heat-off preserves existing paths, then particles finish without respawn',()=>{
 for(let k=0;k<90;k++){
  const before=smokeParticle(k,options.heatOff-.00001,options);
  let previous=smokeParticle(k,options.heatOff,options);
  for(const key of ['x','y','z','alpha'])assert.ok(Math.abs(before[key]-previous[key])<.001);
  let gone=false;
  for(let age=.1;age<20;age+=.1){
   const next=smokeParticle(k,options.heatOff+age,options);
   assert.ok(next.y>=previous.y);if(gone)assert.equal(next.alpha,0);
   gone ||= next.alpha===0;previous=next;
  }
  assert.equal(previous.alpha,0);
 }
});
test('pause, seek and replay remain deterministic',()=>{
 const first=smokeParticle(12,108,options);smokeParticle(12,130,options);
 assert.deepEqual(smokeParticle(12,108,options),first);
});
