/* Text follows the same cues as the soundtrack, including while muted. */
(() => {
 const show=window.D_SHOW;
 if(!show) return;
 let lastKey='';
 window.addEventListener('dweb-frame',({detail:d})=>{
  const host=document.querySelector('.left-screen .narration');
  if(!host)return;
  const cue=show.clips.find(c=>d.time>=c.start&&d.time<c.end);
  const key=cue?.id||`gap-${d.scene}`;
  if(key===lastKey)return;lastKey=key;
  if(cue){host.textContent=cue.text;host.dataset.speaker=cue.role;}
  else {host.textContent=['看不見的空氣，也會隨著生活改變。','六項空氣指標，持續感知家的變化。','一頓晚餐，讓我們看見室內空氣的改變。','油煙從源頭集中帶離，減少向室內擴散。','新鮮空氣持續送入，守護生活空間。','每一口呼吸、每一位家人，都值得被好好照顧。'][d.scene]||'';delete host.dataset.speaker;}
 });
})();
