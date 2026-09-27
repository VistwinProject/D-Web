// A gentle 3.2-second breathing cycle, driven only by exhibition time.
// Reduced-motion mode keeps the emphasis steady; pause/seek never drift.
export function focusEmphasis(shots,time,reduced=false){
 const t=Math.max(shots[0].time,Math.min(time,shots.at(-1).time));
 const i=shots.findLastIndex(s=>s.time<=t),a=shots[i],b=shots[i+1]||a;
 const u=a===b?0:(t-a.time)/(b.time-a.time),e=u*u*u*(u*(u*6-15)+10);
 const weights={};
 if(a.focus)weights[a.focus]=(weights[a.focus]||0)+1-e;
 if(b.focus)weights[b.focus]=(weights[b.focus]||0)+e;
 const pulse=reduced?.8:.65+.35*(.5-.5*Math.cos(2*Math.PI*t/3.2));
 return {weights,pulse};
}
