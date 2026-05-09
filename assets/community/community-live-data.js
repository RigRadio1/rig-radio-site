(function () {
  const SUPABASE_URL = "https://tpzpeoqdpfwqumlsyhpx.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwenBlb3FkcGZ3cXVtbHN5aHB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMDM5NTEsImV4cCI6MjA3MjU3OTk1MX0.nP8W_G_N9GKucj6tlzyvSAOjhiqTBD-F564i0gNhp8E";

  async function ensureSupabase() {
    if (window.supabase && window.supabase.createClient) return;

    await new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";
      script.onload = resolve;
      document.head.appendChild(script);
    });
  }

  async function getCoverUrl(sb, path) {
    if (!path) return "";

    const { data, error } = await sb.storage
      .from("tracks")
      .createSignedUrl(path, 3600);

    if (error) return "";
    return data && data.signedUrl ? data.signedUrl : "";
  }

  async function loadCommunityData() {
    await ensureSupabase();

    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const membersEl = document.getElementById("community-members-total");
    const tracksEl = document.getElementById("community-tracks-total");
    const latestEl = document.getElementById("community-latest-tracks");
    const activityEl = document.getElementById("community-live-activity");

    const { count: memberCount } = await sb
      .from("profiles")
      .select("*", { count: "exact", head: true });

    const { count: trackCount } = await sb
      .from("tracks")
      .select("*", { count: "exact", head: true })
      .eq("status", "public");

    const safeMemberCount = memberCount || 0;
    const safeTrackCount = trackCount || 0;

    if (membersEl) membersEl.textContent = safeMemberCount.toLocaleString();
    if (tracksEl) tracksEl.textContent = safeTrackCount.toLocaleString();

    const { data: latest, error } = await sb
      .from("tracks")
      .select("id,title,artist,artist_name,created_at,cover_path")
      .eq("status", "public")
      .order("created_at", { ascending: false })
      .limit(3);

    if (error || !latest || latest.length === 0) {
      if (latestEl) {
        latestEl.innerHTML = `<div class="status">No recent uploads yet.</div>`;
      }

      if (activityEl) {
        activityEl.innerHTML = `
          <div class="activity-item">
            <span class="activity-dot"></span>
            <div>
              <strong>Rig-Radio is ON AIR</strong>
              <p>Live broadcast room is active now</p>
            </div>
          </div>
        `;
      }

      return;
    }

    const covers = await Promise.all(
      latest.map((track) => getCoverUrl(sb, track.cover_path))
    );

    if (latestEl) {
      latestEl.innerHTML = latest
        .map((track, index) => {
          const title = track.title || "Untitled";
          const artist = track.artist || track.artist_name || "Unknown Artist";
          const cover = covers[index];

          return `
            <div class="community-track-card">
              ${
                cover
                  ? `<img src="${cover}" alt="">`
                  : `<div class="community-track-placeholder">RR</div>`
              }
              <div>
                <strong>${title}</strong>
                <span>${artist}</span>
              </div>
            </div>
          `;
        })
        .join("");
    }

    if (activityEl) {
      const newest = latest[0];
      const newestTitle = newest.title || "New track";
      const newestArtist = newest.artist || newest.artist_name || "Unknown Artist";

      activityEl.innerHTML = `
        <div class="activity-item">
          <span class="activity-dot"></span>
          <div>
            <strong>Rig-Radio is ON AIR</strong>
            <p>Live broadcast room is active now</p>
          </div>
        </div>

        <div class="activity-item">
          <span class="activity-dot"></span>
          <div>
            <strong>Latest upload added</strong>
            <p>${newestTitle} by ${newestArtist}</p>
          </div>
        </div>

              <div class="activity-item">
          <span class="activity-dot"></span>
          <div>
            <strong>Live room is open</strong>
            <p>Members can chat, react, and use emotes now</p>
          </div>
        </div>

        <div class="activity-item">
          <span class="activity-dot"></span>
          <div>
            <strong>Creator feed updated</strong>
            <p>Recent public uploads are now showing on the community page</p>
          </div>
        </div>
      `;
    }
  }

  window.addEventListener("load", loadCommunityData);
})();