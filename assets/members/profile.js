const modal = document.getElementById("editProfileModal");
const openBtn = document.getElementById("openEditProfile");
const closeBtn = document.getElementById("closeEditProfile");
const cancelBtn = document.getElementById("cancelEditProfile");
const backdrop = document.getElementById("closeEditProfileBackdrop");

function openEditProfile() {
  modal?.classList.add("is-open");
  modal?.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeEditProfile() {
  modal?.classList.remove("is-open");
  modal?.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

openBtn?.addEventListener("click", openEditProfile);
closeBtn?.addEventListener("click", closeEditProfile);
cancelBtn?.addEventListener("click", closeEditProfile);
backdrop?.addEventListener("click", closeEditProfile);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeEditProfile();
});

const PLACEHOLDER_IMG = "";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function extractKeyFromPublicUrl(url) {
  try {
    if (!url) return "";
    const u = new URL(url, window.location.origin);
    const match = u.pathname.match(/tracks\/(.+)$/);
    return match && match[1] ? decodeURIComponent(match[1]) : "";
  } catch {
    return "";
  }
}

async function signTracksKey(key, seconds = 3600) {
  try {
    if (!key || !window.supabaseClient) return "";
    const { data, error } = await supabaseClient.storage
      .from("tracks")
      .createSignedUrl(key, seconds);

    if (error) return "";
    return data?.signedUrl || "";
  } catch {
    return "";
  }
}

async function getSignedCover(row) {
  if (row.cover_path && typeof row.cover_path === "string") {
    return await signTracksKey(row.cover_path);
  }

  if (row.cover_url && typeof row.cover_url === "string") {
    const key = extractKeyFromPublicUrl(row.cover_url);
    if (key) return await signTracksKey(key);
    return row.cover_url;
  }

  if (row.artwork_url && typeof row.artwork_url === "string") {
    const key = extractKeyFromPublicUrl(row.artwork_url);
    if (key) return await signTracksKey(key);
    return row.artwork_url;
  }

  return PLACEHOLDER_IMG;
}

async function loadMemberSongs() {
  const list = document.querySelector(".song-list");
  const stats = document.querySelector(".profile-stats span:first-child");

  if (!list || !window.supabaseClient) return;

  list.innerHTML = `<div class="song-row"><div class="song-thumb placeholder-thumb"></div><div><h3>Loading songs...</h3><p>Please wait</p></div></div>`;

  try {
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
      list.innerHTML = `<div class="song-row"><div class="song-thumb placeholder-thumb"></div><div><h3>Sign in required</h3><p>Log in to see your uploaded tracks.</p></div></div>`;
      return;
    }

    const { data, error } = await supabaseClient
      .from("tracks")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(6);

    if (error) throw error;

    if (stats) {
      stats.textContent = `${data?.length || 0} songs`;
    }

    if (!data || data.length === 0) {
      list.innerHTML = `<div class="song-row"><div class="song-thumb placeholder-thumb"></div><div><h3>No uploads yet</h3><p>Upload songs from the dashboard.</p></div></div>`;
      return;
    }

    list.innerHTML = "";

    for (const row of data) {
      const title = row.title || row.name || (row.audio_filename ? row.audio_filename.replace(/\.[^/.]+$/, "") : "Untitled track");
      const sub = row.artist || row.artist_name || row.genre || row.style || row.description || "Uploaded track";
      const cover = await getSignedCover(row);
      const plays = row.plays ?? 0;

      const item = document.createElement("div");
      item.className = "song-row";

      item.innerHTML = `
        <div class="song-thumb placeholder-thumb"></div>
        <div>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(plays)} plays · ${escapeHtml(sub)}</p>
        </div>
      `;

      if (cover) {
        const thumb = item.querySelector(".song-thumb");
        thumb.style.backgroundImage = `url('${cover}')`;
        thumb.style.backgroundSize = "cover";
        thumb.style.backgroundPosition = "center";
        thumb.style.borderStyle = "solid";
      }

      list.appendChild(item);
    }
  } catch (err) {
    console.error("MEMBER SONG LOAD ERROR:", err);
    list.innerHTML = `<div class="song-row"><div class="song-thumb placeholder-thumb"></div><div><h3>Could not load songs</h3><p>Check console or Supabase permissions.</p></div></div>`;
  }
}

document.addEventListener("DOMContentLoaded", loadMemberSongs);
