(() => {
  // --- Player logic (exclusive play, live dot, seek, time) ---
  const fmt = s => { if(!isFinite(s)) return "0:00"; s = Math.max(0, s|0); const m=(s/60)|0, sec=s%60|0; return `${m}:${sec.toString().padStart(2,'0')}`; };
  const all = [];

  document.querySelectorAll('[data-player]').forEach(box => {
    const audio  = box.querySelector('audio');
    const btn    = box.querySelector('.play');
    const bar    = box.querySelector('[data-seek]');
    const fill   = box.querySelector('.fill, .fill-sm');
    const needle = box.querySelector('.needle');
    const ttxt   = box.querySelector('.time .ttext, .time-sm .ttext');
    const mon    = box.closest('.monitor');
    const setPlay = on => { box.classList.toggle('playing', on); mon && mon.classList.toggle('playing', on); };

    let loaded=false;
    const ensure = () => { if (loaded) return; const src = audio?.dataset?.srcMp3; if (src) audio.src = src; loaded = true; };

    const paint = () => {
      const cur = audio.currentTime || 0, dur = audio.duration || 0, pct = dur ? (cur/dur)*100 : 0;
      if (fill)   fill.style.width  = `${pct}%`;
      if (needle) needle.style.left = `${pct}%`;
      if (ttxt)   ttxt.textContent  = `${fmt(cur)} / ${fmt(dur)}`;
    };

    bar?.addEventListener('click', e => {
      ensure();
      if (!audio.duration) return;
      const r = bar.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (e.clientX - r.left)/r.width));
      audio.currentTime = pct * audio.duration;
    });

    btn?.addEventListener('click', () => {
      ensure();
      if (audio.paused){
        all.forEach(p => { if (p.audio !== audio){ p.audio.pause(); p.btn.textContent = '▶'; p.setPlay(false); }});
        audio.play(); btn.textContent = '❚❚'; setPlay(true);
      } else {
        audio.pause(); btn.textContent = '▶'; setPlay(false);
      }
    });

    audio.addEventListener('timeupdate', paint);
    audio.addEventListener('loadedmetadata', paint);
    audio.addEventListener('ended', () => { btn.textContent = '▶'; setPlay(false); paint(); });

    all.push({audio, btn, setPlay});
  });

  // --- Tilt ONLY the hero (no flicker; outer shell static) ---
  const hero = document.querySelector('.monitor.hero');
  if (hero){
    const screen = hero.querySelector('.screen');
    const MAX = 6;            // stronger hero tilt
    const EASE = 0.12;
    let tRX=0, tRY=0, cRX=0, cRY=0, raf=0;

    hero.addEventListener('mousemove', e => {
      const r = hero.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width/2)) / (r.width/2);
      const dy = (e.clientY - (r.top  + r.height/2)) / (r.height/2);
      tRY =  MAX * dx;
      tRX = -MAX * dy;
      kick();
    });
    hero.addEventListener('mouseleave', () => { tRX = 0; tRY = 0; kick(); });

    function tick(){
      cRX += (tRX - cRX) * EASE;
      cRY += (tRY - cRY) * EASE;
      screen.style.transform = `translateZ(80px) rotateX(${cRX.toFixed(3)}deg) rotateY(${cRY.toFixed(3)}deg)`;
      if (Math.abs(cRX - tRX) > 0.01 || Math.abs(cRY - tRY) > 0.01) raf = requestAnimationFrame(tick);
      else raf = 0;
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
  }
})();

