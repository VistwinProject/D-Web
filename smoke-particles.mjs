const hash=n=>{const v=Math.sin(n*127.1)*43758.5453;return v-Math.floor(v);};
const smooth=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
const mix=(a,b,t)=>a+(b-a)*t;
// Capture remains active through fresh-air and purification scenes. After emission
// stops, preserve each particle, draw it into the intake and fade without respawn.
export function smokeParticle(k,time,{purificationStart,exhaustOn,hoodOffset=[0,.595,.02]}){
 const clearing=time>=purificationStart,age=Math.max(0,time-purificationStart);
 const t=clearing?purificationStart:time;
 const f=(t*.22+hash(k+41))%1,a=hash(k+713)*Math.PI*2,radial=Math.sqrt(hash(k+313));
 const capture=smooth((t-exhaustOn)/1.6),spread=(.06+f*.95)*radial;
 const radius=.18*(1-f)*radial;
 const intake={x:hoodOffset[0]*f+Math.cos(a)*radius,y:hoodOffset[1]*f,z:hoodOffset[2]*f+Math.sin(a)*radius};
 let x=mix(Math.cos(a)*spread,intake.x,capture);
 let y=mix(f*1.55,intake.y,capture);
 let z=mix(-Math.sin(a)*spread-f*.55,intake.z,capture);
 let alpha=mix(1,smooth(f/.10)*smooth((1-f)/.24),capture);
 if(clearing){
  const pull=1-Math.exp(-age*.38);
  x=mix(x,hoodOffset[0],pull);y=mix(y,hoodOffset[1],pull);z=mix(z,hoodOffset[2],pull);
  alpha*=1-smooth(age/(6+5*hash(k+211)));
 }
 return {x,y,z,alpha};
}
