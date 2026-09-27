import {createFilmSync} from './film-sync.mjs';
if(document.documentElement.dataset.player==='cinema'){
 const video=document.getElementById('v0');
 window.DFilm=createFilmSync(video);
 window.addEventListener('dweb-user-play',()=>window.DFilm.unlock());
}
