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
let profileOwnerId = null;
let viewingOwnProfile = true;

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

  const icons = {
    spotify: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M12 1.5A10.5 10.5 0 1 0 22.5 12 10.51 10.51 0 0 0 12 1.5Zm4.82 15.14a.94.94 0 0 1-1.3.31 9.48 9.48 0 0 0-9.57-.57.94.94 0 1 1-.84-1.68 11.35 11.35 0 0 1 11.47.68.94.94 0 0 1 .24 1.26Zm1.31-2.92a1.17 1.17 0 0 1-1.61.39 11.76 11.76 0 0 0-11.9-.71 1.17 1.17 0 1 1-1.04-2.1 14.1 14.1 0 0 1 14.25.86 1.17 1.17 0 0 1 .3 1.56Zm.16-3.04A14.14 14.14 0 0 0 4.2 9.8a1.41 1.41 0 1 1-1.24-2.53 16.97 16.97 0 0 1 17.16.96 1.41 1.41 0 1 1-1.52 2.45Z"/>
      </svg>
    `,
    instagram: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5A4.25 4.25 0 0 0 7.75 20.5h8.5a4.25 4.25 0 0 0 4.25-4.25v-8.5A4.25 4.25 0 0 0 16.25 3.5Zm8.88 1.13a1.12 1.12 0 1 1-1.13 1.12 1.12 1.12 0 0 1 1.13-1.12ZM12 6.5A5.5 5.5 0 1 1 6.5 12 5.51 5.51 0 0 1 12 6.5Zm0 1.5A4 4 0 1 0 16 12a4 4 0 0 0-4-4Z"/>
      </svg>
    `,
    tiktok: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M14.5 2c.4 1.9 1.5 3.4 3.2 4.2.9.4 1.8.6 2.8.6v3.1c-1.6 0-3.2-.4-4.6-1.2v6.2a6.1 6.1 0 1 1-6.1-6.1c.4 0 .8 0 1.2.1v3.2a3.1 3.1 0 1 0 1.8 2.8V2Z"/>
      </svg>
    `,
    soundcloud: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M10.2 8.2a4.7 4.7 0 0 1 5.3 1.1 3.7 3.7 0 1 1 .9 7.3H4.5a2.5 2.5 0 0 1-.3-5 5.9 5.9 0 0 1 6-3.4Zm-5.7 8.3h.9V10h-.9Zm1.7 0h.9V9.3h-.9Zm1.7 0h.9V8.9h-.9Zm1.7 0h.9V8.7h-.9Zm1.7 0h.9V8.9h-.9Zm1.7 0h.9v-6h-.9Z"/>
      </svg>
    `,
    youtube: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M23 12.2s0-3.1-.4-4.6a3 3 0 0 0-2.1-2.1C19 5 12 5 12 5s-7 0-8.5.5A3 3 0 0 0 1.4 7.6C1 9.1 1 12.2 1 12.2s0 3.1.4 4.6a3 3 0 0 0 2.1 2.1C5 19.4 12 19.4 12 19.4s7 0 8.5-.5a3 3 0 0 0 2.1-2.1c.4-1.5.4-4.6.4-4.6ZM9.3 15.7V8.7l6.1 3.5Z"/>
      </svg>
    `,
    x: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.8L6.1 22H3l7.2-8.2L1 2h6.5l4.4 6.2Zm-1.1 18h1.7L6.6 3.9H4.8Z"/>
      </svg>
    `
  };

  const labels = {
    spotify: "Spotify",
    instagram: "Instagram",
    tiktok: "TikTok",
    soundcloud: "SoundCloud",
    youtube: "YouTube",
    x: "X"
  };

  const items = Object.keys(labels).filter((key) => socials && socials[key]);

  if (!items.length) {
    wrap.style.display = "none";
    links.innerHTML = "";
    return;
  }

  wrap.style.display = "";
  wrap.hidden = false;

  links.innerHTML = items.map((key) => {
    const url = escapeHtml(socials[key]);
    const label = labels[key];
    const icon = icons[key] || label;
    return `
      <a href="${url}" target="_blank" rel="noopener noreferrer" aria-label="${label}" title="${label}">
        ${icon}
      </a>
    `;
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


function setOwnerControls() {
  const ownerOnlySelectors = [
    "#openEditProfile",
    "#changeFeaturedBtn",
    "#bannerUploadButton",
    "#avatarUploadButton"
  ];

  ownerOnlySelectors.forEach((selector) => {
    const el = document.querySelector(selector);
    if (el) el.style.display = viewingOwnProfile ? "" : "none";
  });
}
async function loadProfileIdentity() {
  if (!window.supabaseClient) return;

  try {
    const params = new URLSearchParams(window.location.search);
    const requestedHandle = (params.get("handle") || "").trim().replace(/^@/, "").toLowerCase();

    const { data: { user } } = await window.supabaseClient.auth.getUser();
    currentUser = user || null;

    let query = window.supabaseClient
      .from("member_profiles")
      .select("*");

    if (requestedHandle) {
      query = query.eq("handle", requestedHandle);
    } else {
      if (!user) return;
      query = query.eq("id", user.id);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.warn("PROFILE TABLE LOAD ERROR:", error);
    }

    currentProfile = data || null;
    profileOwnerId = currentProfile?.id || (!requestedHandle ? user?.id : null) || null;
    viewingOwnProfile = !!user && !!profileOwnerId && String(user.id) === String(profileOwnerId);

    setOwnerControls();

    if (!currentProfile && requestedHandle) {
      const nameEl = document.querySelector(".profile-identity h1");
      const handleEl = document.querySelector(".profile-handle");
      const aboutText = document.querySelector(".profile-about p:last-child");

      if (nameEl) nameEl.textContent = "Member not found";
      if (handleEl) handleEl.textContent = "@" + requestedHandle;
      if (aboutText) aboutText.textContent = "This profile could not be found.";
      return;
    }

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


/* CHOOSE FEATURED TRACK */
async function getFeaturedTrackForProfile(loadedTracks = [], userId = "") {
  const featuredId = currentProfile?.featured_track_id;

  if (!featuredId) {
    return loadedTracks[0] || null;
  }

  const loadedMatch = loadedTracks.find((track) => String(track.id) === String(featuredId));
  if (loadedMatch) {
    return loadedMatch;
  }

  const { data, error } = await window.supabaseClient
    .from("tracks")
    .select("*")
    .eq("id", featuredId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("FEATURED TRACK LOAD ERROR:", error);
    return loadedTracks[0] || null;
  }

  return data || loadedTracks[0] || null;
}

function closeFeaturedPicker() {
  document.getElementById("featuredPickerModal")?.remove();
}

async function openFeaturedPicker() {
  if (!window.supabaseClient) return;

  const { data: { user } } = await window.supabaseClient.auth.getUser();

  if (!user) {
    alert("Please log in first.");
    return;
  }

  const { data, error } = await window.supabaseClient
    .from("tracks")
    .select("*")
    .eq("user_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("FEATURED PICKER LOAD ERROR:", error);
    alert("Could not load your songs.");
    return;
  }

  const tracks = data || [];

  closeFeaturedPicker();

  const modal = document.createElement("section");
  modal.id = "featuredPickerModal";
  modal.className = "featured-picker-modal";
  modal.innerHTML = `
    <div class="featured-picker-backdrop" data-close-featured-picker="1"></div>
    <div class="featured-picker-panel">
      <div class="featured-picker-header">
        <div>
          <p class="profile-kicker">Featured Track</p>
          <h2>Choose Featured Song</h2>
        </div>
        <button type="button" class="featured-picker-close" data-close-featured-picker="1">×</button>
      </div>

      <div class="featured-picker-list">
        ${
          tracks.length
            ? tracks.map((track) => {
                const title = escapeHtml(track.title || track.name || (track.audio_filename ? track.audio_filename.replace(/\.[^/.]+$/, "") : "Untitled track"));
                const sub = escapeHtml(track.artist || track.artist_name || track.genre || track.style || track.description || "Uploaded track");
                const plays = escapeHtml(track.plays ?? 0);
                const isCurrent = String(track.id) === String(currentProfile?.featured_track_id || "");

                return `
                  <button class="featured-picker-row" type="button" data-featured-track-id="${escapeHtml(track.id)}">
                    <span>
                      <strong>${title}</strong>
                      <small>${plays} plays · ${sub}</small>
                    </span>
                    <em>${isCurrent ? "Current" : "Choose"}</em>
                  </button>
                `;
              }).join("")
            : `<p class="featured-picker-empty">No uploaded songs found.</p>`
        }
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

async function saveFeaturedTrack(trackId) {
  if (!trackId || !window.supabaseClient) return;

  const { data: { user } } = await window.supabaseClient.auth.getUser();

  if (!user) {
    alert("Please log in first.");
    return;
  }

  const { data, error } = await window.supabaseClient
    .from("member_profiles")
    .upsert(
      {
        id: user.id,
        featured_track_id: trackId,
        updated_at: new Date().toISOString()
      },
      { onConflict: "id" }
    )
    .select()
    .single();

  if (error) {
    console.error("FEATURED TRACK SAVE ERROR:", error);
    alert("Could not save featured track.");
    return;
  }

  currentProfile = data;

  const { data: track, error: trackError } = await window.supabaseClient
    .from("tracks")
    .select("*")
    .eq("id", trackId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (trackError) {
    console.error("FEATURED TRACK REFRESH ERROR:", trackError);
  }

  if (track) {
    await updateFeaturedTrack(track);
  }

  closeFeaturedPicker();
}
/* END CHOOSE FEATURED TRACK */
async function loadMemberSongs(showAll = false) {
  const list = document.querySelector(".song-list");
  const stats = document.querySelector(".profile-stats span:first-child");

  if (!list || !window.supabaseClient) return;

  stopActiveAudio();
  memberTracks.clear();

  list.innerHTML = `<div class="song-row"><div class="song-thumb placeholder-thumb"></div><div><h3>Loading songs...</h3><p>Please wait</p></div></div>`;

  try {
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    const ownerId = profileOwnerId || user?.id;

    if (!ownerId) {
      list.innerHTML = `<div class="song-row"><div class="song-thumb placeholder-thumb"></div><div><h3>No profile selected</h3><p>This member profile could not be loaded.</p></div></div>`;
      return;
    }

    const { count } = await window.supabaseClient
      .from("tracks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", ownerId);

    if (stats) stats.textContent = `${count ?? 0} songs`;

    const viewAllBtn = document.getElementById("viewAllSongs");
    if (viewAllBtn) {
      viewAllBtn.style.display = (count && count > 6) ? "inline-flex" : "none";
      viewAllBtn.textContent = showAll ? "Show latest 6" : "View all";
    }

    const { data, error } = await window.supabaseClient
      .from("tracks")
      .select("*")
      .eq("user_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(showAll ? 100 : 6);

    if (error) throw error;

    if (!data || data.length === 0) {
      list.innerHTML = `<div class="song-row"><div class="song-thumb placeholder-thumb"></div><div><h3>No uploads yet</h3><p>Upload songs from the dashboard.</p></div></div>`;
      return;
    }

    const featuredTrack = await getFeaturedTrackForProfile(data, ownerId);
    await updateFeaturedTrack(featuredTrack);

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

  (async () => {
    await loadProfileIdentity();
    await loadMemberSongs(showingAllSongs);
  })();

  document.addEventListener("click", (event) => {
    const viewAllBtn = event.target.closest("#viewAllSongs");
    if (viewAllBtn) {
      showingAllSongs = !showingAllSongs;
      loadMemberSongs(showingAllSongs);
      return;
    }

    if (event.target.closest("#changeFeaturedBtn")) {
      openFeaturedPicker();
      return;
    }

    const featuredChoice = event.target.closest("[data-featured-track-id]");
    if (featuredChoice) {
      saveFeaturedTrack(featuredChoice.dataset.featuredTrackId);
      return;
    }

    if (event.target.closest("[data-close-featured-picker]")) {
      closeFeaturedPicker();
      return;
    }

    if (event.target.closest("#saveEditProfile")) {
      saveProfile();
      return;
    }

    if (event.target.closest("#bannerUploadButton")) {
      document.getElementById("bannerUploadInput")?.click();
      return;
    }

    if (event.target.closest("#avatarUploadButton")) {
      document.getElementById("avatarUploadInput")?.click();
      return;
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

/* FINAL OVERRIDE — SOCIAL LINKS AS ICONS */
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
    if (about) about.insertAdjacentElement("afterend", wrap);
    else document.querySelector(".profile-main")?.appendChild(wrap);

    links = document.getElementById("socialLinks");
  }

  if (!links) return;

  const icons = {
    youtube: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M23 12.2s0-3.1-.4-4.6a3 3 0 0 0-2.1-2.1C19 5 12 5 12 5s-7 0-8.5.5A3 3 0 0 0 1.4 7.6C1 9.1 1 12.2 1 12.2s0 3.1.4 4.6a3 3 0 0 0 2.1 2.1C5 19.4 12 19.4 12 19.4s7 0 8.5-.5a3 3 0 0 0 2.1-2.1c.4-1.5.4-4.6.4-4.6ZM9.3 15.7V8.7l6.1 3.5Z"/></svg>`,
    tiktok: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M14.5 2c.4 1.9 1.5 3.4 3.2 4.2.9.4 1.8.6 2.8.6v3.1c-1.6 0-3.2-.4-4.6-1.2v6.2a6.1 6.1 0 1 1-6.1-6.1c.4 0 .8 0 1.2.1v3.2a3.1 3.1 0 1 0 1.8 2.8V2Z"/></svg>`,
    spotify: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 1.5A10.5 10.5 0 1 0 22.5 12 10.51 10.51 0 0 0 12 1.5Zm4.82 15.14a.94.94 0 0 1-1.3.31 9.48 9.48 0 0 0-9.57-.57.94.94 0 1 1-.84-1.68 11.35 11.35 0 0 1 11.47.68.94.94 0 0 1 .24 1.26Zm1.31-2.92a1.17 1.17 0 0 1-1.61.39 11.76 11.76 0 0 0-11.9-.71 1.17 1.17 0 1 1-1.04-2.1 14.1 14.1 0 0 1 14.25.86 1.17 1.17 0 0 1 .3 1.56Z"/></svg>`,
    instagram: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5A4.25 4.25 0 0 0 7.75 20.5h8.5a4.25 4.25 0 0 0 4.25-4.25v-8.5A4.25 4.25 0 0 0 16.25 3.5Zm4.25 3A5.5 5.5 0 1 1 6.5 12 5.51 5.51 0 0 1 12 6.5Zm0 1.5A4 4 0 1 0 16 12a4 4 0 0 0-4-4Z"/></svg>`,
    soundcloud: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M10.2 8.2a4.7 4.7 0 0 1 5.3 1.1 3.7 3.7 0 1 1 .9 7.3H4.5a2.5 2.5 0 0 1-.3-5 5.9 5.9 0 0 1 6-3.4Zm-5.7 8.3h.9V10h-.9Zm1.7 0h.9V9.3h-.9Zm1.7 0h.9V8.9h-.9Zm1.7 0h.9V8.7h-.9Zm1.7 0h.9V8.9h-.9Z"/></svg>`,
    x: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.8L6.1 22H3l7.2-8.2L1 2h6.5l4.4 6.2Zm-1.1 18h1.7L6.6 3.9H4.8Z"/></svg>`
  };

  const labels = {
    spotify: "Spotify",
    instagram: "Instagram",
    tiktok: "TikTok",
    soundcloud: "SoundCloud",
    youtube: "YouTube",
    x: "X"
  };

  const items = Object.keys(labels).filter((key) => socials && socials[key]);

  if (!items.length) {
    wrap.style.display = "none";
    links.innerHTML = "";
    return;
  }

  wrap.style.display = "";
  wrap.hidden = false;

  links.innerHTML = items.map((key) => {
    const url = escapeHtml(socials[key]);
    return `
      <a href="${url}" target="_blank" rel="noopener noreferrer" aria-label="${labels[key]}" title="${labels[key]}">
        ${icons[key]}
      </a>
    `;
  }).join("");
}


/* MEMBER TOP NAV LOGOUT */
(function () {
  function bindMemberLogout() {
    const btn = document.getElementById("memberLogoutBtn");
    if (!btn || btn.dataset.bound === "1") return;

    btn.dataset.bound = "1";

    btn.addEventListener("click", async () => {
      btn.textContent = "Logging out...";

      try {
        if (window.supabaseClient?.auth) {
          await window.supabaseClient.auth.signOut();
        }
      } catch (err) {
        console.error("LOGOUT ERROR:", err);
      }

      window.location.href = "/login.html";
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindMemberLogout);
  } else {
    bindMemberLogout();
  }
})();
/* END MEMBER TOP NAV LOGOUT */








