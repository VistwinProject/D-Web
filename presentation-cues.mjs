export function equipmentAt(events,time,duration=128){
 return [
  {id:'heat',label:'IH 爐',start:events.heatOn,end:events.heatOff,onText:'加熱中',offText:'已關火'},
  {id:'exhaust',label:'手動排煙',start:events.exhaustOn,end:duration,onText:'示意運轉中',offText:'待機'},
  {id:'fresh',label:'新風清淨',start:events.freshOn,end:duration,onText:'運轉中',offText:'待機'}
 ].map(d=>{const active=time>=d.start&&time<d.end,age=time-d.start,starting=active&&age<1.6;return {...d,active,starting,status:active?(starting?'啟動中':d.onText):(time>=d.end?d.offText:'待機'),rotation:active?(age*150)%360:0,pulse:active?.7+.3*Math.sin(age*6):.25};});
}
