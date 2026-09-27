const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export function equipmentAppearance(time,events,duration=128){
 const heatLevel=time<events.heatOn?0:time<events.heatOff?smooth((time-events.heatOn)/2.2):1-smooth((time-events.heatOff)/8);
 const heatRed=time<events.heatOff?smooth((time-events.heatOn-1)/3):1-smooth((time-events.heatOff)/5);
 const hoodLevel=smooth((time-events.exhaustOn)/2.4)*(1-smooth((time-(duration-4))/4));
 return {heatLevel,heatRed,hoodLevel};
}
