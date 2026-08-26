(function () {
  const getShareUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const trackId = params.get("id");
    if (!trackId) return "";
    return `https://www.rig-radio.ai/song.html?id=${encodeURIComponent(trackId)}`;
  };

  const getShareTitle = () => {
    const title = document.getElementById("songTitle")?.textContent?.trim();
    const artist = document.getElementById("songArtist")?.textContent?.trim();

    if (title && artist) return `${title} — ${artist}`;
    if (title) return title;
    return "Rig-Radio Song";
  };

  const copyShareUrl = async (button, url) => {
    try {
      await navigator.clipboard.writeText(url);
      const oldText = button.textContent;
      button.textContent = "Link Copied!";
      setTimeout(() => {
        button.textContent = oldText || "Share Song";
      }, 1800);
    } catch (err) {
      console.warn("SONG SHARE COPY ERROR:", err);
      window.prompt("Copy this song link:", url);
    }
  };

  const bindShareButton = () => {
    const button = document.getElementById("shareSongBtn");
    if (!button) return;

    button.addEventListener("click", async () => {
      const url = getShareUrl();
      if (!url) return;

      const title = getShareTitle();

      if (navigator.share) {
        try {
          await navigator.share({
            title,
            text: `Listen to ${title} on Rig-Radio.`,
            url
          });
          return;
        } catch (err) {
          if (err?.name === "AbortError") return;
          console.warn("SONG NATIVE SHARE ERROR:", err);
        }
      }

      await copyShareUrl(button, url);
    });
  };

  document.addEventListener("DOMContentLoaded", bindShareButton);
})();
