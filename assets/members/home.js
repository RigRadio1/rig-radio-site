(function () {
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

  const waitForClient = async () => {
    for (let i = 0; i < 40; i++) {
      if (window.supabaseClient) return window.supabaseClient;
      if (window._sb) return window._sb;
      if (window.rigSupabase) return window.rigSupabase;
      await new Promise((r) => setTimeout(r, 125));
    }
    return null;
  };

  const cleanStorageKey = (value) => {
    if (!value) return "";
    const raw = String(value).trim();

    if (/^https?:\/\//i.test(raw)) {
      try {
        const url = new URL(raw);
        const marker = "/storage/v1/object/public/tracks/";
        const idx = url.pathname.indexOf(marker);
        if (idx >= 0) return decodeURIComponent(url.pathname.slice(idx + marker.length));
        return raw;
      } catch {
        return raw;
      }
    }

    return raw.replace(/^tracks\//, "").replace(/^\/+/, "");
  };

  const signTrackKey = async (client, key) => {
    const cleanKey = cleanStorageKey(key);
    if (!cleanKey) return "";
    if (/^https?:\/\//i.test(cleanKey)) return cleanKey;

    try {
      const { data, error } = await client.storage
        .from("tracks")
        .createSignedUrl(cleanKey, 3600);

      if (error || !data?.signedUrl) return "";
      return data.signedUrl;
    } catch {
      return "";
    }
  };

  const signedCover = async (client, row) => {
    if (!row) return "/banner.png";

    if (row.cover_path) {
      const url = await signTrackKey(client, row.cover_path);
      if (url) return url;
    }

    if (row.cover_url) {
      const url = await signTrackKey(client, row.cover_url);
      if (url) return url;
    }

    if (row.artwork_url) {
      const url = await signTrackKey(client, row.artwork_url);
      if (url) return url;
    }

    return "/banner.png";
  };

  const scorePlays = (row) => Number(row.plays || row.play_count || row.streams || 0);
  const scoreLikes = (row) => Number(row.likes || row.likes_count || 0);

  const renderSongList = async (client, el, rows) => {
    if (!el) return;

    if (!rows || !rows.length) {
      el.innerHTML = '<p class="rr-home-muted">No songs found yet.</p>';
      return;
    }

    const cards = await Promise.all(rows.map(async (r) => {
      const cover = await signedCover(client, r);
      const title = esc(r.title || "Untitled");
      const artist = esc(r.artist || "Unknown Artist");
      const genre = esc(r.genre || "—");
      const plays = scorePlays(r);
      const likes = scoreLikes(r);

      return `
        <a class="rr-home-song" href="/library.html?genre=${encodeURIComponent(r.genre || "")}">
          <img src="${esc(cover)}" alt="Cover art for ${title}" onerror="this.src='/banner.png'">
          <div>
            <strong>${title}</strong>
            <span>${artist}</span>
            <em>${genre} · ${plays} plays · ${likes} likes</em>
          </div>
        </a>
      `;
    }));

    el.innerHTML = cards.join("");
  };

  const renderGenres = (client, rows) => {
    const tilesEl = document.getElementById("homeGenreTiles");
    const resultsEl = document.getElementById("homeGenreTopSongs");
    if (!tilesEl || !resultsEl) return;

    const genres = [...new Set((rows || [])
      .map((r) => String(r.genre || "").trim())
      .filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));

    if (!genres.length) {
      tilesEl.innerHTML = '<p class="rr-home-muted">No genres found yet.</p>';
      return;
    }

    tilesEl.innerHTML = genres.map((genre, index) => `
      <button class="rr-genre-tile" type="button" data-genre="${esc(genre)}">
        <span>${String(index + 1).padStart(2, "0")}</span>
        <strong>${esc(genre)}</strong>
      </button>
    `).join("");

    const openGenre = async (genre) => {
      document.querySelectorAll(".rr-genre-tile").forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.genre === genre);
      });

      const top10 = (rows || [])
        .filter((r) => String(r.genre || "").trim().toLowerCase() === genre.toLowerCase())
        .sort((a, b) => {
          const byPlays = scorePlays(b) - scorePlays(a);
          if (byPlays !== 0) return byPlays;
          return scoreLikes(b) - scoreLikes(a);
        })
        .slice(0, 10);

      resultsEl.innerHTML = `
        <div class="rr-genre-results-head">
          <h3>Top 10 ${esc(genre)}</h3>
          <a href="/library.html?genre=${encodeURIComponent(genre)}">Open Genre</a>
        </div>
        <div id="homeGenreSongs" class="rr-home-song-list">
          <p class="rr-home-muted">Loading ${esc(genre)} songs...</p>
        </div>
      `;

      await renderSongList(client, document.getElementById("homeGenreSongs"), top10);
    };

    tilesEl.addEventListener("click", (event) => {
      const btn = event.target.closest(".rr-genre-tile");
      if (!btn) return;
      openGenre(btn.dataset.genre);
    });
});

    openGenre(genres[0]);
  };

  const renderPlaylists = (el, rows) => {
    if (!el) return;

    if (!rows || !rows.length) {
      el.innerHTML = `
        <div class="rr-home-update">
          <strong>Playlists Coming</strong>
          <span>Public playlists will show here once members start publishing them.</span>
        </div>
      `;
      return;
    }

    el.innerHTML = rows.map((p) => `
      <a class="rr-home-update rr-home-update-link" href="/members/">
        <strong>${esc(p.title || "Untitled Playlist")}</strong>
        <span>${esc(p.description || p.playlist_type || "Public member playlist")}</span>
      </a>
    `).join("");
  };

  const signProfileKey = async (client, key) => {
    if (!key) return "/banner.png";
    const cleanKey = String(key).replace(/^profiles\//, "").replace(/^\/+/, "");

    try {
      const { data, error } = await client.storage
        .from("profiles")
        .createSignedUrl(cleanKey, 3600);

      if (error || !data?.signedUrl) return "/banner.png";
      return data.signedUrl;
    } catch {
      return "/banner.png";
    }
  };

  const renderMembers = async (client, el, rows) => {
    if (!el) return;

    if (!rows || !rows.length) {
      el.innerHTML = '<p class="rr-home-muted">No member profiles found yet.</p>';
      return;
    }

    const cards = await Promise.all(rows.map(async (m) => {
      const name = esc(m.display_name || m.handle || "Rig-Radio Member");
      const handle = esc(String(m.handle || "member").replace(/^@/, ""));
      const avatar = await signProfileKey(client, m.avatar_path);

      return `
        <a class="rr-home-member" href="/members/?handle=${handle}">
          <img src="${esc(avatar)}" alt="${name}" onerror="this.src='/banner.png'">
          <div>
            <strong>${name}</strong>
            <span>@${handle}</span>
          </div>
        </a>
      `;
    }));

    el.innerHTML = cards.join("");
  };

  const start = async () => {
    const topEl = document.getElementById("homeTopSongs");
    const picksEl = document.getElementById("homeRigPicks");
    const playlistsEl = document.getElementById("homeTopPlaylists");
    const membersEl = document.getElementById("homeNewMembers");

    const client = await waitForClient();

    if (!client) {
      document.getElementById("homeGenreTiles").innerHTML = '<p class="rr-home-muted">Song data is not connected.</p>';
      if (topEl) topEl.innerHTML = '<p class="rr-home-muted">Song data is not connected.</p>';
      return;
    }

    const { data: allTracks } = await client
      .from("tracks")
      .select("*")
      .limit(2500);

    const tracks = allTracks || [];

    renderGenres(client, tracks);

    const top = [...tracks]
      .sort((a, b) => {
        const byPlays = scorePlays(b) - scorePlays(a);
        if (byPlays !== 0) return byPlays;
        return scoreLikes(b) - scoreLikes(a);
      })
      .slice(0, 5);

    await renderSongList(client, topEl, top);
    await renderSongList(client, picksEl, top.slice(0, 3));

    const { data: playlists } = await client
      .from("playlists")
      .select("id,title,description,playlist_type,is_public,likes_count,created_at")
      .eq("is_public", true)
      .order("likes_count", { ascending: false })
      .limit(4);

    renderPlaylists(playlistsEl, playlists || []);

    const { data: members } = await client
      .from("member_profiles")
      .select("display_name,handle,avatar_path,updated_at")
      .order("updated_at", { ascending: false })
      .limit(5);

    await renderMembers(client, membersEl, members || []);
  };

  start();
})();