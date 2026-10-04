// Only installed exhibition pages opt in. Static previews make no control requests.
(()=>{
 const q=new URLSearchParams(location.search),side=q.get('side');
 if(q.get('x')!=='1'||!['left','right'].includes(side))return;
 const instance=crypto.randomUUID(),endpoint=q.get('sync')||'/api/state';
 const reportUrl=new URL('./x/report',new URL(endpoint,location.href));
 let state=null,syncAt=-Infinity,frameAt=-Infinity,stopped=false;
 const badge=document.createElement('output');badge.style.cssText='position:fixed;bottom:4px;left:12px;z-index:100;font:12px system-ui;color:#9cbad6';
 document.body.append(badge);
 window.addEventListener('dweb-sync',event=>{state=event.detail;syncAt=performance.now();});
 window.addEventListener('dweb-frame',()=>{frameAt=performance.now();});
 async function tick(){
  try{
   const r=await fetch(reportUrl,{method:'POST',headers:{'content-type':'application/json'},signal:AbortSignal.timeout(2000),
    body:JSON.stringify({instance,side,epoch:state?.epoch,revision:state?.revision??0,ready:!!state?.connected&&performance.now()-syncAt<3000,
     visible:!document.hidden,rendering:!document.hidden&&performance.now()-frameAt<2000})});
   const result=await r.json();if(!r.ok)throw Error(result.error||'X 狀態回報失敗');
   badge.textContent='X 已連接 · '+(side==='left'?'左屏':'右屏')+(document.hidden?'背景待命':'回報中');
  }catch(e){badge.textContent=e.message||'X 狀態回報中斷';}
  if(!stopped)setTimeout(tick,700);
 }
 addEventListener('pagehide',()=>{stopped=true;});tick();
})();
