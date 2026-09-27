export const filmClips={
 red:{file:'assets/film/pollution-red.mp4',poster:'assets/film/pollution-red.jpg'},
 exhaust:{file:'assets/film/negative-pressure.mp4',poster:'assets/film/negative-pressure.jpg'},
 green:{file:'assets/film/purification-green.mp4',poster:'assets/film/purification-green.jpg'}
};
export const FILM_DISSOLVE=2.4;
export function filmCues(show){
 return [
  {id:'arrival',clip:null,start:0,rate:1},
  {id:'monitor',clip:null,start:show.starts[1],rate:1},
  {id:'cooking',clip:'red',start:show.events.heatOn,rate:1},
  {id:'exhaust',clip:'exhaust',start:show.events.exhaustOn,rate:1},
  {id:'purify',clip:'green',start:show.events.freshOn,rate:18.4/(show.duration-show.events.freshOn)}
 ];
}
export function filmLayersAt(show,time){
 const cues=filmCues(show),index=Math.max(0,cues.findLastIndex(c=>time>=c.start));
 const current=cues[index],previous=cues[index-1];
 const phase=Math.max(0,Math.min(1,(time-current.start)/FILM_DISSOLVE));
 const blend=phase*phase*(3-2*phase);
 return [{cue:previous,weight:1-blend},{cue:current,weight:blend}]
  .filter(({cue,weight})=>cue?.clip&&weight>0)
  .map(({cue,weight})=>({...cue,weight,localTime:Math.max(0,time-cue.start)*cue.rate}));
}
export function filmCueAt(show,time){
 const cues=filmCues(show),index=Math.max(0,cues.findLastIndex(c=>time>=c.start));
 const cue=cues[index];return {...cue,localTime:Math.max(0,time-cue.start)*cue.rate,next:cues[index+1]||null};
}
