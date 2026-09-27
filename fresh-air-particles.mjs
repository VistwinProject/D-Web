const hash=n=>{const v=Math.sin(n*127.1)*43758.5453;return v-Math.floor(v);};
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
const mix=(a,b,t)=>a+(b-a)*t;
// Exhibition illustration in the clear aisle, not a measured outlet or CFD field.
// Broad entry from screen lower-right in the fixed isometric view. The source
// is an illustrative entry region, not an asserted physical diffuser location.
export function freshAirParticle(k,time,start){
 const age=time-start-hash(k+107)*5;
 if(age<0)return {x:0,y:0,z:0,alpha:0};
 const life=10+hash(k+217)*8,f=(age%life)/life,travel=1-Math.pow(1-f,1.6);
 const sourceX=mix(-1.30,-.85,hash(k+307)),targetX=mix(.30,1.40,hash(k+401));
 const sourceZ=mix(-1.30,-.70,hash(k+509)),targetZ=mix(-1.43,-.72,hash(k+601));
 const sourceY=mix(.65,1.55,hash(k+709)),targetY=mix(1.40,2.26,hash(k+809));
 const wander=Math.sin(Math.PI*f),phase=hash(k+907)*Math.PI*2;
 return {
  x:mix(sourceX,targetX,travel)+Math.sin(phase+f*4)*wander*.09,
  y:mix(sourceY,targetY,travel)+Math.sin(phase+f*3)*wander*.035,
  z:mix(sourceZ,targetZ,travel)+Math.cos(phase+f*4)*wander*.035,
  alpha:smooth(f/.12)*smooth((1-f)/.38)*mix(.55,.90,hash(k+1009))
 };
}
