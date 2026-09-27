// One media owner. Buffering must not trigger repeated play/seek requests.
export function createFilmSync(video,{schedule=setTimeout,now=()=>performance.now()}={}){
 let desired=0,playing=false,pending=false,blocked=false,seekAt=-Infinity;
 let lastFrame=video.currentTime,progressAt=now(),retries=0,retryPending=false;
 const state=value=>{video.dataset.filmState=value;};
 video.preload='auto';video.muted=true;video.loop=false;
 function recover(){
  if(retryPending||retries>=2||!video.getAttribute('src'))return;
  retryPending=true;retries++;state('recovering');
  schedule(()=>{retryPending=false;pending=false;seekAt=-Infinity;progressAt=now();video.load();},retries*1500);
 }
 video.addEventListener('error',()=>{state('unavailable');recover();});
 video.addEventListener('loadeddata',()=>{state('ready');progressAt=now();});
 video.addEventListener('progress',()=>{progressAt=now();});
 function sync(time,isPlaying,stamp=now()){
  desired=time;playing=isPlaying;video.loop=false;
  const end=Number.isFinite(video.duration)?Math.max(0,video.duration-.05):Infinity;
  const target=Math.min(desired,end),shouldPlay=playing&&desired<end;
  if(video.currentTime!==lastFrame){lastFrame=video.currentTime;progressAt=stamp;}
  if(!shouldPlay)video.pause();
  // Some browsers preload only metadata until play() explicitly requests frames.
  // Keep exactly one request pending while buffering; do not wait for loadeddata.
  if(shouldPlay&&video.readyState>=1&&video.paused&&!pending&&!blocked){
   pending=true;
   Promise.resolve(video.play()).catch(error=>{
    if(error?.name==='NotAllowedError')blocked=true;
   }).finally(()=>{pending=false;if(!playing)video.pause();});
  }
  if(video.readyState<2||video.seeking){
   if(shouldPlay&&stamp-progressAt>15000)recover();
   return;
  }
  state('ready');
  if(Math.abs(target-video.currentTime)>(shouldPlay?.85:.12)&&stamp-seekAt>1800){
   video.currentTime=target;seekAt=stamp;progressAt=stamp;return;
  }
 }
 return {sync,unlock(){blocked=false;progressAt=now();}};
}
