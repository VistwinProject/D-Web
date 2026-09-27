// Sentence timings are proportional estimates within the measured voice clip.
// All fades use the presentation clock, so pause, seek and replay stay deterministic.
export function splitCaption(text,limit=28){
 const pieces=text.match(/[^，。！？；、]+[，。！？；、]*/gu)||[text];
 const lines=[];let line='';
 for(const piece of pieces){
  if([...line+piece].length<=limit){line+=piece;continue;}
  if(line){lines.push(line);line='';}
  const chars=[...piece];
  while(chars.length>limit)lines.push(chars.splice(0,limit).join(''));
  line=chars.join('');
 }
 if(line)lines.push(line);
 return lines;
}
export function buildCaptions(clips,limit=28){
 return clips.flatMap(clip=>{
  const texts=splitCaption(clip.text,limit),weights=texts.map(t=>[...t].length+(t.match(/[。！？；]/gu)||[]).length*2);
  const total=weights.reduce((a,b)=>a+b,0);let cursor=clip.start;
  return texts.map((text,i)=>{const start=cursor;cursor=i===texts.length-1?clip.end:cursor+(clip.end-clip.start)*weights[i]/total;return {...clip,id:clip.id+'-'+i,text,start,end:cursor};});
 });
}
export function captionAt(cues,time){
 const cue=cues.find(c=>time>=c.start&&time<c.end);
 if(!cue)return {cue:null,opacity:0};
 const fade=Math.min(.8,(cue.end-cue.start)/4);
 const x=Math.max(0,Math.min(1,(time-cue.start)/fade,(cue.end-time)/fade));
 return {cue,opacity:x*x*(3-2*x)};
}
