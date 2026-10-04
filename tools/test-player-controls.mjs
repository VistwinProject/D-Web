import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('received playback updates never send control; explicit buttons label their source',()=>{
 const listeners={},events=[],nodes=Object.fromEntries(['#playPause','#reset','#time','#progress'].map(id=>[id,{style:{}}]));
 const stages=Array.from({length:6},(_,i)=>({dataset:{stage:String(i+1)},classList:{toggle(){}}}));
 const bar={querySelector:id=>nodes[id],querySelectorAll:()=>stages};
 const window={D_SHOW:{duration:140.816,starts:[0,51.668,59.927,79.854,93.232,102.611]},addEventListener:(type,fn)=>listeners[type]=fn,dispatchEvent:e=>events.push(e)};
 window.parent=window;
 vm.runInNewContext(readFileSync(new URL('../player-controls.js',import.meta.url),'utf8'),{
  window,location:{search:'?x=1&audio=muted'},URLSearchParams,
  document:{body:{classList:{add(){},contains(){return true}},append(){}},createElement:()=>bar},
  CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail}},
 });
 listeners['dweb-frame']({detail:{time:1,playing:true}});
 assert.equal(events.length,0);
 nodes['#playPause'].onclick();
 assert.deepEqual(JSON.parse(JSON.stringify(events.at(-1).detail)),{cmd:'pause',source:'local-ui'});
 listeners['dweb-frame']({detail:{time:1,playing:false}});
 nodes['#playPause'].onclick();assert.equal(events.at(-1).detail.cmd,'play');
 nodes['#reset'].onclick();assert.equal(events.at(-1).detail.cmd,'reset');
 stages[2].onclick();assert.equal(events.at(-1).detail.stage,3);
 assert.ok(events.filter(e=>e.type==='dweb-command').every(e=>e.detail.source==='local-ui'));
});
