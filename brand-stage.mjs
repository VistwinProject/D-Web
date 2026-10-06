import {createBrandCover} from './brand-cover.mjs';
if(document.documentElement.dataset.player!=='legacy'){
 const update=createBrandCover(document.querySelector('.stage'),{zone:'D',title:'居家風險劇場',english:'HOME RISK THEATER',theme:'看不見的風險，\n房子先發現',dual:true});
 update({time:0,playing:false,duration:window.D_SHOW.duration});
 window.addEventListener('dweb-frame',({detail})=>update({...detail,duration:window.D_SHOW.duration}));
}
