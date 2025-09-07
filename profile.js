(async () => {
  const supa = window.rigSupabase;

  const ok = document.getElementById('ok');
  const err = document.getElementById('err');
  const userSlot = document.getElementById('user-slot');
  const avatarPreview = document.getElementById('avatarPreview');

  const el = (id) => document.getElementById(id);
  const show = (e, m) => { e.textContent = m; e.style.display = 'block'; };
  const hide = (e) => { e.style.display = 'none'; };
  const safe = (s) => (s || '').toLowerCase().replace(/[^a-z0-9\-_.]+/g,'-').replace(/-+/g,'-');

  // Parse query param ?u=<uuid>
  const params = new URLSearchParams(location.search);
  const viewUserId = params.get('u'); // if present => read-only view of that user
  const readOnly = !!viewUserId;

  // Session (still needed for signed URLs, even in read-only)
  const { data: { user } } = await supa.auth.getUser().catch(() => ({ data: { user: null } }));
  userSlot.textContent = user ? `Signed in as ${user.email}` : 'Public view';

  // Helpers for signed URLs (1 hour)
  const signedUrl = async (path) => {
    if (!path) return null;
    const { data, error } = await supa.storage.from('tracks').createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  };

  // Determine whose profile to load
  let subjectId = viewUserId;
  if (!subjectId) {
    // editable self-profile requires auth
    if (!user) { window.location.href = '/login'; return; }
    subjectId = user.id;
  }

  // Toggle edit controls if read-only
  const editIds = ['display_name','bio','link_suno','link_udio','link_youtube','link_twitch','avatar','saveBtn'];
  if (readOnly) {
    editIds.forEach(id => {
      const node = el(id);
      if (!node) return;
      if (node.tagName === 'BUTTON' || node.type === 'file' || node.tagName === 'TEXTAREA' || node.tagName === 'INPUT') {
        node.disabled = true;
        if (node.tagName === 'BUTTON') node.style.display = 'none';
      }
    });
    // Change title to indicate public view
    const h1 = document.querySelector('h1');
    if (h1) h1.textContent = 'Member Profile';
  }

  // Load profile
  try {
    const { data: prof } = await supa.from('profiles')
      .select('*')
      .eq('user_id', subjectId)
      .single();

    if (prof) {
      el('display_name').value = prof.display_name || '';
      el('bio').value = prof.bio || '';
      const links = prof.links || {};
      el('link_suno').value = links.suno || '';
      el('link_udio').value = links.udio || '';
      el('link_youtube').value = links.youtube || '';
      el('link_twitch').value = links.twitch || '';
      if (prof.avatar_path) {
        const url = await signedUrl(prof.avatar_path).catch(() => null);
        if (url) avatarPreview.src = url;
      }
    } else {
      el('display_name').value = '';
      el('bio').value = '';
    }
  } catch (e) {
    console.warn('Profile load failed:', e?.message || e);
  }

  // Show this user's uploads
  try {
    const { data: songs } = await supa.from('songs')
      .select('id,title,created_at,track_path')
      .eq('user_id', subjectId)
      .order('created_at', { ascending: false });

    const ul = document.getElementById('mySongs');
    ul.innerHTML = '';
    for (const s of (songs || [])) {
      const li = document.createElement('li');
      const when = s.created_at ? new Date(s.created_at).toLocaleString() : '';
      li.textContent = `${s.title || 'Untitled'}${when ? ' — ' + when : ''}`;
      ul.appendChild(li);
    }
  } catch (e) {
    console.warn('Uploads load failed:', e?.message || e);
  }

  // Save (only when not read-only)
  const saveBtn = el('saveBtn');
  if (saveBtn && !readOnly) {
    saveBtn.addEventListener('click', async () => {
      hide(ok); hide(err);
      try {
        const display_name = el('display_name').value.trim();
        const bio = el('bio').value.trim();
        const links = {
          suno: el('link_suno').value.trim() || null,
          udio: el('link_udio').value.trim() || null,
          youtube: el('link_youtube').value.trim() || null,
          twitch: el('link_twitch').value.trim() || null
        };

        // Upload avatar if chosen
        let avatar_path = null;
        const avatarFile = el('avatar').files[0];
        if (avatarFile) {
          if (!user) throw new Error('Not signed in');
          const ts = Date.now();
          const ext = safe(avatarFile.name.split('.').pop() || 'jpg');
          const base = `${user.id}/${ts}_avatar.${ext}`;
          avatar_path = `avatars/${base}`;

          const { error: upErr } = await supa.storage
            .from('tracks')
            .upload(avatar_path, avatarFile, { upsert: false, contentType: avatarFile.type || 'image/jpeg' });
          if (upErr) throw upErr;

          const url = await signedUrl(avatar_path).catch(() => null);
          if (url) avatarPreview.src = url;
        }

        const payload = { user_id: user.id, display_name: display_name || null, bio: bio || null, links };
        if (avatar_path) payload.avatar_path = avatar_path;

        const { error: upsertErr } = await supa.from('profiles')
          .upsert(payload, { onConflict: 'user_id' });
        if (upsertErr) throw upsertErr;

        show(ok, 'Profile saved ✅');
      } catch (e) {
        console.error(e);
        show(err, `Save failed: ${e.message || e}`);
      }
    });
  }
})();
