import test from 'node:test';
import assert from 'node:assert/strict';
import {freshAirParticle} from '../fresh-air-particles.mjs';
const start=93.232;
test('fresh air begins only after activation and stays in clear room space',()=>{
 for(let k=0;k<100;k++){
  assert.equal(freshAirParticle(k,start-.001,start).alpha,0);
  for(let t=start;t<141;t+=.2){const p=freshAirParticle(k,t,start);if(!p.alpha)continue;
   assert.ok(p.z<-.60 && p.z>-1.5);assert.ok(p.y>.6 && p.y<2.45);assert.ok(p.x>-1.4&&p.x<1.55);
  }
 }
});
test('fresh air travels from screen lower-right to upper-left across a broad volume',()=>{
 let checked=0;
 for(let k=0;k<100;k++)for(let t=start;t<start+20;t+=.1){
  const a=freshAirParticle(k,t,start),b=freshAirParticle(k,t+.01,start);
  if(a.alpha<.1||b.y<a.y||b.x<a.x)continue;
  // Camera basis for the fixed [-1,1,-1] isometric view.
  assert.ok(-b.x+b.z < -a.x+a.z);
  assert.ok(b.x+2*b.y+b.z > a.x+2*a.y+a.z);checked++;
 }
 assert.ok(checked>1000);
 const points=Array.from({length:100},(_,k)=>freshAirParticle(k,108,start)).filter(p=>p.alpha>.1);
 const width=key=>Math.max(...points.map(p=>p[key]))-Math.min(...points.map(p=>p[key]));
 assert.ok(width('x')>1.3);assert.ok(width('z')>.4);assert.ok(width('y')>.65);
 assert.deepEqual(freshAirParticle(25,110,start),freshAirParticle(25,110,start));
});
