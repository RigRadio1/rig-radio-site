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

    const { count: memberCount } = await sb
      .from("profiles")
      .select("*", { count: "exact", head: true });

    const { count: trackCount } = await sb
      .from("tracks")
      .select("*", { count: "exact", head: true })
      .eq("status", "public");

    if (membersEl) membersEl.textContent = (memberCount || 0).toLocaleString();
    if (tracksEl) tracksEl.textContent = (trackCount || 0).toLocaleString();

    if (!latestEl) return;

    const { data: latest, error } = await sb
      .from("tracks")
      .select("id,title,artist,artist_name,created_at,cover_path")
      .eq("status", "public")
      .order("created_at", { ascending: false })
      .limit(3);

    if (error || !latest || latest.length === 0) {
      latestEl.innerHTML = `<div class="status">No recent uploads yet.</div>`;
      return;
    }

    const covers = await Promise.all(
      latest.map((track) => getCoverUrl(sb, track.cover_path))
    );

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

  window.addEventListener("load", loadCommunityData);
})();