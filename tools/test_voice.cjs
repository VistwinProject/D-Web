/* Silent controller checks: fake media never reaches an audio output device. */
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../theater-voice.js'),'utf8');
function setup({embedded=false,right=false}={}){
 const listeners={},elements={},commands=[];let now=0,interval;
 const window={D_SHOW:{duration:120,starts:[0,20,40,60,80,100],audio:'voice.wav'},addEventListener:(n,f)=>listeners[n]=f,dispatchEvent:e=>commands.push(e)};
 window.parent=embedded?{}:window;
 const document={body:{append:e=>elements[e.id]=e},getElementById:()=>null,querySelector:()=>({append:e=>elements[e.id]=e}),createElement:tag=>tag==='audio'?{readyState:4,paused:true,currentTime:0,plays:0,play(){this.paused=false;this.plays++;return Promise.resolve();},pause(){this.paused=true;},addEventListener(n,f){this[n]=f;}}:{setAttribute(k,v){this[k]=v;}}};
 vm.runInNewContext(source,{window,document,location:{search:right?'?side=right':''},URLSearchParams,crypto:{randomUUID:()=> 'test'},performance:{now:()=>now},setInterval:f=>interval=f,CustomEvent:class{constructor(type,o){this.type=type;this.detail=o.detail;}}});
 return {elements,commands,frame:s=>listeners['dweb-frame']({detail:s}),advance:t=>{now+=t;interval?.();}};
}
test('opening the page is silent; enabling resets and starts one track',async()=>{
 const s=setup(),a=s.elements.theaterVoice,b=s.elements.voiceToggle;
 assert.equal(a.muted,true);assert.equal(a.plays,0);
 await b.onclick();assert.equal(a.muted,false);assert.equal(a.plays,1);
 assert.equal(s.commands[0].detail.cmd,'reset');
});
test('pause, jump, resume, background progression and mute follow the clock',async()=>{
 const s=setup(),a=s.elements.theaterVoice,b=s.elements.voiceToggle;await b.onclick();
 s.frame({time:0,playing:true});
 s.frame({time:35,playing:false});assert.equal(a.paused,true);assert.equal(a.currentTime,35);
 s.advance(500);s.frame({time:70,playing:true});assert.equal(a.currentTime,70);assert.equal(a.paused,false);
 s.advance(1000);assert.equal(a.currentTime,71);
 await b.onclick();assert.equal(a.muted,true);assert.equal(a.paused,true);
 s.frame({time:1,playing:true});assert.equal(a.paused,true);
});
test('both embedded panels and standalone right panel stay silent',()=>{
 assert.deepEqual(Object.keys(setup({embedded:true}).elements),[]);
 assert.deepEqual(Object.keys(setup({right:true}).elements),[]);
});
test('wait and hold stay inside the selected scene while frames are suspended',async()=>{
 const s=setup(),a=s.elements.theaterVoice;await s.elements.voiceToggle.onclick();s.frame({time:0,playing:true});
 s.frame({time:59,playing:true,mode:'wait'});s.advance(2000);
 assert.equal(a.paused,true);assert.equal(a.currentTime,59.999);
 s.frame({time:49,playing:true,mode:'hold'});s.advance(30000);
 assert.equal(a.currentTime,59);assert.equal(a.paused,false);
});
