// Camera poses are a pure function of show time: pauses and seeks cannot drift.
export function cameraPose(shots,time,reducedMotion=false){
 const t=reducedMotion?shots[0].time:Math.max(shots[0].time,Math.min(time,shots.at(-1).time));
 const i=shots.findLastIndex(s=>s.time<=t),a=shots[i],b=shots[i+1]||a;
 const u=a===b?0:(t-a.time)/(b.time-a.time),e=u*u*u*(u*(u*6-15)+10);
 const mix=(x,y)=>x+(y-x)*e;
 return {target:a.target.map((v,k)=>mix(v,b.target[k])),zoom:mix(a.zoom,b.zoom),yaw:mix(a.yaw,b.yaw),pitch:mix(a.pitch,b.pitch),shot:a.name};
}
