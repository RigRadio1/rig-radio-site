console.log("NEWS: js loaded");

// --- Supabase init (sandbox only) ---
const SUPABASE_URL = "https://tpzpeoqdpfwqumlsyhpx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwenBlb3FkcGZ3cXVtbHN5aHB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMDM5NTEsImV4cCI6MjA3MjU3OTk1MX0.nP8W_G_N9GKucj6tlzyvSAOjhiqTBD-F564i0gNhp8E";

if (!window.supabase) {
  console.error("Supabase SDK missing");
} else {
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const elLatest = document.getElementById('latest-list');
  const elTrend  = document.getElementById('trending-list');

  function renderList(target, rows, label) {
    if (!target) return;
    if (!rows || rows.length === 0) {
      target.innerHTML = `<div class="status">No ${label} yet.</div>`;
      return;
    }
    const html = rows.map(r => {
      const title  = r.title || 'Untitled';
      const artist = r.artist || r.artist_name || 'Unknown';
      return `
        <div class="card" style="display:flex;gap:12px;align-items:center;padding:10px 12px;margin:8px 0;border-radius:12px;">
          <div class="meta" style="display:flex;flex-direction:column;">
            <div class="t" style="font-weight:700;">${title}</div>
            <div class="a" style="opacity:0.8;">${artist}</div>
          </div>
        </div>`;
    }).join('');
    target.innerHTML = html;
  }

  (async () => {
    try {
      console.log("NEWS: fetching Latest…");
      const { data: latest, error: e1 } = await sb
        .from('tracks')
        .select('id,title,artist,artist_name,created_at')
        .eq('status','public')
        .order('created_at', { ascending: false })
        .limit(5);
      if (e1) console.error("NEWS: latest error:", e1.message);
      renderList(elLatest, latest, "latest uploads");

      console.log("NEWS: fetching Trending…");
      const { data: trending, error: e2 } = await sb
        .from('tracks')
        .select('id,title,artist,artist_name,plays')
        .eq('status','public')
        .order('plays', { ascending: false })
        .limit(5);
      if (e2) console.error("NEWS: trending error:", e2.message);
      renderList(elTrend, trending, "trending tracks");

      console.log("NEWS: feed render complete");
    } catch (e) {
      console.error("NEWS: exception:", e.message);
    }
  })();
}
