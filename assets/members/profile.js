const modal = document.getElementById("editProfileModal");
const openBtn = document.getElementById("openEditProfile");
const closeBtn = document.getElementById("closeEditProfile");
const cancelBtn = document.getElementById("cancelEditProfile");
const backdrop = document.getElementById("closeEditProfileBackdrop");

let activeAudio = null;
let activeButton = null;
let activeRow = null;
let currentUser = null;
let currentProfile = null;

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

async function signBucketKey(bucket, key, seconds = 3600) {
  try {
    if (!key || !window.supabaseClient) return "";

    const { data, error } = await window.supabaseClient.storage
      .from(bucket)
      .createSignedUrl(key, seconds);

    if (error) {
      console.warn("SIGNED URL ERROR:", error);
      return "";
    }

    return data?.signedUrl || "";
  } catch (err) {
    console.warn("SIGN KEY ERROR:", err);
    return "";
  }
}

async function signTracksKey(key, seconds = 3600) {
  return signBucketKey("tracks", cleanStorageKey(key), seconds);
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

function fallbackNameFromUser(user) {
  return user?.email ? user.email.split("@")[0] : "Member";
}

function normalizeHandle(value, fallback) {
  const raw = String(value || fallback || "member")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `@${raw || "member"}`;
}


function cleanUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `https://${url}`;
}

function collectSocials() {
  return {
    spotify: cleanUrl(document.getElementById("socialSpotify")?.value),
    instagram: cleanUrl(document.getElementById("socialInstagram")?.value),
    tiktok: cleanUrl(document.getElementById("socialTikTok")?.value),
    soundcloud: cleanUrl(document.getElementById("socialSoundCloud")?.value),
    youtube: cleanUrl(document.getElementById("socialYouTube")?.value),
    x: cleanUrl(document.getElementById("socialX")?.value)
  };
}

function fillSocialInputs(socials = {}) {
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value || "";
  };

  set("socialSpotify", socials.spotify);
  set("socialInstagram", socials.instagram);
  set("socialTikTok", socials.tiktok);
  set("socialSoundCloud", socials.soundcloud);
  set("socialYouTube", socials.youtube);
  set("socialX", socials.x);
}

function renderSocialLinks(socials = {}) {
  const wrap = document.getElementById("profileSocials");
  const links = document.getElementById("socialLinks");
  if (!wrap || !links) return;

  const items = [
    ["spotify", "Spotify"],
    ["instagram", "Instagram"],
    ["tiktok", "TikTok"],
    ["soundcloud", "SoundCloud"],
    ["youtube", "YouTube"],
    ["x", "X"]
  ].filter(([key]) => socials[key]);

  if (!items.length) {
    wrap.style.display = "none";
    links.innerHTML = "";
    return;
  }

  wrap.style.display = "";
  links.innerHTML = items.map(([key, label]) => {
    const url = escapeHtml(socials[key]);
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  }).join("");
}

function applyProfileToPage(profile, user) {
  const fallbackName = fallbackNameFromUser(user);
  const displayName = profile?.display_name || user?.user_metadata?.display_name || fallbackName;
  const handle = normalizeHandle(profile?.handle || user?.user_metadata?.handle, fallbackName);
  const bio = profile?.bio || "Tell people who you are, what you create, and what your music is about.";

  const nameEl = document.querySelector(".profile-identity h1");
  const handleEl = document.querySelector(".profile-handle");
  const aboutTitle = document.querySelector(".profile-about h2");
  const aboutText = document.querySelector(".profile-about p:last-child");

  const editNameInput = document.getElementById("displayName");
  const editHandleInput = document.getElementById("handleName");
  const editBioInput = document.getElementById("bioText");

  if (nameEl) nameEl.textContent = displayName;
  if (handleEl) handleEl.textContent = handle;
  if (aboutTitle) aboutTitle.textContent = displayName;
  if (aboutText) aboutText.textContent = bio;

  if (editNameInput) editNameInput.value = displayName;
  if (editHandleInput) editHandleInput.value = handle;
    if (editBioInput) editBioInput.value = bio;

  fillSocialInputs(profile?.socials || {});
  renderSocialLinks(profile?.socials || {});
}

async function applyProfileImages(profile) {
  const banner = document.querySelector(".profile-banner");
  const avatar = document.querySelector(".profile-avatar");

  if (profile?.banner_path && banner) {
    const url = await signBucketKey("profiles", profile.banner_path);
    if (url) {
      banner.innerHTML = "";
      banner.style.backgroundImage = `url("${url}")`;
      banner.style.backgroundSize = "cover";
      banner.style.backgroundPosition = "center";
      banner.classList.remove("placeholder-banner");
    }
  }

  if (profile?.avatar_path && avatar) {
    const url = await signBucketKey("profiles", profile.avatar_path);
    if (url) {
      avatar.innerHTML = "";
      avatar.style.backgroundImage = `url("${url}")`;
      avatar.style.backgroundSize = "cover";
      avatar.style.backgroundPosition = "center";
      avatar.classList.remove("placeholder-avatar");
    }
  }
}

async function loadProfileIdentity() {
  if (!window.supabaseClient) return;

  try {
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    if (!user) return;

    currentUser = user;

    const { data, error } = await window.supabaseClient
      .from("member_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.warn("PROFILE TABLE LOAD ERROR:", error);
    }

    currentProfile = data || null;

      applyProfileToPage(currentProfile, user);
  renderSocialLinks(currentProfile?.socials || {});
  await applyProfileImages(currentProfile);
  } catch (err) {
    console.error("PROFILE IDENTITY LOAD ERROR:", err);
  }
}

async function uploadProfileFile(file, type) {
  if (!file || !currentUser) return "";

  const isBanner = type === "banner";
  const maxBytes = 5 * 1024 * 1024;

  if (!["image/jpeg", "image/png"].includes(file.type)) {
    alert("Use JPEG or PNG only.");
    return "";
  }

  if (file.size > maxBytes) {
    alert("Image must be 5MB or less.");
    return "";
  }

  const ext = file.type === "image/png" ? "png" : "jpg";
  const path = `${currentUser.id}/${type}-${Date.now()}.${ext}`;

  const { error } = await window.supabaseClient.storage
    .from("profiles")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: true
    });

  if (error) {
    console.error("PROFILE IMAGE UPLOAD ERROR:", error);
    alert("Image upload failed.");
    return "";
  }

  return path;
}

async function saveProfile() {
  if (!window.supabaseClient) return;

  const { data: { user } } = await window.supabaseClient.auth.getUser();
  if (!user) {
    alert("Please sign in.");
    return;
  }

  currentUser = user;

  const saveBtn = document.getElementById("saveEditProfile");
  if (saveBtn) saveBtn.textContent = "Saving...";

  const displayName = document.getElementById("displayName")?.value?.trim() || fallbackNameFromUser(user);
  const handle = normalizeHandle(document.getElementById("handleName")?.value, fallbackNameFromUser(user));
  const bio = document.getElementById("bioText")?.value?.trim() || "";

  const bannerFile = document.getElementById("bannerUploadInput")?.files?.[0] || null;
  const avatarFile = document.getElementById("avatarUploadInput")?.files?.[0] || null;

  let bannerPath = currentProfile?.banner_path || null;
  let avatarPath = currentProfile?.avatar_path || null;

  if (bannerFile) {
    const uploaded = await uploadProfileFile(bannerFile, "banner");
    if (uploaded) bannerPath = uploaded;
  }

  if (avatarFile) {
    const uploaded = await uploadProfileFile(avatarFile, "avatar");
    if (uploaded) avatarPath = uploaded;
  }

  const profilePayload = {
    id: user.id,
    display_name: displayName,
    handle,
    bio,
    banner_path: bannerPath,
    avatar_path: avatarPath,
    genres: [],
    socials: collectSocials(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await window.supabaseClient
    .from("member_profiles")
    .upsert(profilePayload, { onConflict: "id" })
    .select()
    .single();

  if (error) {
    console.error("PROFILE SAVE ERROR:", error);
    alert("Profile save failed. Check handle or Supabase setup.");
    if (saveBtn) saveBtn.textContent = "Save";
    return;
  }

  await window.supabaseClient.auth.updateUser({
    data: {
      display_name: displayName,
      handle
    }
  });

  currentProfile = data;
    applyProfileToPage(currentProfile, user);
  renderSocialLinks(currentProfile?.socials || {});
  await applyProfileImages(currentProfile);

  if (saveBtn) saveBtn.textContent = "Save";
  closeEditProfile();
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

  loadProfileIdentity();
  loadMemberSongs(showingAllSongs);

  document.addEventListener("click", (event) => {
    const viewAllBtn = event.target.closest("#viewAllSongs");
    if (viewAllBtn) {
      showingAllSongs = !showingAllSongs;
      loadMemberSongs(showingAllSongs);
      return;
    }

    if (event.target.closest("#saveEditProfile")) {
      saveProfile();
    }

    if (event.target.closest("#bannerUploadButton")) {
      document.getElementById("bannerUploadInput")?.click();
    }

    if (event.target.closest("#avatarUploadButton")) {
      document.getElementById("avatarUploadInput")?.click();
    }
  });
});



/* FORCE SOCIAL LINKS RENDERER */
function renderSocialLinks(socials = {}) {
  let wrap = document.getElementById("profileSocials");
  let links = document.getElementById("socialLinks");

  if (!wrap) {
    wrap = document.createElement("section");
    wrap.className = "profile-socials card";
    wrap.id = "profileSocials";
    wrap.innerHTML = `
      <p class="profile-kicker">Links</p>
      <div class="social-links" id="socialLinks"></div>
    `;

    const about = document.querySelector(".profile-about");
    if (about) {
      about.insertAdjacentElement("afterend", wrap);
    } else {
      document.querySelector(".profile-main")?.appendChild(wrap);
    }

    links = document.getElementById("socialLinks");
  }

  if (!links) return;

  const labels = {
    spotify: "Spotify",
    instagram: "Instagram",
    tiktok: "TikTok",
    soundcloud: "SoundCloud",
    youtube: "YouTube",
    x: "X"
  };

  const items = Object.entries(labels).filter(([key]) => socials && socials[key]);

  if (!items.length) {
    wrap.style.display = "none";
    links.innerHTML = "";
    return;
  }

  wrap.style.display = "";
  wrap.hidden = false;

  links.innerHTML = items.map(([key, label]) => {
    const url = escapeHtml(socials[key]);
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  }).join("");
}

/* FORCE SOCIAL INPUTS TO REFILL AFTER LOAD */
function fillSocialInputs(socials = {}) {
  const pairs = {
    socialSpotify: socials.spotify,
    socialInstagram: socials.instagram,
    socialTikTok: socials.tiktok,
    socialSoundCloud: socials.soundcloud,
    socialYouTube: socials.youtube,
    socialX: socials.x
  };

  Object.entries(pairs).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.value = value || "";
  });
}
