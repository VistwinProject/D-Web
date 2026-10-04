import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function harness(port, search) {
 const frames=['left','right'].map(side=>({dataset:{src:`Dweb.html?side=${side}`}}));
 const requests=[], channels=[], listeners={};
 const context={URL,URLSearchParams,location:{port,search,href:`http://127.0.0.1:${port}/preview.html${search}`},
  crypto:{randomUUID:()=> 'test'},performance:{now:()=>0},Date,
  ResizeObserver:class{observe(){}},BroadcastChannel:class{constructor(name){channels.push(name)}postMessage(){}},
  document:{querySelector:()=>({}),querySelectorAll:()=>frames,addEventListener(){},getElementById:()=>({})},
  window:{D_SHOW:{duration:140.816,starts:[0,51.668]},addEventListener:(name,fn)=>listeners[name]=fn,dispatchEvent(){}},
  CustomEvent:class{},setTimeout(){},
  fetch:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({time:0,playing:false})}}};
 vm.runInNewContext(readFileSync(new URL('../preview-state.js',import.meta.url),'utf8'),context);
 return {frames,requests,channels,listeners};
}
test('isolated preview shares explicit endpoint with both outputs and keeps muted controls',async()=>{
 const h=harness('18776','?sync=/api/state&x=1&audio=muted');
 assert.equal(h.channels.length,0);
 for(const frame of h.frames){const q=new URL(frame.src).searchParams;assert.equal(q.get('sync'),'/api/state');assert.equal(q.get('x'),'1');assert.equal(q.get('audio'),'muted');}
 assert.equal(h.requests[0].url,'/api/state');
 await h.listeners['dweb-command']({detail:{cmd:'pause',source:'local-ui'}});
 const post=h.requests.find(r=>r.options.method==='POST');
 assert.equal(post.url,'/api/state');assert.equal(JSON.parse(post.options.body).controlProtocol,'d-local-v2');
});
test('server preview does not promote anonymous or audio pause events into local operator commands',async()=>{
 const h=harness('8776','?x=1&audio=muted');
 for(const detail of [{cmd:'pause'},{cmd:'pause',source:'audio-autoplay'}])await h.listeners['dweb-command']({detail});
 assert.equal(h.requests.filter(r=>r.options.method==='POST').length,0);
 await h.listeners['dweb-command']({detail:{cmd:'pause',source:'local-ui'}});
 const posts=h.requests.filter(r=>r.options.method==='POST');assert.equal(posts.length,1);
 assert.equal(JSON.parse(posts[0].options.body).source,'local-ui');
});
test('static previews still use browser clock without HTTP control',()=>{
 const h=harness('','?audio=muted');assert.equal(h.requests.length,0);assert.equal(h.channels.length,2);
 for(const frame of h.frames){assert.equal(new URL(frame.src).searchParams.get('syncChannel'),'dweb-preview-test');}
});
test('standard port still uses authoritative server by default',()=>{
 const h=harness('8776','');assert.equal(h.requests[0].url,'/api/state');assert.equal(h.channels.length,0);
});
