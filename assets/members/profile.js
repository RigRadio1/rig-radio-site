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

function formatTrackTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function setPlayButtonText(button, text) {
  if (!button) return;
  const label = button.querySelector(".playlist-play-label");
  if (label) {
    label.textContent = text;
    return;
  }
  button.textContent = text;
}

function updatePlayButtonProgress(button, audio) {
  if (!button || !audio) return;

  const time = button.querySelector(".playlist-play-time");
  const fill = button.querySelector(".playlist-play-fill");

  const current = audio.currentTime || 0;
  const duration = audio.duration || 0;

  if (time) {
    time.textContent = `${formatTrackTime(current)} / ${formatTrackTime(duration)}`;
  }

  if (fill) {
    const percent = duration ? Math.min(100, Math.max(0, (current / duration) * 100)) : 0;
    fill.style.width = `${percent}%`;
  }
}

function resetPlayButtonProgress(button) {
  if (!button) return;

  setPlayButtonText(button, button.dataset.defaultText || "Play");

  const time = button.querySelector(".playlist-play-time");
  if (time) time.textContent = "0:00 / 0:00";

  const fill = button.querySelector(".playlist-play-fill");
  if (fill) fill.style.width = "0%";
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
  setPlayButtonText(button, "Loading...");

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

  activeAudio.addEventListener("loadedmetadata", () => updatePlayButtonProgress(button, activeAudio));
  activeAudio.addEventListener("timeupdate", () => updatePlayButtonProgress(button, activeAudio));
  activeAudio.addEventListener("ended", stopActiveAudio);

  activeAudio.play()
    .then(() => {
      setPlayButtonText(button, "Pause");
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
  const publicProfileLink = document.getElementById("copyPublicProfile");

  if (nameEl) nameEl.textContent = displayName;
  if (handleEl) handleEl.textContent = handle;
  if (aboutTitle) aboutTitle.textContent = displayName;
  if (aboutText) aboutText.textContent = bio;

  if (editNameInput) editNameInput.value = displayName;
  if (editHandleInput) editHandleInput.value = handle;
  if (editBioInput) editBioInput.value = bio;

  if (publicProfileLink) {
    publicProfileLink.dataset.profileUrl = `${window.location.origin}/members/?handle=${encodeURIComponent(handle.replace(/^@/, ""))}`;
  }

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
    "#copyPublicProfile",
    "#createPlaylistBtn",
    "#changeFeaturedBtn",
    "#bannerUploadButton",
    "#avatarUploadButton"
  ];

  ownerOnlySelectors.forEach((selector) => {
    const el = document.querySelector(selector);
    if (el) el.style.display = viewingOwnProfile ? "" : "none";
  });

  const followBtn = document.getElementById("followMemberBtn");
  if (followBtn) {
    followBtn.style.display = (!viewingOwnProfile && profileOwnerId) ? "" : "none";
  }
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
      query = query.or(`handle.ilike.${requestedHandle},handle.ilike.@${requestedHandle}`);
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



async function loadMemberNotifications() {
  const box = document.getElementById("memberNotifications");
  const countEl = document.getElementById("notificationCount");
  const openBtn = document.getElementById("openNotificationsPanel");
  const modal = document.getElementById("notificationsModal");
  const closeBtn = document.getElementById("closeNotificationsModal");
  const list = document.getElementById("memberNotificationsList");
  const markReadBtn = document.getElementById("markNotificationsRead");

  if (!box || !countEl || !openBtn || !modal || !list) return;

  let notifyClient = window.supabaseClient || window._sb;

  for (let i = 0; i < 50 && !notifyClient; i++) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    notifyClient = window.supabaseClient || window._sb;
  }

  if (!notifyClient) return;

  let sessionUser = currentUser || null;

  try {
    const { data } = await notifyClient.auth.getSession();
    sessionUser = data?.session?.user || sessionUser;
  } catch (err) {
    console.warn("NOTIFICATION SESSION ERROR:", err);
  }

  const params = new URLSearchParams(window.location.search);
  const requestedHandle = (params.get("handle") || "").trim();

  if (!sessionUser || requestedHandle) {
    box.hidden = true;
    modal.hidden = true;
    return;
  }

  const { data: notifications, error } = await notifyClient
    .from("member_notifications")
    .select("id, actor_id, track_id, type, message, is_read, created_at")
    .eq("recipient_id", sessionUser.id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    console.warn("NOTIFICATIONS LOAD ERROR:", error);
    box.hidden = true;
    return;
  }

  const notes = notifications || [];
  const unreadCount = notes.filter((n) => !n.is_read).length;

  box.hidden = false;
  countEl.textContent = unreadCount === 1 ? "1 new" : `${unreadCount} new`;
  openBtn.classList.toggle("has-new", unreadCount > 0);

  if (!notes.length) {
    list.innerHTML = "<p>No notifications yet.</p>";
  } else {
    const actorIds = [...new Set(notes.map((n) => n.actor_id).filter(Boolean))];
    let profilesById = new Map();

    if (actorIds.length) {
      const { data: profiles } = await notifyClient
        .from("member_profiles")
        .select("id, display_name, handle, avatar_path")
        .in("id", actorIds);

      profilesById = new Map((profiles || []).map((p) => [p.id, p]));

      const avatarPairs = await Promise.all((profiles || []).map(async (p) => {
        if (!p.avatar_path) return [p.id, ""];
        try {
          const { data } = await notifyClient.storage
            .from("profiles")
            .createSignedUrl(p.avatar_path, 3600);

          return [p.id, data?.signedUrl || ""];
        } catch (_) {
          return [p.id, ""];
        }
      }));

      window.memberNotificationAvatars = new Map(avatarPairs);
    }

    list.innerHTML = notes.map((note) => {
      const actor = profilesById.get(note.actor_id);
      const actorName = actor?.display_name || actor?.handle || "A Rig-Radio member";
      const date = new Date(note.created_at).toLocaleString();
      const statusClass = note.is_read ? "is-read" : "is-unread";
      const label =
        note.type === "song_comment" ? "commented on" :
        note.type === "comment_reply" ? "replied to" :
        "liked";
      const avatarUrl = window.memberNotificationAvatars?.get(note.actor_id) || "/banner.png";

      return `
        <a class="member-notification ${statusClass}" href="/song.html?id=${encodeURIComponent(note.track_id || "")}">
          <img class="member-notification-avatar" src="${avatarUrl}" alt="" />
          <div>
            <strong>${actorName}</strong> ${label} ${note.type === "comment_reply" ? "your comment." : "your song."}
            <span>${date}</span>
          </div>
        </a>
      `;
    }).join("");
  }

  openBtn.onclick = () => {
    modal.hidden = false;
  };

  if (closeBtn) {
    closeBtn.onclick = () => {
      modal.hidden = true;
    };
  }

  modal.onclick = (event) => {
    if (event.target === modal) modal.hidden = true;
  };

  if (markReadBtn) {
    markReadBtn.onclick = async () => {
      markReadBtn.disabled = true;

      const { error: updateError } = await notifyClient
        .from("member_notifications")
        .update({ is_read: true })
        .eq("recipient_id", sessionUser.id)
        .eq("is_read", false);

      if (updateError) {
        console.warn("NOTIFICATIONS READ ERROR:", updateError);
      }

      modal.hidden = true;
      await loadMemberNotifications();
      markReadBtn.disabled = false;
    };
  }
}

async function updateFollowStats() {
  if (!window.supabaseClient || !profileOwnerId) return;

  const followersEl = document.querySelector(".profile-stats span:nth-child(2)");
  const followingEl = document.querySelector(".profile-stats span:nth-child(3)");

  const { count: followersCount } = await window.supabaseClient
    .from("member_follows")
    .select("*", { count: "exact", head: true })
    .eq("following_id", profileOwnerId);

  const { count: followingCount } = await window.supabaseClient
    .from("member_follows")
    .select("*", { count: "exact", head: true })
    .eq("follower_id", profileOwnerId);

  if (followersEl) followersEl.textContent = `${followersCount ?? 0} followers`;
  if (followingEl) followingEl.textContent = `${followingCount ?? 0} following`;
}

async function updateFollowButton() {
  const followBtn = document.getElementById("followMemberBtn");
  if (!followBtn || !window.supabaseClient || !profileOwnerId || viewingOwnProfile) return;

  if (!currentUser) {
    followBtn.textContent = "Log in to Follow";
    return;
  }

  const { data, error } = await window.supabaseClient
    .from("member_follows")
    .select("follower_id")
    .eq("follower_id", currentUser.id)
    .eq("following_id", profileOwnerId)
    .maybeSingle();

  if (error) {
    console.warn("FOLLOW STATE ERROR:", error);
  }

  followBtn.textContent = data ? "Following" : "Follow";
  followBtn.dataset.following = data ? "1" : "0";
}

async function toggleFollowMember() {
  const followBtn = document.getElementById("followMemberBtn");
  if (!followBtn || !window.supabaseClient || !profileOwnerId || viewingOwnProfile) return;

  if (!currentUser) {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    window.location.href = `/login.html?redirect=${encodeURIComponent(returnTo)}`;
    return;
  }

  followBtn.disabled = true;

  try {
    const isFollowing = followBtn.dataset.following === "1";

    if (isFollowing) {
      const { error } = await window.supabaseClient
        .from("member_follows")
        .delete()
        .eq("follower_id", currentUser.id)
        .eq("following_id", profileOwnerId);

      if (error) throw error;
    } else {
      const { error } = await window.supabaseClient
        .from("member_follows")
        .insert({
          follower_id: currentUser.id,
          following_id: profileOwnerId
        });

      if (error) throw error;
    }

    await updateFollowStats();
    await updateFollowButton();
  } catch (err) {
    console.error("FOLLOW TOGGLE ERROR:", err);
    alert("Could not update follow.");
  } finally {
    followBtn.disabled = false;
  }
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
        <button type="button" class="featured-picker-close" data-close-featured-picker="1">�</button>
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
                      <small>${plays} plays � ${sub}</small>
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


function closeCreatePlaylistModal() {
  document.getElementById("createPlaylistModal")?.remove();
}

function openCreatePlaylistModal() {
  if (!currentUser || !viewingOwnProfile) return;

  closeCreatePlaylistModal();

  const modal = document.createElement("section");
  modal.id = "createPlaylistModal";
  modal.className = "create-playlist-modal";
  modal.innerHTML = `
    <div class="create-playlist-backdrop" data-close-create-playlist="1"></div>
    <div class="create-playlist-panel">
      <div class="create-playlist-header">
        <div>
          <p class="profile-kicker">New Playlist</p>
          <h2>Create Private Playlist</h2>
        </div>
        <button type="button" class="create-playlist-close" data-close-create-playlist="1">X</button>
      </div>

      <label class="edit-label" for="newPlaylistTitle">Playlist Name</label>
      <input id="newPlaylistTitle" class="edit-input" type="text" placeholder="Example: Saturday Night Drops" maxlength="80" />

      <div class="create-playlist-actions">
        <button type="button" class="secondary-btn" data-close-create-playlist="1">Cancel</button>
        <button type="button" class="primary-btn" id="saveCreatePlaylist">Create Playlist</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  setTimeout(() => {
    document.getElementById("newPlaylistTitle")?.focus();
  }, 50);
}

async function createPrivatePlaylist() {
  if (!window.supabaseClient || !currentUser || !viewingOwnProfile) return;

  const input = document.getElementById("newPlaylistTitle");
  const title = input?.value?.trim();

  if (!title) {
    input?.focus();
    return;
  }

  const saveBtn = document.getElementById("saveCreatePlaylist");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "Creating...";
  }

  try {
    const { error } = await window.supabaseClient
      .from("playlists")
      .insert({
        user_id: currentUser.id,
        title,
        playlist_type: "private",
        source: "rig-radio",
        is_public: false
      });

    if (error) throw error;

    closeCreatePlaylistModal();
    await loadMemberPlaylists();
  } catch (err) {
    console.error("CREATE PLAYLIST ERROR:", err);
    alert("Could not create playlist.");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Create Playlist";
    }
  }
}
async function getPlaylistCoverDisplayUrl(coverUrl) {
  if (!coverUrl) return "";

  const key = cleanStorageKey(coverUrl);
  if (key && key !== coverUrl) {
    return await signBucketKey("profiles", key);
  }

  if (!coverUrl.startsWith("http")) {
    return await signBucketKey("profiles", coverUrl);
  }

  return coverUrl;
}

async function uploadPlaylistCoverFile(file, playlistId) {
  if (!file || !currentUser || !playlistId) return "";

  const maxBytes = 5 * 1024 * 1024;

  if (!["image/jpeg", "image/png"].includes(file.type)) {
    alert("Use JPEG or PNG only.");
    return "";
  }

  if (file.size > maxBytes) {
    alert("Image must be under 5MB.");
    return "";
  }

  const ext = file.type === "image/png" ? "png" : "jpg";
  const path = `${currentUser.id}/playlist-${playlistId}-${Date.now()}.${ext}`;

  const { error } = await window.supabaseClient.storage
    .from("profiles")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: true
    });

  if (error) {
    console.error("PLAYLIST COVER UPLOAD ERROR:", error);
    alert("Playlist cover upload failed.");
    return "";
  }

  return path;
}

async function handlePlaylistCoverUpload(playlistId) {
  if (!currentUser || !viewingOwnProfile || !playlistId) return;

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/jpeg,image/png";

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;

    const coverPath = await uploadPlaylistCoverFile(file, playlistId);
    if (!coverPath) return;

    const { error } = await window.supabaseClient
      .from("playlists")
      .update({
        cover_url: coverPath,
        updated_at: new Date().toISOString()
      })
      .eq("id", playlistId)
      .eq("user_id", currentUser.id);

    if (error) {
      console.error("PLAYLIST COVER SAVE ERROR:", error);
      alert("Could not save playlist cover.");
      return;
    }

    await loadMemberPlaylists();
  });

  input.click();
}
async function loadMemberPlaylists() {
  const grid = document.getElementById("profilePlaylists");
  if (!grid || !window.supabaseClient) return;

  const ownerId = profileOwnerId || currentUser?.id;

  if (!ownerId) {
    grid.innerHTML = `
      <div class="playlist-card">
        <div class="playlist-thumb placeholder-thumb"></div>
        <div>
          <h3>No profile selected</h3>
          <p>Playlists could not be loaded.</p>
        </div>
      </div>
    `;
    return;
  }

  grid.innerHTML = `
    <div class="playlist-card">
      <div class="playlist-thumb placeholder-thumb"></div>
      <div>
        <h3>Loading playlists...</h3>
        <p>Please wait</p>
      </div>
    </div>
  `;

  try {
    let query = window.supabaseClient
      .from("playlists")
      .select("id,title,description,playlist_type,source,suno_url,cover_url,is_public,likes_count,created_at")
      .eq("user_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(6);

    if (!viewingOwnProfile) {
      query = query.eq("is_public", true);
    }

    const { data, error } = await query;

    if (error) throw error;

    if (!data || data.length === 0) {
      grid.innerHTML = `
        <div class="playlist-card">
          <div class="playlist-thumb placeholder-thumb"></div>
          <div>
            <h3>No playlists yet</h3>
            <p>${viewingOwnProfile ? "Create your first playlist soon." : "This member has no public playlists yet."}</p>
          </div>
        </div>
      `;
      return;
    }

    const playlistIds = data.map((playlist) => playlist.id);
    const itemCounts = new Map();

    if (playlistIds.length) {
      const { data: items, error: itemError } = await window.supabaseClient
        .from("playlist_items")
        .select("playlist_id")
        .in("playlist_id", playlistIds);

      if (itemError) {
        console.warn("PLAYLIST ITEMS COUNT ERROR:", itemError);
      }

      (items || []).forEach((item) => {
        itemCounts.set(item.playlist_id, (itemCounts.get(item.playlist_id) || 0) + 1);
      });
    }

    grid.innerHTML = "";

    for (const playlist of data) {
      const card = document.createElement("div");
      card.className = "playlist-card";
      card.dataset.playlistDetail = playlist.id;

      const count = itemCounts.get(playlist.id) || 0;
      const typeLabel = playlist.playlist_type === "show" ? "Show Playlist" : "Private Playlist";
      const visibility = playlist.is_public ? "Public" : "Private";

      card.innerHTML = `
        <div class="playlist-thumb placeholder-thumb"></div>
        <div>
          <h3>${escapeHtml(playlist.title || "Untitled playlist")}</h3>
          <p>${escapeHtml(count)} songs � ${escapeHtml(typeLabel)}${viewingOwnProfile ? " � " + escapeHtml(visibility) : ""}</p>
          ${viewingOwnProfile ? `<div class="playlist-card-actions"><button type="button" class="secondary-btn playlist-cover-btn" data-playlist-cover="${playlist.id}">Upload Cover</button><button type="button" class="secondary-btn" data-edit-playlist-title="${playlist.id}">Edit Title</button><button type="button" class="secondary-btn playlist-delete-btn" data-delete-playlist="${playlist.id}">Delete Playlist</button></div>` : ""}
        </div>
      `;

      const thumb = card.querySelector(".playlist-thumb");
      const coverUrl = await getPlaylistCoverDisplayUrl(playlist.cover_url);
      if (thumb && coverUrl) {
        thumb.style.backgroundImage = `url("${coverUrl}")`;
        thumb.style.backgroundSize = "cover";
        thumb.style.backgroundRepeat = "no-repeat";
        thumb.style.backgroundPosition = "center";
        thumb.style.borderStyle = "solid";
      }

      grid.appendChild(card);
    }
  } catch (err) {
    console.error("PLAYLIST LOAD ERROR:", err);
    grid.innerHTML = `
      <div class="playlist-card">
        <div class="playlist-thumb placeholder-thumb"></div>
        <div>
          <h3>Could not load playlists</h3>
          <p>Check Supabase permissions or console.</p>
        </div>
      </div>
    `;
  }
}

async function editPlaylistTitle(playlistId) {
  if (!window.supabaseClient || !playlistId) return;

  const { data: playlist, error: fetchError } = await window.supabaseClient
    .from("playlists")
    .select("id,title,user_id")
    .eq("id", playlistId)
    .single();

  if (fetchError) {
    console.error("FETCH PLAYLIST TITLE ERROR:", fetchError);
    alert("Could not load playlist title.");
    return;
  }

  const nextTitle = prompt("Playlist title", playlist?.title || "");
  if (!nextTitle || !nextTitle.trim()) return;

  const { error } = await window.supabaseClient
    .from("playlists")
    .update({ title: nextTitle.trim(), updated_at: new Date().toISOString() })
    .eq("id", playlistId);

  if (error) {
    console.error("EDIT PLAYLIST TITLE ERROR:", error);
    alert("Could not update playlist title.");
    return;
  }

  await loadMemberPlaylists();

  const detail = document.getElementById("playlistDetail");
  if (detail && !detail.hidden) await openPlaylistDetail(playlistId);
}

async function deletePlaylist(playlistId) {
  if (!window.supabaseClient || !playlistId) return;

  if (!confirm("Delete this playlist? This removes the playlist only, not the songs from your library.")) return;

  stopActiveAudio();

  const { error: itemError } = await window.supabaseClient
    .from("playlist_items")
    .delete()
    .eq("playlist_id", playlistId);

  if (itemError) {
    console.error("DELETE PLAYLIST ITEMS ERROR:", itemError);
    alert("Could not delete playlist songs.");
    return;
  }

  const { error } = await window.supabaseClient
    .from("playlists")
    .delete()
    .eq("id", playlistId);

  if (error) {
    console.error("DELETE PLAYLIST ERROR:", error);
    alert("Could not delete playlist.");
    return;
  }

  const detail = document.getElementById("playlistDetail");
  if (detail) {
    detail.hidden = true;
    detail.innerHTML = "";
  }

  await loadMemberPlaylists();
}

async function openPlaylistDetail(playlistId) {
  const detail = document.getElementById("playlistDetail");
  if (!detail || !window.supabaseClient || !playlistId) return;

  stopActiveAudio();

  detail.hidden = false;
  detail.innerHTML = `<div class="song-row"><div class="song-thumb placeholder-thumb"></div><div><h3>Loading playlist...</h3><p>Please wait</p></div></div>`;

  try {
    const { data: playlist, error: playlistError } = await window.supabaseClient
      .from("playlists")
      .select("id,title,description,playlist_type,cover_url,is_public,user_id")
      .eq("id", playlistId)
      .single();

    if (playlistError) throw playlistError;

    const { data: items, error: itemsError } = await window.supabaseClient
      .from("playlist_items")
      .select("*")
      .eq("playlist_id", playlistId)
      .order("position", { ascending: true });

    if (itemsError) throw itemsError;

    const trackIds = (items || []).map((item) => item.track_id).filter(Boolean);
    let tracksById = new Map();

    if (trackIds.length) {
      const { data: tracks, error: tracksError } = await window.supabaseClient
        .from("tracks")
        .select("*")
        .in("id", trackIds);

      if (tracksError) throw tracksError;

      tracksById = new Map((tracks || []).map((track) => [String(track.id), track]));
    }

    const coverUrl = await getPlaylistCoverDisplayUrl(playlist.cover_url);
    const count = (items || []).length;
    const visibility = playlist.is_public ? "Public" : "Private";

    detail.innerHTML = `
      <div class="playlist-detail-header">
        <div class="playlist-thumb placeholder-thumb" id="playlistDetailThumb"></div>
        <div>
          <h3>${escapeHtml(playlist.title || "Untitled playlist")}</h3>
          <p>${escapeHtml(count)} songs &middot; ${escapeHtml(visibility)}</p>
          <button class="secondary-btn" type="button" id="closePlaylistDetail">Close Playlist</button>
        </div>
      </div>
      <div class="playlist-detail-songs" id="playlistDetailSongs"></div>
    `;

    const thumb = document.getElementById("playlistDetailThumb");
    if (thumb && coverUrl) {
      thumb.style.backgroundImage = `url("${coverUrl}")`;
      thumb.style.backgroundSize = "cover";
      thumb.style.backgroundRepeat = "no-repeat";
      thumb.style.backgroundPosition = "center";
      thumb.style.borderStyle = "solid";
    }

    const songList = document.getElementById("playlistDetailSongs");

    if (!items || items.length === 0) {
      songList.innerHTML = `<div class="song-row"><div class="song-thumb placeholder-thumb"></div><div><h3>No songs yet</h3><p>This playlist is empty.</p></div></div>`;
      return;
    }

    songList.innerHTML = "";

    for (const item of items) {
      const track = item.track_id ? tracksById.get(String(item.track_id)) : null;
      const row = track || item;
      const trackId = String(track?.id || item.track_id || item.id);

      memberTracks.set(trackId, row);

      const title = row.title || row.name || item.title || "Untitled track";
      const sub = row.artist || row.artist_name || item.artist || row.genre || row.style || row.description || "Playlist track";
      const cover = track ? await getSignedCover(track) : "";

      const songRow = document.createElement("div");
      songRow.className = "song-row";
      songRow.innerHTML = `
        <div class="song-thumb placeholder-thumb"></div>
        <div>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(sub)}</p>
        </div>
        <div class="playlist-row-actions">
          <button class="song-play-btn playlist-playbar" type="button">
            <span class="playlist-play-label">Play</span>
            <span class="playlist-play-time">0:00 / 0:00</span>
            <span class="playlist-play-track">
              <span class="playlist-play-fill"></span>
            </span>
          </button>
          ${viewingOwnProfile ? `<button class="playlist-delete-btn" type="button" data-delete-playlist-item="${escapeHtml(item.id)}" data-delete-playlist-id="${escapeHtml(playlistId)}">Delete</button>` : ""}
        </div>
      `;

      if (cover) {
        const songThumb = songRow.querySelector(".song-thumb");
        songThumb.style.backgroundImage = `url("${cover}")`;
        songThumb.style.backgroundSize = "cover";
        songThumb.style.backgroundRepeat = "no-repeat";
        songThumb.style.backgroundPosition = "center";
        songThumb.style.borderStyle = "solid";
      }

      const btn = songRow.querySelector(".song-play-btn");
      if (btn) btn.dataset.trackId = trackId;

      bindSongRowPlayback(songRow);
      songList.appendChild(songRow);
    }
  } catch (err) {
    console.error("OPEN PLAYLIST DETAIL ERROR:", err);
    detail.innerHTML = `<div class="song-row"><div class="song-thumb placeholder-thumb"></div><div><h3>Could not open playlist</h3><p>Please try again.</p></div></div>`;
  }
}

async function deletePlaylistItem(itemId, playlistId) {
  if (!window.supabaseClient || !itemId || !playlistId) return;

  if (!confirm("Remove this song from the playlist?")) return;

  stopActiveAudio();

  const { error } = await window.supabaseClient
    .from("playlist_items")
    .delete()
    .eq("id", itemId);

  if (error) {
    console.error("DELETE PLAYLIST ITEM ERROR:", error);
    alert("Could not remove song from playlist.");
    return;
  }

  await loadMemberPlaylists();
  await openPlaylistDetail(playlistId);
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
    await updateFollowStats();
    await updateFollowButton();
    await loadMemberSongs(showingAllSongs);
    await loadMemberPlaylists();
  })();

  document.addEventListener("click", (event) => {
    if (event.target.closest("#createPlaylistBtn")) {
      openCreatePlaylistModal();
      return;
    }

    if (event.target.closest("#saveCreatePlaylist")) {
      createPrivatePlaylist();
      return;
    }
    if (event.target.closest("[data-close-create-playlist]")) {
      closeCreatePlaylistModal();
      return;
    }

    const editPlaylistTitleBtn = event.target.closest("[data-edit-playlist-title]");
    if (editPlaylistTitleBtn) {
      editPlaylistTitle(editPlaylistTitleBtn.dataset.editPlaylistTitle);
      return;
    }

    const deletePlaylistBtn = event.target.closest("[data-delete-playlist]");
    if (deletePlaylistBtn) {
      deletePlaylist(deletePlaylistBtn.dataset.deletePlaylist);
      return;
    }

    const playlistCoverBtn = event.target.closest("[data-playlist-cover]");
    if (playlistCoverBtn) {
      handlePlaylistCoverUpload(playlistCoverBtn.dataset.playlistCover);
      return;
    }
    const deletePlaylistItemBtn = event.target.closest("[data-delete-playlist-item]");
    if (deletePlaylistItemBtn) {
      deletePlaylistItem(
        deletePlaylistItemBtn.dataset.deletePlaylistItem,
        deletePlaylistItemBtn.dataset.deletePlaylistId
      );
      return;
    }

    const closePlaylistDetailBtn = event.target.closest("#closePlaylistDetail");
    if (closePlaylistDetailBtn) {
      stopActiveAudio();
      const detail = document.getElementById("playlistDetail");
      if (detail) {
        detail.hidden = true;
        detail.innerHTML = "";
      }
      return;
    }

    const playlistCard = event.target.closest("[data-playlist-detail]");
    if (playlistCard) {
      openPlaylistDetail(playlistCard.dataset.playlistDetail);
      return;
    }

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

    if (event.target.closest("#followMemberBtn")) {
      toggleFollowMember();
      return;
    }

    const copyPublicBtn = event.target.closest("#copyPublicProfile");
    if (copyPublicBtn) {
      const profileUrl = copyPublicBtn.dataset.profileUrl || window.location.href;
      navigator.clipboard.writeText(profileUrl);
      copyPublicBtn.textContent = "Copied!";
      setTimeout(() => {
        copyPublicBtn.textContent = "Copy Public Link";
      }, 1400);
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

/* FINAL OVERRIDE � SOCIAL LINKS AS ICONS */
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


/* NOTIFICATIONS RETRY AFTER AUTH LOAD */
window.addEventListener("load", () => {
  setTimeout(() => {
    if (typeof loadMemberNotifications === "function") loadMemberNotifications();
  }, 500);

  setTimeout(() => {
    if (typeof loadMemberNotifications === "function") loadMemberNotifications();
  }, 1500);
});
