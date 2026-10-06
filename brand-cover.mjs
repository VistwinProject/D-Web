// Shared B-zone brand presentation. Playback remains owned by each theater.
export function presentationState({time=0,playing=false,duration=Infinity}={}){
 if(time>=duration&&Number.isFinite(duration))return 'complete';
 return time<=.01&&!playing?'standby':'playing';
}
export function createBrandCover(host,{zone,title,english,theme,dual=false}){
 const el=document.createElement('section');el.className='brand-cover'+(dual?' brand-cover--dual':'');
 el.setAttribute('aria-label',title+'展演封面');
 const left=document.createElement('div');left.className='brand-cover-title';
 const eyebrow=document.createElement('p');eyebrow.className='brand-eyebrow';eyebrow.textContent='寶舖全健築 知行 · '+zone;
 const h=document.createElement('h1');h.textContent=title;
 const en=document.createElement('p');en.className='brand-english';en.textContent=english;
 const hint=document.createElement('p');hint.className='brand-hint';hint.textContent='請稍候，由導覽人員啟動體驗';
 left.append(eyebrow,h,en,hint);
 const right=document.createElement('div');right.className='brand-cover-theme';
 const r=document.createElement('p');r.textContent=theme;
 const route=document.createElement('p');route.className='brand-route';route.textContent='房子照顧你';
 right.append(route,r);
 const logo=document.createElement('i');logo.className='brand-mark';logo.setAttribute('role','img');logo.setAttribute('aria-label','ANLB inside');
 el.append(left,right,logo);host.append(el);
 let previous;
 return state=>{
  const mode=presentationState(state);if(mode===previous)return;previous=mode;
  host.dataset.presentation=mode;el.dataset.state=mode;
  const visible=mode!=='playing';el.setAttribute('aria-hidden',String(!visible));
  // Hidden theater content must also leave the accessibility tree.
  for(const child of host.children)if(child!==el){child.inert=visible;}
  hint.textContent=mode==='complete'?'本展區體驗告一段落，請前往下一展區':'請稍候，由導覽人員啟動體驗';
  route.textContent=mode==='complete'?'體驗完成':'房子照顧你';
 };
}
