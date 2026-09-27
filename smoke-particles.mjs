const hash=n=>{const v=Math.sin(n*127.1)*43758.5453;return v-Math.floor(v);};
const smooth=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
const mix=(a,b,t)=>a+(b-a)*t;
// Independent lifetimes keep smoke flowing while the hob is on. Turning it off
// stops births only: existing particles finish at distinct points across the hood.
export function smokeParticle(k,time,{heatOff,exhaustOn,hoodOffset=[0,.595,.02]}){
 const life=3.2+hash(k+211)*2.2,offset=hash(k+41)*life;
 const birth=Math.floor((Math.min(time,heatOff)+offset)/life)*life-offset;
 const age=time-birth,f=Math.max(0,Math.min(1,age/life));
 const a=hash(k+713)*Math.PI*2,radial=Math.sqrt(hash(k+313));
 const capture=smooth((time-exhaustOn)/1.6),spread=(.06+f*.95)*radial;
 const sourceX=mix(-.23,.23,hash(k+317)),sourceZ=mix(-.13,.13,hash(k+419));
 const targetX=hoodOffset[0]+mix(-.25,.25,hash(k+521));
 const targetZ=hoodOffset[2]+mix(-.14,.14,hash(k+631));
 const bend=Math.sin(Math.PI*f)*.025;
 const intake={x:mix(sourceX,targetX,f)+Math.cos(a)*bend,y:hoodOffset[1]*f,z:mix(sourceZ,targetZ,f)+Math.sin(a)*bend};
 return {
  x:mix(Math.cos(a)*spread,intake.x,capture),
  y:mix(f*1.55,intake.y,capture),
  z:mix(-Math.sin(a)*spread-f*.55,intake.z,capture),
  alpha:age>=life?0:smooth(f/.10)*smooth((1-f)/.24)
 };
}
