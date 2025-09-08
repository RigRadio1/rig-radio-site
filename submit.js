(async () => {
  const ok = document.getElementById('ok');
  const err = document.getElementById('err');
  const userSlot = document.getElementById('user-slot');

  const supa = window.rigSupabase; // from rr-supabase.js

  function show(el, msg) { el.textContent = msg; el.style.display = 'block'; }
  function hide(el) { el.style.display = 'none'; }
  const safe = (s) => (s || '').toLowerCase().replace(/[^a-z0-9\-_.]+/g,'-').replace(/-+/g,'-');

  // Require login
  const { data: { user }, error: userErr } = await supa.auth.getUser();
  if (userErr || !user) { window.location.href = '/login'; return; }
  userSlot.textContent = `Signed in as ${user.email}`;

  document.getElementById('submit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    hide(ok); hide(err);

    try {
      const title = document.getElementById('title').value.trim();
      const artist = document.getElementById('artist').value.trim();
      const genre = document.getElementById('genre').value.trim();
      const mp3 = document.getElementById('mp3').files[0];
      const cover = document.getElementById('cover').files[0] || null;

      if (!title || !artist || !mp3) throw new Error('Title, Artist, and MP3 are required.');

      const ts = Date.now();
      const base = `${user.id}/${ts}_${safe(title)}_${safe(artist)}`;

      // 1) Upload MP3
      const trackPath = `audio/${base}.mp3`;
      const { error: up1 } = await supa.storage
        .from('tracks')
        .upload(trackPath, mp3, { upsert: false, contentType: mp3.type || 'audio/mpeg' });
      if (up1) throw up1;

      // 2) Upload cover (optional)
      let coverPath = null;
      if (cover) {
        const ext = safe(cover.name.split('.').pop() || 'jpg');
        coverPath = `covers/${base}.${ext}`;
        const { error: up2 } = await supa.storage
          .from('tracks')
          .upload(coverPath, cover, { upsert: false, contentType: cover.type || 'image/jpeg' });
        if (up2) throw up2;
      }

      // 3) Insert DB row
      const { error: insErr } = await supa.from('songs').insert({
        user_id: user.id,
        title,
        artist,
        genre: genre || null,
        track_path: trackPath,
        cover_path: coverPath
      });
      if (insErr) throw insErr;

      // 4) Show success
      const trackUrl = supa.storage.from('tracks').getPublicUrl(trackPath).data.publicUrl;
      const coverUrl = coverPath ? supa.storage.from('tracks').getPublicUrl(coverPath).data.publicUrl : null;

      show(ok, `Uploaded ✅\n${title} — ${artist}\nTrack URL: ${trackUrl}${coverUrl ? `\nCover URL: ${coverUrl}` : ''}`);
      (e.target).reset();
    } catch (e2) {
      console.error(e2);
      show(err, `Upload failed: ${e2.message || e2}`);
    }
  });
})();
