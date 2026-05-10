const modal = document.getElementById("editProfileModal");
const openBtn = document.getElementById("openEditProfile");
const closeBtn = document.getElementById("closeEditProfile");
const cancelBtn = document.getElementById("cancelEditProfile");
const backdrop = document.getElementById("closeEditProfileBackdrop");

let activeAudio = null;
let activeButton = null;
let activeRow = null;

const memberTracks = new Map();
const audioUrlCache = new Map();

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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cleanStorageKey(value) {
  if (!value || typeof value !== "string") return "";

  try {
    const url = new URL(value, window.location.origin);
    const marker = "/tracks/";
    const index = url.pathname.indexOf(marker);

    if (index >= 0) {
      return decodeURIComponent(url.pathname.slice(index + marker.length));
    }
  } catch {}

  return value;
}

async function signTracksKey(key, seconds = 3600) {
  try {
    if (!key || !window.supabaseClient) return "";

    const cleanKey = cleanStorageKey(key);

    const { data, error } = await window.supabaseClient.storage
      .from("tracks")
      .createSignedUrl(cleanKey, seconds);

    if (error) {
      console.warn("SIGNED URL ERROR:", error);
      return "";
    }

    return data?.signedUrl || "";
  } catch (err) {
    console.warn("SIGN TRACK KEY ERROR:", err);
    return "";
  }
}

async function getSignedCover(row) {
  if (!row) return "";

  if (row.cover_path) return await signTracksKey(row.cover_path);

  if (row.cover_url) {
    const key = cleanStorageKey(row.cover_url);
    if (key && key !== row.cover_url) return await signTracksKey(key);
    return row.cover_url;
  }

  if (row.artwork_url) {
    const key = cleanStorageKey(row.artwork_url);
    if (key && key !== row.artwork_url) return await signTracksKey(key);
    return row.artwork_url;
  }

  return "";
}

async function getSignedAudio(row) {
  if (!row) return "";

  const cacheKey = String(row.id || row.track_path || row.audio_path || row.audio_url || "");
  if (cacheKey && audioUrlCache.has(cacheKey)) {
    return audioUrlCache.get(cacheKey);
  }

  let audio = "";

  if (row.track_path) audio = await signTracksKey(row.track_path);
  else if (row.audio_path) audio = await signTracksKey(row.audio_path);
  else if (row.audio_url) {
    const key = cleanStorageKey(row.audio_url);
    if (key && key !== row.audio_url) audio = await signTracksKey(key);
    else audio = row.audio_url;
  }

  if (cacheKey && audio) {
    audioUrlCache.set(cacheKey, audio);
  }

  return audio;
}

function stopActiveAudio() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio = null;
  }

  if (activeButton) {
    activeButton.textContent = activeButton.dataset.defaultText || "Play";
  }

  if (activeRow) {
    activeRow.classList.remove("is-playing");
  }

  activeButton = null;
  activeRow = null;
}

async function playTrackFromButton(button, row = null) {
  const trackId = button.dataset.trackId || "";
  const track = memberTracks.get(trackId);

  if (!track) {
    button.textContent = "No Track";
    setTimeout(() => {
      button.textContent = button.dataset.defaultText || "Play";
    }, 1200);
    return;
  }

  if (activeAudio && activeButton === button && !activeAudio.paused) {
    stopActiveAudio();
    return;
  }

  const oldText = button.dataset.defaultText || "Play";
  button.textContent = "Loading...";

  const audioUrl = await getSignedAudio(track);

  if (!audioUrl) {
    button.textContent = "No Audio";
    setTimeout(() => {
      button.textContent = oldText;
    }, 1200);
    return;
  }

  stopActiveAudio();

  activeAudio = new Audio(audioUrl);
  activeButton = button;
  activeRow = row;

  activeAudio.addEventListener("ended", stopActiveAudio);

  activeAudio.play()
    .then(() => {
      button.textContent = "Pause";
      if (row) row.classList.add("is-playing");
    })
    .catch((err) => {
      console.error("AUDIO PLAY ERROR:", err);
      button.textContent = "Play Error";
      setTimeout(() => {
        button.textContent = oldText;
      }, 1200);
    });
}

async function updateFeaturedTrack(row) {
  if (!row) return;

  memberTracks.set("featured", row);

  const card = document.querySelector(".featured-track-card");
  if (!card) return;

  const kickerEl = card.querySelector(".profile-kicker");
  const titleEl = card.querySelector(".featured-track-info h2");
  const metaEl = card.querySelector(".featured-track-info p:not(.profile-kicker)");
  const coverEl = card.querySelector(".featured-cover");
  const btn = card.querySelector(".track-actions .primary-btn");

  const title = row.title || row.name || (row.audio_filename ? row.audio_filename.replace(/\.[^/.]+$/, "") : "Untitled track");
  const sub = row.artist || row.artist_name || row.genre || row.style || row.description || "Uploaded track";
  const plays = row.plays ?? 0;
  const cover = await getSignedCover(row);

  if (kickerEl) kickerEl.textContent = "Featured Track";
  if (titleEl) titleEl.textContent = title;
  if (metaEl) metaEl.innerHTML = `${escapeHtml(plays)} plays &middot; ${escapeHtml(sub)}`;

  if (coverEl && cover) {
    coverEl.innerHTML = "";
    coverEl.style.backgroundImage = `url("${cover}")`;
    coverEl.style.backgroundSize = "cover";
    coverEl.style.backgroundPosition = "center";
    coverEl.style.borderStyle = "solid";
  }

  if (btn) {
    btn.dataset.trackId = "featured";
    btn.dataset.defaultText = "Play Track";
    btn.textContent = "Play Track";

    if (btn.dataset.bound !== "1") {
      btn.dataset.bound = "1";
      btn.addEventListener("click", () => {
        playTrackFromButton(btn);
      });
    }
  }
}

function bindSongRowPlayback(rowEl) {
  const btn = rowEl.querySelector(".song-play-btn");
  if (!btn || btn.dataset.bound === "1") return;

  btn.dataset.bound = "1";
  btn.dataset.defaultText = "Play";

  btn.addEventListener("click", (event) => {
    event.stopPropagation();
    playTrackFromButton(btn, rowEl);
  });

  rowEl.addEventListener("click", () => {
    playTrackFromButton(btn, rowEl);
  });
}

async function loadMemberSongs(showAll = false) {
  const list = document.querySelector(".song-list");
  const stats = document.querySelector(".profile-stats span:first-child");

  if (!list || !window.supabaseClient) return;

  stopActiveAudio();
  memberTracks.clear();

  list.innerHTML = `<div class="song-row"><div class="song-thumb placeholder-thumb"></div><div><h3>Loading songs...</h3><p>Please wait</p></div></div>`;

  try {
    const { data: { user } } = await window.supabaseClient.auth.getUser();

    if (!user) {
      list.innerHTML = `<div class="song-row"><div class="song-thumb placeholder-thumb"></div><div><h3>Sign in required</h3><p>Log in to see your uploaded tracks.</p></div></div>`;
      return;
    }

    const { count } = await window.supabaseClient
      .from("tracks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (stats) stats.textContent = `${count ?? 0} songs`;

    const viewAllBtn = document.getElementById("viewAllSongs");
    if (viewAllBtn) {
      viewAllBtn.style.display = (count && count > 6) ? "inline-flex" : "none";
      viewAllBtn.textContent = showAll ? "Show latest 6" : "View all";
    }

    const { data, error } = await window.supabaseClient
      .from("tracks")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(showAll ? 100 : 6);

    if (error) throw error;

    if (!data || data.length === 0) {
      list.innerHTML = `<div class="song-row"><div class="song-thumb placeholder-thumb"></div><div><h3>No uploads yet</h3><p>Upload songs from the dashboard.</p></div></div>`;
      return;
    }

    await updateFeaturedTrack(data[0]);

    list.innerHTML = "";

    for (const row of data) {
      const trackId = String(row.id);
      memberTracks.set(trackId, row);

      const title = row.title || row.name || (row.audio_filename ? row.audio_filename.replace(/\.[^/.]+$/, "") : "Untitled track");
      const sub = row.artist || row.artist_name || row.genre || row.style || row.description || "Uploaded track";
      const cover = await getSignedCover(row);
      const plays = row.plays ?? 0;

      const item = document.createElement("div");
      item.className = "song-row playable-song-row";

      item.innerHTML = `
        <div class="song-thumb placeholder-thumb"></div>
        <div>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(plays)} plays &middot; ${escapeHtml(sub)}</p>
        </div>
        <button class="song-play-btn" type="button">Play</button>
      `;

      if (cover) {
        const thumb = item.querySelector(".song-thumb");
        thumb.style.backgroundImage = `url("${cover}")`;
        thumb.style.backgroundSize = "cover";
        thumb.style.backgroundPosition = "center";
        thumb.style.borderStyle = "solid";
      }

      const btn = item.querySelector(".song-play-btn");
      if (btn) btn.dataset.trackId = trackId;

      bindSongRowPlayback(item);
      list.appendChild(item);
    }
  } catch (err) {
    console.error("MEMBER SONG LOAD ERROR:", err);
    list.innerHTML = `<div class="song-row"><div class="song-thumb placeholder-thumb"></div><div><h3>Could not load songs</h3><p>Check console or Supabase permissions.</p></div></div>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  let showingAllSongs = false;

  loadMemberSongs(showingAllSongs);

  document.addEventListener("click", (event) => {
    const btn = event.target.closest("#viewAllSongs");
    if (!btn) return;

    showingAllSongs = !showingAllSongs;
    loadMemberSongs(showingAllSongs);
  });
});
