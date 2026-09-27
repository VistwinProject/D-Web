import {kitchenLayout} from './kitchen-layout.mjs';
import {cameraPose} from './camera-timeline.mjs';
export function kitchenShots(center,events,duration=128){
 const {stove,hood}=kitchenLayout;
 const shot=(time,name,target,zoom=1)=>({time,name,target,zoom,focus:name.includes("IH")?"ih":name.includes("抽油煙機")?"hood":name.includes("新風入口")?"fresh":null,yaw:0,pitch:0});
 return [
 shot(0,'廚房全景',center),shot(events.heatOn-1.4,'廚房全景',center),
 shot(events.heatOn,'IH 爐加熱特寫',stove,1.65),shot(events.heatOn+4.312,'IH 爐加熱特寫',stove,1.65),
 shot(events.heatOn+6.112,'油煙擴散全景',center),shot(events.exhaustOn-5.449,'廚房全景',center),
 shot(events.exhaustOn-3.849,'抽油煙機特寫',hood,1.6),shot(events.exhaustOn+3.851,'抽油煙機特寫',hood,1.6),
 shot(events.exhaustOn+5.751,'排煙範圍全景',center),shot(events.freshOn+.2,'廚房全景',center),
 shot(events.freshOn+1.8,'新風擴散全景',center),shot(events.freshOn+4.7,'新風擴散全景',center),
 shot(events.freshOn+6.5,'潔淨氣流全景',center),shot(events.heatOff-2.969,'廚房全景',center),
 shot(events.heatOff-1.458,'IH 爐關火特寫',stove,1.65),shot(events.heatOff+1.0,'IH 爐關火特寫',stove,1.65),
 shot(events.heatOff+2.542,'用餐全景',center),shot(duration,'結尾全景',center)
 ];
}
export {cameraPose};
