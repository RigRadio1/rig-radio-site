(function () {
  const $ = (id) => document.getElementById(id);

  const escText = (value, fallback = "") => {
    const text = value == null ? fallback : String(value);
    return text || fallback;
  };

  const cleanStorageKey = (value) => {
    if (!value) return "";

    const raw = String(value).trim();

    try {
      const url = new URL(raw, window.location.origin);
      const marker = "/storage/v1/object/public/tracks/";
      const index = url.pathname.indexOf(marker);

      if (index >= 0) {
        return decodeURIComponent(url.pathname.slice(index + marker.length));
      }
    } catch (_) {}

    return raw.replace(/^tracks\//, "").replace(/^\/+/, "");
  };

  const signTrackKey = async (client, key) => {
    const cleanKey = cleanStorageKey(key);
    if (!client || !cleanKey) return "";

    try {
      const { data, error } = await client.storage
        .from("tracks")
        .createSignedUrl(cleanKey, 3600);

      if (error || !data?.signedUrl) return "";
      return data.signedUrl;
    } catch (err) {
      console.warn("SIGN TRACK KEY ERROR:", err);
      return "";
    }
  };

  const waitForClient = async () => {
    for (let i = 0; i < 50; i++) {
      if (window._sb) return window._sb;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return null;
  };

  const incLike = async (client, trackId) => {
    try {
      const { data, error } = await client.rpc("inc_like", { p_track_id: trackId });
      if (error) return null;

      if (Array.isArray(data) && data.length > 0) return data[0].inc_like ?? data[0];
      if (typeof data === "number") return data;

      return null;
    } catch (err) {
      console.warn("LIKE ERROR:", err);
      return null;
    }
  };

  const loadSong = async () => {
    const params = new URLSearchParams(window.location.search);
    const trackId = params.get("id");

    if (!trackId) {
      $("songTitle").textContent = "No song selected";
      $("songLyrics").textContent = "Open this page from a song link.";
      return;
    }

    const client = await waitForClient();

    if (!client) {
      $("songTitle").textContent = "Song data not connected";
      $("songLyrics").textContent = "Could not connect to Supabase.";
      return;
    }

    const { data: track, error } = await client
      .from("tracks")
      .select("*")
      .eq("id", trackId)
      .single();

    if (error || !track) {
      console.error("SONG LOAD ERROR:", error);
      $("songTitle").textContent = "Song not found";
      $("songLyrics").textContent = "This song could not be loaded.";
      return;
    }

    const title = escText(track.title || track.name, "Untitled Song");
    const artist = escText(track.artist || track.artist_name, "Unknown Artist");
    const genre = escText(track.genre || track.style, "Genre");
    const lyrics = escText(track.lyrics || track.notes || track.description, "No lyrics added yet.");
    const plays = Number(track.plays || track.play_count || track.streams || 0);
    const likes = Number(track.likes || track.likes_count || 0);

    document.title = `${title} | Rig-Radio`;
    $("songTitle").textContent = title;
    $("songArtist").textContent = artist;
    $("songGenre").textContent = genre;
    $("songLyrics").textContent = lyrics;
    $("songStats").textContent = `${plays} plays · ${likes} likes`;

    const likeBtn = $("likeSongBtn");
    const likeKey = `song-liked:${track.id}`;

    if (localStorage.getItem(likeKey) === "1") {
      likeBtn.textContent = "? Liked";
      likeBtn.disabled = true;
    }

    likeBtn.addEventListener("click", async () => {
      if (localStorage.getItem(likeKey) === "1") return;

      likeBtn.disabled = true;
      likeBtn.textContent = "Liking...";

      const newLikes = await incLike(client, track.id);

      if (newLikes !== null) {
        localStorage.setItem(likeKey, "1");
        likeBtn.textContent = "? Liked";
        $("songStats").textContent = `${plays} plays · ${newLikes} likes`;
      } else {
        likeBtn.disabled = false;
        likeBtn.textContent = "? Like";
      }
    });

    const coverUrl =
      await signTrackKey(client, track.cover_path) ||
      await signTrackKey(client, track.cover_url) ||
      track.cover_url ||
      track.artwork_url ||
      "/banner.png";

    $("songCover").src = coverUrl || "/banner.png";

    const audioUrl =
      await signTrackKey(client, track.track_path) ||
      await signTrackKey(client, track.audio_path) ||
      track.audio_url ||
      "";

    if (audioUrl) {
      $("songPlayer").src = audioUrl;
    }

    if (track.user_id) {
      $("creatorHandle").textContent = "Creator profile loading...";
      loadCreator(client, track.user_id);
    }
  };

  const loadCreator = async (client, userId) => {
    const { data: profile, error } = await client
      .from("member_profiles")
      .select("display_name,handle,avatar_path")
      .eq("id", userId)
      .single();

    if (error || !profile) {
      $("creatorHandle").textContent = "@creator";
      return;
    }

    $("songArtist").textContent = profile.display_name || $("songArtist").textContent;
    $("creatorHandle").textContent = profile.handle || "@creator";

    if (profile.avatar_path) {
      const avatarUrl = await client.storage
        .from("profiles")
        .createSignedUrl(profile.avatar_path, 3600);

      if (avatarUrl?.data?.signedUrl) {
        $("creatorAvatar").src = avatarUrl.data.signedUrl;
      }
    }
  };

  document.addEventListener("DOMContentLoaded", loadSong);
})();