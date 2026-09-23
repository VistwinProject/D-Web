/* One soundtrack per presentation. Visual panels never play duplicate voices. */
(() => {
  const show = window.D_SHOW, query = new URLSearchParams(location.search);
  if (!show || query.get('legacy') === '1') return;
  const embedded = window.parent !== window || query.get('side') === 'right';
  if (embedded) return;
  const silentTest = query.get('audio') === 'muted';
  const audio = document.createElement('audio');
  audio.id = 'theaterVoice'; audio.src = show.audio; audio.preload = 'auto';
  audio.loop = true; audio.muted = true;
  document.body.append(audio);
  const button = document.createElement('button');
  button.id = 'voiceToggle'; button.type = 'button';
  button.textContent = '開啟聲音・從頭播放'; button.setAttribute('aria-pressed', 'false');
  const toolbar=document.querySelector('body > header');
  if(toolbar) toolbar.append(button);
  else {button.className='voice-launcher';document.body.append(button);}
  const legacyMute=document.getElementById('btnMute');
  if(legacyMute){legacyMute.title='劇場配音';legacyMute.onclick=()=>button.click();}
  let enabled = false, pending = false, state = null, stateAt = 0, lastSeek = -Infinity, restarting = false, restartAt=0;
  const ownership = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('dweb-voice-owner') : null;
  const owner = crypto.randomUUID();
  function disable() {
    enabled = false; restarting = false; audio.muted = true; audio.pause();
    button.textContent = '開啟聲音・從頭播放'; button.setAttribute('aria-pressed', 'false');
  }
  ownership?.addEventListener('message', e => { if(e.data.owner !== owner) disable(); });
  button.onclick = async () => {
    if (enabled) return disable();
    enabled = true; restarting = true; restartAt=performance.now();audio.muted = silentTest; audio.currentTime = 0;
    button.textContent = silentTest ? '配音同步測試・保持靜音' : '靜音'; button.setAttribute('aria-pressed', 'true');
    ownership?.postMessage({owner});
    // Start in the user gesture; subsequent pause/seek always follows the master clock.
    const playback = audio.play();
    window.dispatchEvent(new CustomEvent('dweb-command', {detail:{cmd:'reset'}}));
    try { await playback; } catch { disable(); button.textContent = '語音未啟動・點此重試'; }
  };
  function sync() {
    const now = performance.now();
    if(!enabled)return;
    if(restarting){if(now-restartAt>3000){disable();button.textContent='劇場同步失敗・點此重試';}return;}
    if (!state || !audio.readyState) return;
    const raw=state.time+(state.playing?(now-stateAt)/1000:0);
    const index=show.starts.findLastIndex(t=>state.time>=t),start=show.starts[index],end=show.starts[index+1]||show.duration;
    const target=state.mode==='hold'?start+(raw-start)%(end-start):state.mode==='wait'?Math.min(end-.001,raw):raw%show.duration;
    const shouldPlay=state.playing&&!(state.mode==='wait'&&raw>=end);
    if (Math.abs(audio.currentTime-target) > .3 && now-lastSeek > 200) {
      audio.currentTime = target; lastSeek = now;
    }
    if (!shouldPlay) { audio.pause(); return; }
    if (audio.paused && !pending) {
      pending = true;
      audio.play().catch(() => { disable(); button.textContent='語音未啟動・點此重試'; })
        .finally(() => { pending=false; if(!enabled || !state?.playing) audio.pause(); });
    }
  }
  window.addEventListener('dweb-frame', e => {state=e.detail;stateAt=performance.now();if(restarting&&state.time<1)restarting=false;sync();});
  audio.addEventListener('error', () => { disable(); button.textContent='音檔載入失敗・請重新整理'; });
  // Continue tracking in background tabs, where requestAnimationFrame is suspended.
  setInterval(sync, 200);
  window.addEventListener('pagehide', disable);
})();
