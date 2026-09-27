// One media owner. Buffering must not trigger repeated play/seek requests.
export function createFilmSync(video,{schedule=setTimeout,now=()=>performance.now()}={}){
 let desired=0,playing=false,pending=false,blocked=false,previousTime=null,seekTarget=null;
 let lastFrame=video.currentTime,progressAt=now(),retries=0,retryPending=false;
 const state=value=>{video.dataset.filmState=value;};
 video.preload='auto';video.muted=true;video.loop=false;
 function recover(){
  if(retryPending||retries>=2||!video.getAttribute('src'))return;
  retryPending=true;retries++;state('recovering');
  schedule(()=>{retryPending=false;pending=false;seekTarget=video.currentTime;progressAt=now();video.load();},retries*1500);
 }
 video.addEventListener('error',()=>{state('unavailable');recover();});
 video.addEventListener('loadeddata',()=>{state('ready');progressAt=now();});
 video.addEventListener('progress',()=>{progressAt=now();});
 function sync(time,isPlaying,stamp=now()){
  desired=time;playing=isPlaying;video.loop=false;
  const end=Number.isFinite(video.duration)?Math.max(0,video.duration-.05):Infinity;
  // Ordinary buffering may lag behind the show. Only an actual timeline jump seeks.
  const jumped=previousTime===null?desired>1:desired<previousTime-.2||desired-previousTime>2.5;
  previousTime=desired;
  if(jumped)seekTarget=desired;
  if(seekTarget!==null&&video.readyState>=1&&!video.seeking){
   const target=Math.min(seekTarget,end);seekTarget=null;
   if(Math.abs(target-video.currentTime)>.12){video.currentTime=target;progressAt=stamp;}
  }
  const shouldPlay=playing&&video.currentTime<end;
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
   if(shouldPlay&&stamp-progressAt>60000)recover();
   return;
  }
  state('ready');
 }
 return {sync,seek(time){seekTarget=Math.max(0,time);},unlock(){blocked=false;progressAt=now();}};
}
