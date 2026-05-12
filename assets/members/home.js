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
      const likes = Number(r.likes || 0);

      return `
        <a class="rr-home-song" href="/library.html">
          <img src="${esc(cover)}" alt="Cover art for ${title}" onerror="this.src='/banner.png'">
          <div>
            <strong>${title}</strong>
            <span>${artist}</span>
            <em>${genre} · ${likes} likes</em>
          </div>
        </a>
      `;
    }));

    el.innerHTML = cards.join("");
  };

  const start = async () => {
    const latestEl = document.getElementById("homeLatestSongs");
    const topEl = document.getElementById("homeTopSongs");
    const picksEl = document.getElementById("homeRigPicks");

    const client = await waitForClient();

    if (!client) {
      if (latestEl) latestEl.innerHTML = '<p class="rr-home-muted">Song data is not connected.</p>';
      if (topEl) topEl.innerHTML = '<p class="rr-home-muted">Song data is not connected.</p>';
      return;
    }

    const { data: latest } = await client
      .from("tracks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: top } = await client
      .from("tracks")
      .select("*")
      .order("likes", { ascending: false })
      .limit(5);

    await renderSongList(client, latestEl, latest || []);
    await renderSongList(client, topEl, top || []);
    await renderSongList(client, picksEl, (top || []).slice(0, 3));
  };

  start();
})();