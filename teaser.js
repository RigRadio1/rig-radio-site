// teaser.js — tiny niceties only, no globals touched
(() => {
  const player = document.getElementById('teaserPlayer');
  if (!player) return;

  // keep the UI tidy if the sample fails to load
  let retried = false;
  player.addEventListener('error', () => {
    if (retried) return;
    retried = true;
    // if you later move the teaser file into Supabase signed URLs,
    // you could refresh the source here. for now, just noop.
  });

  // (optional) start paused + remember position if user navigates
  try {
    const key = 'rr_teaser_pos';
    const pos = parseFloat(sessionStorage.getItem(key) || '0');
    if (!Number.isNaN(pos) && pos > 0) {
      player.addEventListener('loadedmetadata', () => {
        try { player.currentTime = pos; } catch(_) {}
      }, { once:true });
    }
    setInterval(() => {
      if (!player.paused) sessionStorage.setItem(key, String(player.currentTime || 0));
    }, 1000);
  } catch {}
})();

