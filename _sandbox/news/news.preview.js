console.log("NEWS: js loaded");

const SUPABASE_URL = "https://tpzpeoqdpfwqumlsyhpx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwenBlb3FkcGZ3cXVtbHN5aHB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMDM5NTEsImV4cCI6MjA3MjU3OTk1MX0.nP8W_G_N9GKucj6tlzyvSAOjhiqTBD-F564i0gNhp8E";

if (!window.supabase) {
  console.error("Supabase SDK missing");
} else {
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    // manual refresh for debugging
    window._rrRefresh = () => refreshFeeds(sb);
// Kick off stats load on boot
loadSiteStats(sb).then(renderSiteStats);

// Optional: keep stats fresh every 60s
setInterval(async () => {
  const stats = await loadSiteStats(sb);
  renderSiteStats(stats);
}, 60000);


  const elLatest = document.getElementById('latest-list');
  const elTrend  = document.getElementById('trending-list');

  const elLive  = document.getElementById('live-list');
  // Try common field names for the cover path stored in the row.
function pickCoverPath(r) {
  if (!r || !r.cover_path) return null;
  return r.cover_path;
}

async function getCoverUrl(r) {
  const path = pickCoverPath(r);
  if (!path) return null;
  try {
    const { data, error } = await sb.storage.from("tracks").createSignedUrl(path, 3600);
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
    // Expose renderList globally so refreshFeeds() outside can call it
    window.renderList = renderList;

// === Site stats: members & tracks (public) ===
async function loadSiteStats(sb){
  // Members
  let members = 0;
  try {
    const { count: mcount, error: merr } = await sb
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    if (!merr && typeof mcount === 'number') members = mcount;
  } catch(e){ console.warn('STATS members ex:', e); }

  // Public tracks
  let tracks = 0;
  try {
    const { count: tcount, error: terr } = await sb
      .from('tracks')
      .select('*', { count: 'exact', head: true })
      .eq('status','public');
    if (!terr && typeof tcount === 'number') tracks = tcount;
  } catch(e){ console.warn('STATS tracks ex:', e); }

  return { members, tracks };
}

function renderSiteStats(stats){
  const BOX = document.getElementById('stats-row');
  if (!BOX) return;
  BOX.innerHTML = `
    <span class="chip pill">👥 Members: ${stats.members.toLocaleString()}</span>
    <span class="chip pill">🎵 Tracks: ${stats.tracks.toLocaleString()}</span>
  `;
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

      await renderList(elLive, latest, "live feed");
      // === Trending: last 7 days window, cap at 3 (deterministic tie-breakers) ===
    await renderList(document.getElementById('live-list'), latest, 'live feed');
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
      appendTrendingBadges(trending);
      console.log("NEWS: scheduling auto-refresh 60s");
      try { await refreshFeeds(sb); } catch(e) { console.warn("initial refresh failed", e?.message); }
      // Make renderer available to code outside this block (used by refreshFeeds)
      window.renderList = renderList;
      setInterval(() => { console.log("NEWS: auto-refresh tick"); refreshFeeds(sb); }, 60000);
      {
        const elTicker = document.getElementById("news-ticker");
        if (elTicker) {
          try {
            (async () => {
              const { data: latest } = await sb.from("tracks").select("id,title,artist,created_at").eq("status","public").order("created_at",{ascending:false}).limit(1);
              const { data: top }    = await sb.from("tracks").select("id,title,artist,plays").eq("status","public").order("plays",{ascending:false}).limit(1);
              const chips = [];
              if (latest && latest.length) chips.push(`<span class=\"chip\">🆕 ${latest[0].title || Untitled}</span>`);
              if (top && top.length)       chips.push(`<span class=\"chip\">🔥 Top Play: ${top[0].title || Unknown}</span>`);
              chips.push(`<span class=\"chip\">🏆 Contest: Halloween Battle (opens 10/15)</span>`);
              elTicker.innerHTML = chips.join(" ");
            })();
          } catch(e) { console.error("ticker error:", e?.message); }
        }
      }

      console.log("NEWS: feed render complete");
    } catch (e) {
      console.error("NEWS: exception:", e.message);
    }
  })();
}

/* post-pass: add plays/likes badges to Trending cards without touching cover rendering */
function appendTrendingBadges(rows){
  try{
    const wrap = document.getElementById('trending-list');
    if (!wrap || !rows || rows.length === 0) return;
    const cards = wrap.querySelectorAll('.card');
    rows.forEach((r, i) => {
      const card = cards[i];
      if (!card) return;
      // avoid duplicates if re-run
      if (card.querySelector('.badges')) return;

      const plays = (r?.plays ?? 0);
      const likes = (r?.likes ?? 0);

      const badges = document.createElement('div');
      badges.className = 'badges';
      badges.style.cssText = 'display:flex;gap:8px;align-items:center;margin-left:auto;';

      const s1 = document.createElement('span');
      s1.title = 'plays';
      s1.style.cssText = 'font-size:12px;padding:2px 6px;border-radius:999px;border:1px solid rgba(255,255,255,0.18);';
      s1.textContent = `▶ ${plays}`;

      const s2 = document.createElement('span');
      s2.title = 'likes';
      s2.style.cssText = 'font-size:12px;padding:2px 6px;border-radius:999px;border:1px solid rgba(255,255,255,0.18);';
      s2.textContent = `❤ ${likes}`;

      badges.appendChild(s1);
      badges.appendChild(s2);
      card.appendChild(badges);
    });
  }catch(e){ console.warn('appendTrendingBadges error:', e?.message); }
}

/* --- Live Feeds: last-updated stamp (non-intrusive) --- */
function stampLastUpdated() {
  const host = document.getElementById('live-feeds') || document;
  const id = 'live-updated-stamp';
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    el.style.cssText = 'opacity:.6;font-size:12px;margin:6px 0 0 2px;';
    const h2 = host.querySelector('h2');
    (h2?.parentNode || host).appendChild(el);
  }
  const t = new Date();
  const pad = (n)=>String(n).padStart(2,'0');
  el.textContent = `Last updated ${t.getFullYear()}-${pad(t.getMonth()+1)}-${pad(t.getDate())} ${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`;
}

/* --- Live Feeds: refresh both lists --- */
async function refreshFeeds(sb) {
  try {
    // Latest (3)
    const { data: latest } = await sb.from('tracks')
      .select('id,title,artist,artist_name,created_at,cover_path')
      .eq('status','public')
      .order('created_at', { ascending:false })
      .limit(3);
    await renderList(document.getElementById('latest-list'), latest, 'latest uploads');

    // Trending (7-day, 3)
    const since = new Date(Date.now() - 7*24*60*60*1000).toISOString();
    const { data: trending } = await sb.from('tracks')
      .select('id,title,artist,artist_name,plays,likes,created_at,cover_path')
      .eq('status','public')
      .gte('created_at', since)
      .order('plays', { ascending:false })
      .order('likes', { ascending:false })
      .order('created_at', { ascending:false })
      .order('id', { ascending:true })
      .limit(3);
    await renderList(document.getElementById('trending-list'), trending, 'trending tracks (this week)');
    appendTrendingBadges(trending);

    stampLastUpdated();
  } catch(e){
    console.warn('refreshFeeds error:', e?.message);
  }
}

/* fallback: generic list renderer (only used if missing) */
if (typeof renderList !== 'function') {
  async function renderList(target, rows, label){
    try{
      if (!target) return;
      if (!rows || rows.length === 0){
        target.innerHTML = `<div class="status">No ${label} yet.</div>`;
        return;
      }
      const signer = (typeof signCoverUrl === 'function') ? signCoverUrl : getCoverUrl;
      const urls = await Promise.all(rows.map(signer));
      const html = rows.map((r,i) => {
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
    }catch(e){ console.warn('fallback renderList error:', e?.message); }
  }
}
