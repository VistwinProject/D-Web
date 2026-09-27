// Read-only visual state. No measurements or appliance-control commands.
export function ihState(cue, ageSeconds, show, mode='theater') {
 if(mode==='on'||mode==='off')return {on:mode==='on',connected:false};
 if(!cue||!Number.isFinite(cue.time)||typeof cue.playing!=='boolean'||ageSeconds<0||ageSeconds>=4)return {on:false,connected:false};
 const on=show?.events?.heatOn,off=show?.events?.heatOff;
 if(!Number.isFinite(on)||!Number.isFinite(off)||off<=on)return {on:false,connected:true};
 const time=Math.min(show.duration??Infinity,cue.time+(cue.playing?ageSeconds:0));
 return {on:time>=on&&time<off,connected:true};
}
