import test from 'node:test';
import assert from 'node:assert/strict';
import {smokeParticle} from '../smoke-particles.mjs';
const options={purificationStart:102.611,exhaustOn:87.003,hoodOffset:[0,.595,.02]};
const distance=p=>Math.hypot(p.x,p.y-.595,p.z-.02);
test('fresh-air transition cannot switch captured smoke back to free dispersion',()=>{
 for(let k=0;k<90;k++)for(let t=89;t<options.purificationStart;t+=.1){
  const p=smokeParticle(k,t,options);assert.ok(p.y>=0&&p.y<=.595);
  const f=p.y/.595;assert.ok(Math.hypot(p.x,p.z-.02*f)<=.181*(1-f));
 }
});
test('purification starts from the existing captured particles without a jump',()=>{
 for(let k=0;k<90;k++){
  const before=smokeParticle(k,options.purificationStart-.00001,options),after=smokeParticle(k,options.purificationStart,options);
  for(const key of ['x','y','z','alpha'])assert.ok(Math.abs(before[key]-after[key])<.001);
 }
});
test('residual smoke only moves toward the intake, fades and never respawns',()=>{
 for(let k=0;k<90;k++){
  let previous=smokeParticle(k,options.purificationStart,options);
  for(let age=.1;age<=25;age+=.1){
   const next=smokeParticle(k,options.purificationStart+age,options);
   assert.ok(distance(next)<=distance(previous)+1e-10);
   assert.ok(next.alpha<=previous.alpha&&next.alpha>=0);
   previous=next;
  }
  assert.equal(previous.alpha,0);
 }
});
test('pause, seek and replay remain deterministic',()=>{
 const first=smokeParticle(12,110,options);smokeParticle(12,130,options);
 assert.deepEqual(smokeParticle(12,110,options),first);
 assert.equal(smokeParticle(12,80,options).alpha,1);
});
