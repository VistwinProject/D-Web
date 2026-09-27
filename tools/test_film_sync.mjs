import test from 'node:test';
import assert from 'node:assert/strict';
import {createFilmSync} from '../film-sync.mjs';
function setup(){
 const events={},jobs=[];let now=0;
 const video={dataset:{},currentTime:0,duration:30,readyState:4,seeking:false,paused:true,plays:0,loads:0,pause(){this.paused=true},play(){this.plays++;return Promise.resolve()},load(){this.loads++;this.readyState=0},getAttribute:()=> 'film.mp4',addEventListener:(k,v)=>events[k]=v};
 const control=createFilmSync(video,{schedule:f=>jobs.push(f),now:()=>now});
 return {video,control,events,jobs,at(t){now=t}};
}
test('buffering does not repeatedly seek or enqueue play calls',async()=>{
 const s=setup();s.video.readyState=1;
 for(let t=0;t<10000;t+=150)s.control.sync(t/1000,true,t);
 assert.equal(s.video.currentTime,0);assert.equal(s.video.plays,0);
 s.video.readyState=4;s.control.sync(0,true,10000);s.control.sync(0,true,10150);assert.equal(s.video.plays,1);
 await Promise.resolve();await Promise.resolve();
});
test('media seeks once on jump, pauses with the clock, and holds the final frame',()=>{
 const s=setup();s.control.sync(12,false,0);assert.equal(s.video.currentTime,12);assert.equal(s.video.paused,true);
 s.video.seeking=true;s.control.sync(13,true,3000);assert.equal(s.video.currentTime,12);
 s.video.seeking=false;s.control.sync(40,true,6000);assert.equal(s.video.currentTime,29.95);assert.equal(s.video.paused,true);assert.equal(s.video.loop,false);
 s.control.sync(0,false,9000);assert.equal(s.video.currentTime,0);
});
test('network errors get bounded retries and a usable fallback state',()=>{
 const s=setup();s.events.error();s.events.error();assert.equal(s.jobs.length,1);
 s.jobs.shift()();assert.equal(s.video.loads,1);s.events.error();s.jobs.shift()();s.events.error();
 assert.equal(s.video.loads,2);assert.equal(s.jobs.length,0);assert.equal(s.video.dataset.filmState,'unavailable');
});
test('a stalled load recovers without stalling the exhibition clock',()=>{
 const s=setup();s.video.readyState=0;s.control.sync(16,true,16000);assert.equal(s.jobs.length,1);
 s.control.sync(17,true,17000);assert.equal(s.jobs.length,1);
});
