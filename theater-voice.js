/* One voice track, enabled by default, following a single non-looping clock. */
(()=>{
 const show=window.D_SHOW,q=new URLSearchParams(location.search);
 if(!show||q.get('legacy')==='1'||window.parent!==window||q.get('side')==='right')return;
 const audio=document.createElement('audio');audio.id='theaterVoice';audio.src=show.audio;audio.preload='auto';audio.loop=false;audio.muted=q.get('audio')==='muted';document.body.append(audio);
 const button=document.createElement('button');button.id='voiceToggle';button.type='button';
 const toolbar=document.querySelector('.preview-player .playback');if(toolbar)toolbar.insertBefore(button,toolbar.querySelector('#reset'));else document.body.append(button);
 let enabled=true,pending=false,state=null,stateAt=0,lastSeek=-Infinity,lastTarget=null,fallbackUsed=false;
 const owner=crypto.randomUUID(),ownership=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('dweb-voice-owner'):null;
 function label(){button.textContent='語音：'+(enabled?'開':'關');button.setAttribute('aria-pressed',String(enabled));}
 function mute(){enabled=false;audio.muted=true;audio.pause();label();}
 function blocked(error){
  // Seeking or pausing can abort play(); that is not an autoplay denial.
  if(error?.name!=='NotAllowedError')return;
  audio.pause();window.dispatchEvent(new CustomEvent('dweb-command',{detail:{cmd:'pause'}}));
 }
 function claim(){if(q.get('audio')!=='muted')ownership?.postMessage({owner});}
 function play(){if(pending)return;pending=true;audio.play().catch(blocked).finally(()=>{pending=false;if(!enabled||state&&!state.playing)audio.pause();});}
 function start(){if(!enabled)return;claim();audio.muted=q.get('audio')==='muted';play();}
 ownership?.addEventListener('message',e=>{if(e.data.owner!==owner)mute();});
 button.onclick=()=>{enabled=!enabled;audio.muted=!enabled||q.get('audio')==='muted';label();if(enabled){claim();if(state?.playing)start();sync();}else audio.pause();};
 window.addEventListener('dweb-user-play',start);
 function sync(){
  if(!enabled||!state||!audio.readyState)return;
  const now=performance.now(),raw=state.time+(state.playing?(now-stateAt)/1000:0);
  const i=show.starts.findLastIndex(t=>state.time>=t),end=['hold','wait'].includes(state.mode)?(show.starts[i+1]||show.duration):show.duration;
  const target=Math.min(raw,end<show.duration?end-.001:show.duration);
  const jumped=lastTarget===null?target>1:target<lastTarget-.2||target-lastTarget>2.5;lastTarget=target;
  // Never repeatedly seek into bytes that are still downloading.
  const available=!audio.buffered||Array.from({length:audio.buffered.length},(_,k)=>k).some(k=>target>=audio.buffered.start(k)&&target<=audio.buffered.end(k));
  if(!audio.seeking&&Math.abs(audio.currentTime-target)>.5&&(jumped||now-lastSeek>1500&&available)){audio.currentTime=target;lastSeek=now;}
  if(!state.playing||raw>=end){audio.pause();return;}
  if(audio.paused&&!pending)play();
 }
 window.addEventListener('dweb-frame',e=>{state=e.detail;stateAt=performance.now();sync();});
 audio.addEventListener('error',()=>{
  if(!fallbackUsed&&show.audioFallback){fallbackUsed=true;audio.src=show.audioFallback;audio.load();if(enabled&&state?.playing)play();return;}
  audio.pause();button.textContent='語音載入失敗';
 });
 setInterval(sync,200);window.addEventListener('pagehide',()=>audio.pause());label();
})();
