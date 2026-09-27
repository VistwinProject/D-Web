import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {filmCueAt,filmLayersAt,FILM_DISSOLVE} from '../film-cues.mjs';
const show=JSON.parse(readFileSync(new URL('../show.json',import.meta.url)));
test('footage follows narration and equipment cues',()=>{
 assert.equal(filmCueAt(show,0).clip,null);
 assert.equal(filmCueAt(show,show.starts[1]).clip,null);
 assert.equal(filmCueAt(show,show.events.heatOn-.01).clip,null);
 assert.equal(filmCueAt(show,show.events.heatOn).clip,'red');
 assert.equal(filmCueAt(show,show.events.exhaustOn).clip,'exhaust');
 assert.equal(filmCueAt(show,show.events.freshOn).clip,'green');
});
test('first two scenes have no footage or leftover transition layers',()=>{
 for(let t=0;t<show.starts[2];t+=.1)assert.deepEqual(filmLayersAt(show,t),[]);
});
test('both videos overlap and move through a smooth 2.4 second dissolve',()=>{
 for(const start of [show.events.exhaustOn,show.events.freshOn]){
  const beginning=filmLayersAt(show,start),middle=filmLayersAt(show,start+FILM_DISSOLVE/2),end=filmLayersAt(show,start+FILM_DISSOLVE+.001);
  assert.equal(beginning.length,1);assert.equal(end.length,1);assert.equal(middle.length,2);
  for(const layer of middle)assert.ok(Math.abs(layer.weight-.5)<.001);
  assert.ok(middle[0].localTime>beginning[0].localTime);
  assert.deepEqual(filmLayersAt(show,start+FILM_DISSOLVE/2),middle);
 }
 assert.equal(filmLayersAt(show,show.events.heatOn).length,0);
 assert.ok(filmLayersAt(show,show.events.heatOn+1)[0].weight<1);
});
test('final purification continues its green clip without restarting or looping',()=>{
 const before=filmCueAt(show,show.starts[5]-.01),after=filmCueAt(show,show.starts[5]+.01);
 assert.equal(before.id,after.id);assert.ok(after.localTime>before.localTime);
 assert.ok(Math.abs(filmCueAt(show,show.duration).localTime-18.4)<.0001);
 assert.equal(filmCueAt(show,0).localTime,0);
});
