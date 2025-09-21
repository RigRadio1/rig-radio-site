console.log("NEWS: js loaded");

const SUPABASE_URL = "https://tpzpeoqdpfwqumlsyhpx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwenBlb3FkcGZ3cXVtbHN5aHB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMDM5NTEsImV4cCI6MjA3MjU3OTk1MX0.nP8W_G_N9GKucj6tlzyvSAOjhiqTBD-F564i0gNhp8E";

if (!window.supabase) {
  console.error("Supabase SDK missing");
} else {
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const elLatest = document.getElementById('latest-list');
  const elTrend  = document.getElementById('trending-list');

  // Try common field names for the cover path stored in the row.
function pickCoverPath(r) {
  if (!r || !r.cover_path) return null;
  return r.cover_path;
}

async function getCoverUrl(r) {
  const path = pickCoverPath(r);
  if (!path) return null;
  try {
    const { data, error } = await sb.storage.from("covers").createSignedUrl(path, 3600);
    if (error) { console.warn("cover sign error:", error.message); return null; }
    return data?.signedUrl || null;
  } catch (e) {
    console.error("cover sign exception:", e.message);
    return null;
  }
}

  async function renderList(target, rows, label) {
    if (!target) return;
    if (!rows || rows.length === 0) {
      target.innerHTML = `<div class="status">No ${label} yet.</div>`;
      return;
    }

    // Fetch cover URLs in parallel
    const urls = await Promise.all(rows.map(getCoverUrl));

    const html = rows.map((r, i) => {
      const title  = r.title || 'Untitled';
      const artist = r.artist || r.artist_name || 'Unknown';
      const cover  = urls[i];
      const imgTag = cover
        ? `<img src="${cover}" alt="" style="width:48px;height:48px;object-fit:cover;border-radius:10px;border:1px solid rgba(255,255,255,0.08);box-shadow:0 0 0 2px rgba(255,42,42,0.10)">`
        : ``;

      return `
        <div class="card" style="display:flex;gap:12px;align-items:center;padding:10px 12px;margin:8px 0;border-radius:12px;">
          ${imgTag}
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
      // === Latest: cap at 3 ===
      console.log("NEWS: fetching Latest (limit 3) …");
      const { data: latest, error: e1 } = await sb
        .from('tracks')
        .select('id,title,artist,artist_name,created_at,cover_path')
        .eq('status','public')
        .order('created_at', { ascending: false })
        .limit(3);
      if (e1) console.error("NEWS: latest error:", e1.message);
      await renderList(elLatest, latest, "latest uploads");

      // === Trending: last 7 days window, cap at 3 (deterministic tie-breakers) ===
      const since = new Date(Date.now() - 7*24*60*60*1000).toISOString();
      console.log("NEWS: fetching Trending (7-day window, limit 3) …", since);
      const { data: trending, error: e2 } = await sb
        .from('tracks')
        .select('id,title,artist,artist_name,plays,likes,created_at,cover_path')
        .eq('status','public')
        .gte('created_at', since)
        .order('plays', { ascending: false })
        .order('likes', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .limit(3);
      if (e2) console.error("NEWS: trending error:", e2.message);
      await renderList(elTrend, trending, "trending tracks (this week)");

      console.log("NEWS: feed render complete");
    } catch (e) {
      console.error("NEWS: exception:", e.message);
    }
  })();
}
