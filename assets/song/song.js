(function () {
  const $ = (id) => document.getElementById(id);

  let currentTrack = null;
  let currentPlays = 0;
  let currentLikes = 0;
  let playCounted = false;

  const text = (value, fallback = "") => {
    const out = value == null ? fallback : String(value);
    return out || fallback;
  };

  const formatTime = (seconds) => {
    seconds = Number(seconds) || 0;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const updateStats = () => {
    $("songStats").textContent = `${currentPlays} plays - ${currentLikes} likes`;
  };

  const cleanStorageKey = (value) => {
    if (!value) return "";
    const raw = String(value).trim();

    try {
      const url = new URL(raw, window.location.origin);
      const marker = "/storage/v1/object/public/tracks/";
      const index = url.pathname.indexOf(marker);
      if (index >= 0) return decodeURIComponent(url.pathname.slice(index + marker.length));
    } catch (_) {}

    return raw.replace(/^tracks\//, "").replace(/^\/+/, "");
  };

  const signTrackKey = async (client, key) => {
    const cleanKey = cleanStorageKey(key);
    if (!client || !cleanKey) return "";

    try {
      const { data, error } = await client.storage.from("tracks").createSignedUrl(cleanKey, 3600);
      if (error || !data?.signedUrl) return "";
      return data.signedUrl;
    } catch (err) {
      console.warn("SIGN ERROR:", err);
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

  const getCurrentUser = async (client) => {
    try {
      const { data } = await client.auth.getSession();
      return data?.session?.user || null;
    } catch (_) {
      return null;
    }
  };

  const incPlay = async (client, trackId) => {
    try {
      const { data, error } = await client.rpc("inc_play", { p_track_id: trackId });
      if (error) {
        console.warn("INC PLAY ERROR:", error);
        return null;
      }

      if (Array.isArray(data) && data.length > 0) return data[0].inc_play ?? data[0];
      if (typeof data === "number") return data;
      return null;
    } catch (err) {
      console.warn("PLAY COUNT ERROR:", err);
      return null;
    }
  };

  const createNotification = async (client, { recipientId, actorId, trackId, type, message }) => {
    if (!recipientId || !actorId || !trackId) return;
    if (recipientId === actorId) return;

    try {
      const { error } = await client
        .from("member_notifications")
        .insert({
          recipient_id: recipientId,
          actor_id: actorId,
          track_id: trackId,
          type,
          message
        });

      if (error) console.warn("NOTIFICATION ERROR:", error);
    } catch (err) {
      console.warn("NOTIFICATION ERROR:", err);
    }
  };

  const incLike = async (client, trackId) => {
    try {
      const { data, error } = await client.rpc("inc_like", { p_track_id: trackId });
      if (error) {
        console.warn("INC LIKE ERROR:", error);
        return null;
      }

      if (Array.isArray(data) && data.length > 0) return data[0].inc_like ?? data[0];
      if (typeof data === "number") return data;
      return null;
    } catch (err) {
      console.warn("LIKE ERROR:", err);
      return null;
    }
  };

  const bindPlayer = (client, track) => {
    const audio = $("songPlayer");
    const toggle = $("playerToggle");
    const seek = $("playerSeek");
    const time = $("playerTime");

    toggle.addEventListener("click", async () => {
      if (!audio.src) return;

      if (audio.paused) {
        await audio.play().catch((err) => console.warn("PLAY ERROR:", err));
      } else {
        audio.pause();
      }
    });

    audio.addEventListener("play", async () => {
      toggle.textContent = "Pause";

      if (!playCounted) {
        playCounted = true;
        const newPlays = await incPlay(client, track.id);
        if (newPlays !== null) {
          currentPlays = newPlays;
          updateStats();
        }
      }
    });

    audio.addEventListener("pause", () => {
      toggle.textContent = "Play";
    });

    audio.addEventListener("ended", () => {
      toggle.textContent = "Play";
      seek.value = 0;
    });

    audio.addEventListener("timeupdate", () => {
      if (audio.duration) seek.value = String((audio.currentTime / audio.duration) * 100);
      time.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
    });

    audio.addEventListener("loadedmetadata", () => {
      time.textContent = `0:00 / ${formatTime(audio.duration)}`;
    });

    seek.addEventListener("input", () => {
      if (!audio.duration) return;
      audio.currentTime = (Number(seek.value) / 100) * audio.duration;
    });
  };

  const bindLike = (client, track, currentUser) => {
    const likeBtn = $("likeSongBtn");
    const likeKey = `song-liked:${track.id}`;

    likeBtn.textContent = "Like";

    if (localStorage.getItem(likeKey) === "1") {
      likeBtn.textContent = "Liked";
      likeBtn.disabled = true;
    }

    likeBtn.addEventListener("click", async () => {
      if (localStorage.getItem(likeKey) === "1") return;

      likeBtn.disabled = true;
      likeBtn.textContent = "Liking...";

      const newLikes = await incLike(client, track.id);

      if (newLikes !== null) {
        currentLikes = newLikes;
        localStorage.setItem(likeKey, "1");
        likeBtn.textContent = "Liked";
        updateStats();

        await createNotification(client, {
          recipientId: track.user_id,
          actorId: currentUser?.id,
          trackId: track.id,
          type: "song_like",
          message: "liked your song"
        });
      } else {
        likeBtn.disabled = false;
        likeBtn.textContent = "Like";
      }
    });
  };

  const bindComments = async (client, trackId, currentUser) => {
    const input = $("commentInput");
    const postBtn = $("postCommentBtn");
    const list = $("commentsList");

    if (!input || !postBtn || !list) return;

    let replyingTo = null;

    const esc = (value) => String(value || "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m]));

    const renderComments = async () => {
      list.innerHTML = '<p class="song-muted">Loading comments...</p>';

      const { data: comments, error } = await client
        .from("song_comments")
        .select("id, body, user_id, parent_comment_id, created_at")
        .eq("track_id", trackId)
        .order("created_at", { ascending: true });

      if (error) {
        console.warn("COMMENTS LOAD ERROR:", error);
        list.innerHTML = '<p class="song-muted">Could not load comments.</p>';
        return;
      }

      if (!comments || comments.length === 0) {
        list.innerHTML = '<p class="song-muted">No comments yet. Be the first.</p>';
        return;
      }

      const commentIds = comments.map((c) => c.id);
      let likedCommentIds = new Set();

      if (currentUser && commentIds.length) {
        const { data: likedRows } = await client
          .from("song_comment_likes")
          .select("comment_id")
          .eq("user_id", currentUser.id)
          .in("comment_id", commentIds);

        likedCommentIds = new Set((likedRows || []).map((row) => row.comment_id));
      }

      const userIds = [...new Set(comments.map((c) => c.user_id).filter(Boolean))];
      let profilesById = new Map();
      let avatarsById = new Map();

      if (userIds.length) {
        const { data: profiles } = await client
          .from("member_profiles")
          .select("id, display_name, handle, avatar_path")
          .in("id", userIds);

        profilesById = new Map((profiles || []).map((p) => [p.id, p]));

        const avatarPairs = await Promise.all((profiles || []).map(async (p) => {
          if (!p.avatar_path) return [p.id, "/banner.png"];

          try {
            const { data } = await client.storage
              .from("profiles")
              .createSignedUrl(p.avatar_path, 3600);

            return [p.id, data?.signedUrl || "/banner.png"];
          } catch (_) {
            return [p.id, "/banner.png"];
          }
        }));

        avatarsById = new Map(avatarPairs);
      }

      const childrenByParent = new Map();

      comments.forEach((comment) => {
        const parentId = comment.parent_comment_id || "root";
        if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
        childrenByParent.get(parentId).push(comment);
      });

      const renderOne = (comment, isReply = false) => {
        const profile = profilesById.get(comment.user_id);
        const name = profile?.display_name || profile?.handle || "Rig-Radio Member";
        const date = new Date(comment.created_at).toLocaleDateString();
        const avatar = avatarsById.get(comment.user_id) || "/banner.png";
        const replies = childrenByParent.get(comment.id) || [];

        const canCreatorReply =
          currentUser &&
          !isReply &&
          currentTrack?.user_id === currentUser.id &&
          comment.user_id !== currentUser.id &&
          replies.length === 0;

        const showHeartReply = isReply;
        const canHeartReply =
          currentUser &&
          isReply &&
          comment.user_id !== currentUser.id;

        const isLiked = likedCommentIds.has(comment.id);

        return `
          <div class="song-comment ${isReply ? "song-comment-reply" : ""}" data-comment-id="${comment.id}" data-comment-user="${comment.user_id}">
            <img class="song-comment-avatar" src="${avatar}" alt="" />
            <div class="song-comment-body">
              <div class="song-comment-head">
                <strong>${esc(name)}</strong>
                <span>${esc(date)}</span>
              </div>

              <div class="song-comment-text-row">
                <p>${esc(comment.body)}</p>
                ${showHeartReply ? '<button class="song-comment-heart ' + (isLiked ? 'is-liked' : '') + '" type="button" ' + (canHeartReply ? 'data-comment-like="' + comment.id + '"' : 'disabled') + '>' + (isLiked ? '?' : '?') + '</button>' : ''}
              </div>

              ${canCreatorReply ? '<button class="song-comment-reply-btn" type="button" data-reply-comment="' + comment.id + '">Reply</button>' : ''}
              ${replies.length ? '<div class="song-comment-replies">' + replies.map((reply) => renderOne(reply, true)).join("") + '</div>' : ''}
            </div>
          </div>
        `;
      };

      const rootComments = childrenByParent.get("root") || [];
      list.innerHTML = rootComments.map((comment) => renderOne(comment, false)).join("");
    };

    document.querySelectorAll("[data-emoji]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const emoji = btn.dataset.emoji || "";
        input.value = input.value ? input.value + " " + emoji : emoji;
        input.focus();
      });
    });

    await renderComments();

    if (!currentUser) {
      postBtn.textContent = "Log in to Comment";
      postBtn.addEventListener("click", () => {
        const returnTo = window.location.pathname + window.location.search;
        window.location.href = "/login.html?redirect=" + encodeURIComponent(returnTo);
      });
      return;
    }

    list.addEventListener("click", async (event) => {
      const heartBtn = event.target.closest("[data-comment-like]");
      if (heartBtn) {
        const commentId = heartBtn.dataset.commentLike;
        const isLiked = heartBtn.classList.contains("is-liked");

        heartBtn.disabled = true;

        try {
          if (isLiked) {
            const { error } = await client
              .from("song_comment_likes")
              .delete()
              .eq("comment_id", commentId)
              .eq("user_id", currentUser.id);

            if (error) throw error;
          } else {
            const { error } = await client
              .from("song_comment_likes")
              .insert({
                comment_id: commentId,
                user_id: currentUser.id
              });

            if (error) throw error;
          }

          await renderComments();
        } catch (err) {
          console.error("COMMENT LIKE ERROR:", err);
          alert("Could not update heart.");
        } finally {
          heartBtn.disabled = false;
        }

        return;
      }

      const replyBtn = event.target.closest("[data-reply-comment]");
      if (!replyBtn) return;

      const commentEl = replyBtn.closest(".song-comment");
      const name = commentEl?.querySelector(".song-comment-head strong")?.textContent || "comment";

      replyingTo = {
        id: replyBtn.dataset.replyComment,
        userId: commentEl?.dataset.commentUser || ""
      };

      input.placeholder = "Replying to " + name + "...";
      input.focus();
    });

    postBtn.addEventListener("click", async () => {
      const body = input.value.trim();

      if (!body) return;

      postBtn.disabled = true;
      postBtn.textContent = replyingTo ? "Replying..." : "Posting...";

      try {
        const insertRow = {
          track_id: trackId,
          user_id: currentUser.id,
          body
        };

        if (replyingTo?.id) insertRow.parent_comment_id = replyingTo.id;

        const { error } = await client
          .from("song_comments")
          .insert(insertRow);

        if (error) throw error;

        if (replyingTo?.userId) {
          await createNotification(client, {
            recipientId: replyingTo.userId,
            actorId: currentUser.id,
            trackId,
            type: "comment_reply",
            message: "replied to your comment"
          });
        } else {
          await createNotification(client, {
            recipientId: currentTrack?.user_id,
            actorId: currentUser.id,
            trackId,
            type: "song_comment",
            message: "commented on your song"
          });
        }

        input.value = "";
        input.placeholder = "Leave a comment...";
        replyingTo = null;

        await renderComments();
      } catch (err) {
        console.error("COMMENT POST ERROR:", err);
        alert("Could not post comment.");
      } finally {
        postBtn.disabled = false;
        postBtn.textContent = "Post Comment";
      }
    });
  };

  const bindFollow = async (client, creatorId, currentUser) => {
    const btn = $("followCreatorBtn");
    if (!btn || !creatorId) return;

    if (currentUser?.id && currentUser.id === creatorId) {
      btn.hidden = true;
      return;
    }

    btn.hidden = false;

    if (!currentUser) {
      btn.textContent = "Log in to Follow";
      btn.addEventListener("click", () => {
        const returnTo = window.location.pathname + window.location.search;
        window.location.href = "/login.html?redirect=" + encodeURIComponent(returnTo);
      });
      return;
    }

    const refreshButton = async () => {
      const { data } = await client
        .from("member_follows")
        .select("follower_id")
        .eq("follower_id", currentUser.id)
        .eq("following_id", creatorId)
        .maybeSingle();

      btn.dataset.following = data ? "1" : "0";
      btn.textContent = data ? "Following" : "Follow";
    };

    await refreshButton();

    btn.addEventListener("click", async () => {
      btn.disabled = true;

      try {
        const isFollowing = btn.dataset.following === "1";

        if (isFollowing) {
          const { error } = await client
            .from("member_follows")
            .delete()
            .eq("follower_id", currentUser.id)
            .eq("following_id", creatorId);

          if (error) throw error;
        } else {
          const { error } = await client
            .from("member_follows")
            .insert({
              follower_id: currentUser.id,
              following_id: creatorId
            });

          if (error) throw error;
        }

        await refreshButton();
      } catch (err) {
        console.error("SONG FOLLOW ERROR:", err);
        alert("Could not update follow.");
      } finally {
        btn.disabled = false;
      }
    });
  };

  const loadCreator = async (client, userId) => {
    const { data: profile } = await client
      .from("member_profiles")
      .select("display_name,handle,avatar_path")
      .eq("id", userId)
      .single();

    if (!profile) {
      $("creatorHandle").textContent = "@creator";
      return;
    }

    $("songArtist").textContent = profile.display_name || $("songArtist").textContent;
    $("creatorHandle").textContent = profile.handle || "@creator";

    if (profile.avatar_path) {
      const { data } = await client.storage.from("profiles").createSignedUrl(profile.avatar_path, 3600);
      if (data?.signedUrl) $("creatorAvatar").src = data.signedUrl;
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

    const currentUser = await getCurrentUser(client);

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

    currentTrack = track;
    currentPlays = Number(track.plays || track.play_count || track.streams || 0);
    currentLikes = Number(track.likes || track.likes_count || 0);

    const title = text(track.title || track.name, "Untitled Song");
    const artist = text(track.artist || track.artist_name, "Unknown Artist");
    const genre = text(track.genre || track.style, "Genre");
    const lyrics = text(track.lyrics || track.notes || track.description, "No lyrics added yet.");

    document.title = `${title} | Rig-Radio`;
    $("songTitle").textContent = title;
    $("songArtist").textContent = artist;
    $("songGenre").textContent = genre;
    $("songLyrics").textContent = lyrics;
    updateStats();

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

    if (audioUrl) $("songPlayer").src = audioUrl;

    bindPlayer(client, track);
    bindLike(client, track, currentUser);
    await bindComments(client, track.id, currentUser);

    if (track.user_id) {
      await loadCreator(client, track.user_id);
      await bindFollow(client, track.user_id, currentUser);
    }
  };

  document.addEventListener("DOMContentLoaded", loadSong);
})();