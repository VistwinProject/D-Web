/* Silent controller checks: fake media never reaches an audio output device. */
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../theater-voice.js'),'utf8');
function setup({embedded=false,right=false,playError=null,quiet=false}={}){
 const listeners={},elements={},commands=[];let now=0,interval;
 const window={D_SHOW:{duration:120,starts:[0,20,40,60,80,100],audio:'voice.mp3',audioMaster:'voice.wav',audioFallback:'legacy.wav'},addEventListener:(n,f)=>listeners[n]=f,dispatchEvent:e=>commands.push(e)};
 window.parent=embedded?{}:window;
 const claims=[];
 const document={body:{append:e=>elements[e.id]=e},getElementById:()=>null,querySelector:()=>({querySelector:()=>null,insertBefore:e=>elements[e.id]=e}),createElement:tag=>tag==='audio'?{readyState:4,paused:true,currentTime:0,plays:0,play(){this.paused=false;this.plays++;return playError?Promise.reject({name:playError}):Promise.resolve();},pause(){this.paused=true;},addEventListener(n,f){this[n]=f;}}:{setAttribute(k,v){this[k]=v;}}};
 vm.runInNewContext(source,{window,document,location:{search:right?'?side=right':quiet?'?audio=muted':''},URLSearchParams,crypto:{randomUUID:()=> 'test'},BroadcastChannel:class{postMessage(m){claims.push(m)}addEventListener(){}},performance:{now:()=>now},setInterval:f=>interval=f,CustomEvent:class{constructor(type,o){this.type=type;this.detail=o.detail;}}});
 return {elements,commands,claims,start:()=>listeners['dweb-user-play'](),frame:s=>listeners['dweb-frame']({detail:s}),advance:t=>{now+=t;interval?.();}};
}
test('voice defaults on but waits for play, and never loops',async()=>{
 const s=setup(),a=s.elements.theaterVoice,b=s.elements.voiceToggle;
 assert.equal(a.muted,false);assert.equal(a.loop,false);assert.equal(a.plays,0);assert.equal(b['aria-pressed'],'true');
 s.frame({time:0,playing:true});assert.equal(a.plays,1);
});
test('pause, jump, resume, background progression and mute follow the clock',async()=>{
 const s=setup(),a=s.elements.theaterVoice,b=s.elements.voiceToggle;
 s.frame({time:0,playing:true});await Promise.resolve();await Promise.resolve();
 s.frame({time:35,playing:false});assert.equal(a.paused,true);assert.equal(a.currentTime,35);
 s.advance(500);s.frame({time:70,playing:true});assert.equal(a.currentTime,70);assert.equal(a.paused,false);
 s.advance(2000);assert.equal(a.currentTime,72);
 await b.onclick();assert.equal(a.muted,true);assert.equal(a.paused,true);
 s.frame({time:1,playing:true});assert.equal(a.paused,true);
});
test('both embedded panels and standalone right panel stay silent',()=>{
 assert.deepEqual(Object.keys(setup({embedded:true}).elements),[]);
 assert.deepEqual(Object.keys(setup({right:true}).elements),[]);
});
test('end, wait and hold stop instead of wrapping while frames are suspended',()=>{
 for(const mode of ['auto','hold','wait']){
 const s=setup(),a=s.elements.theaterVoice;s.frame({time:mode==='auto'?119:49,playing:true,mode});s.advance(30000);
 assert.equal(a.paused,true);assert.equal(a.currentTime,mode==='auto'?120:59.999);
 s.advance(30000);assert.equal(a.currentTime,mode==='auto'?120:59.999);
 }
});

test('an interrupted play request does not pause the show as an autoplay denial',async()=>{
 for(const name of ['AbortError','NotAllowedError']){
  const s=setup({playError:name});s.frame({time:0,playing:true});await Promise.resolve();await Promise.resolve();
  assert.equal(s.commands.length,name==='NotAllowedError'?1:0);
 }
});
test('buffering does not repeatedly seek into unavailable audio',()=>{
 const s=setup(),a=s.elements.theaterVoice;a.buffered={length:0};
 for(let t=0;t<10;t+=.2){s.frame({time:t,playing:true});s.advance(200);}
 assert.equal(a.currentTime,0);assert.equal(a.plays,1);
});
test('silent QA cannot mute the user in another tab',()=>{
 const s=setup({quiet:true});s.start();assert.equal(s.claims.length,0);
 const normal=setup();normal.start();assert.equal(normal.claims.length,1);
});

 test('failed MP3 stays failed instead of downloading a WAV master',()=>{
 const s=setup(),a=s.elements.theaterVoice;
 a.error();
 assert.equal(a.paused,true);
 assert.equal(s.elements.voiceToggle.textContent,'語音載入失敗');
 });
