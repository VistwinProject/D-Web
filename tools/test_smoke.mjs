import test from 'node:test';
import assert from 'node:assert/strict';
import {smokeParticle} from '../smoke-particles.mjs';
const options={purificationStart:102.611};
test('purification preserves the existing cloud at its boundary',()=>{
 for(let k=0;k<90;k++){
  const before=smokeParticle(k,options.purificationStart-.00001,options),after=smokeParticle(k,options.purificationStart,options);
  for(const key of ['x','y','z','alpha'])assert.ok(Math.abs(before[key]-after[key])<.001);
 }
});
test('residual particles keep drifting, never respawn, and fade completely',()=>{
 for(let k=0;k<90;k++){
  let previous=smokeParticle(k,options.purificationStart,options);
  for(let age=.1;age<=33;age+=.1){
   const next=smokeParticle(k,options.purificationStart+age,options);
   assert.ok(next.y>previous.y);assert.ok(next.alpha<=previous.alpha);assert.ok(next.alpha>=0);
   assert.ok(Math.hypot(next.x-previous.x,next.y-previous.y,next.z-previous.z)<.02);
   previous=next;
  }
  assert.equal(previous.alpha,0);
 }
});
test('pause, direct chapter jumps and replay produce the same particle state',()=>{
 const first=smokeParticle(12,110,options);smokeParticle(12,130,options);
 assert.deepEqual(smokeParticle(12,110,options),first);
 assert.equal(smokeParticle(12,90,options).alpha,1);
});
