const hash=n=>{const v=Math.sin(n*127.1)*43758.5453;return v-Math.floor(v);};
const smooth=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};

// At purification, keep the last cloud. Its particles drift and expire without
// wrapping back to the cooking source. Derive everything from the show clock.
export function smokeParticle(k,time,{purificationStart,exhausting=false,drifting=false}){
 const clearing=time>=purificationStart,age=Math.max(0,time-purificationStart);
 const t=clearing?purificationStart:time;
 const f=(t*.22+hash(k+41))%1,a=hash(k+713)*Math.PI*2;
 const spread=(!clearing&&exhausting?.4*(1-f):.06+f*.95)*Math.sqrt(hash(k+313));
 let x=Math.cos(a)*spread,y=f*(!clearing&&exhausting?1.27:1.55),z=Math.sin(a)*spread+(!clearing&&drifting?f*.55:0);
 let alpha=1;
 if(clearing){
  x+=Math.cos(a)*age*.014+(Math.sin(a+age*.3)-Math.sin(a))*.035;
  y+=age*(.018+.012*hash(k+151))+.06*(1-Math.exp(-age/3));
  z+=Math.sin(a)*age*.012;
  alpha=1-smooth(age/(14+8*hash(k+211)));
 }
 return {x,y,z,alpha};
}
