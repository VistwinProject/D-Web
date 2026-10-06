import {createFilmSync} from './film-sync.mjs?v=edit-0916-1';
import {filmClips,filmCueAt,filmLayersAt} from './film-cues.mjs?v=dissolve-2';
if(document.documentElement.dataset.player==='cinema'){
 const custom=new URLSearchParams(location.search).get('film');
 if(custom)window.DFilm=createFilmSync(document.getElementById('v0'));
 else{
  const stage=document.getElementById('stage'),fallback=stage.querySelector('.film-fallback'),players={};
  // Each clip has its own poster; no generic film background during scenes 01/02.
  fallback.style.display='none';
  for(const [index,[key,clip]] of Object.entries(filmClips).entries()){
   const video=document.getElementById('v'+index),control=createFilmSync(video);
   video.preload=index===0?'auto':'metadata';video.poster=clip.poster;video.src=clip.file+'?v=0916-2';
   players[key]={video,control,cueId:null};
  }
  document.getElementById('novideo').classList.add('hide');
  window.DFilm={
   sync(time,playing,stamp){
    const cue=filmCueAt(window.D_SHOW,time),layers=filmLayersAt(window.D_SHOW,time);
    for(const [key,player] of Object.entries(players)){
     const layer=layers.find(l=>l.clip===key);
     if(layer){
      if(player.cueId!==layer.id){player.cueId=layer.id;player.video.preload='auto';player.control.seek(layer.localTime);}
      player.video.playbackRate=layer.rate;
      player.control.sync(layer.localTime,playing,stamp);
     }else{player.control.sync(player.video.currentTime,false,stamp);player.cueId=null;}
     player.video.classList.toggle('on',!!layer);
     player.video.style.opacity=String((key==='green'?1:.52)*(layer?.weight||0));
     player.video.dataset.filmWeight=String(layer?.weight||0);
    }
    stage.dataset.filmReady=String(layers.every(l=>players[l.clip].video.readyState>=2));
    stage.dataset.filmClip=cue.clip||'none';
    stage.dataset.filmCue=cue.id;
    if(cue.next?.clip&&cue.next.start-time<8)players[cue.next.clip].video.preload='auto';
   },
   unlock(){for(const player of Object.values(players))player.control.unlock();}
  };
 }
 window.addEventListener('dweb-user-play',()=>window.DFilm.unlock());
}
