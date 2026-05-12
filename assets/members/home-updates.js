(function () {
  const updates = {
    "Latest News": [
      {
        title: "Member Profiles Are Live",
        text: "Members can now customize accounts, covers, playlists, and public profiles."
      },
      {
        title: "Command Center Is Being Built",
        text: "The Home page is now becoming the main hub for songs, playlists, updates, and contests."
      }
    ],
    "Server Updates": [
      {
        title: "Shipped",
        text: "New landing page, live page flow, member profiles, playlists, artwork loading, and Home song sections."
      },
      {
        title: "Working On",
        text: "Top playlists, contests, member discovery, and better Home page content."
      }
    ],
    "Contest Updates": [
      {
        title: "BUILD OR BE FORGOTTEN: THE 30-DAY BUILD",
        text: "Sign up as a team in Discord, read the rules, and get locked in by May 30th."
      },
      {
        title: "Sign Up In Discord",
        text: "Go to the contest channel for rules, team signup, and official updates.",
        url: "https://discord.com/channels/1261735312950820985/1499888886493483018"
      }
    ]
  };

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

  const renderSection = (headingText, items) => {
    const headings = Array.from(document.querySelectorAll(".rr-home-card h2"));
    const heading = headings.find((h) => h.textContent.trim() === headingText);
    if (!heading) return;

    const card = heading.closest(".rr-home-card");
    if (!card) return;

    const oldList = card.querySelector(".rr-home-update-list");
    if (!oldList) return;

    oldList.innerHTML = items.map((item) => {
      const tag = item.url ? "a" : "div";
      const href = item.url ? ` href="${esc(item.url)}" target="_blank" rel="noopener"` : "";
      const extraClass = item.url ? " rr-home-update-link rr-contest-signup-link" : "";

      return `
      <${tag} class="rr-home-update${extraClass}"${href}>
        <strong>${esc(item.title)}</strong>
        <span>${esc(item.text)}</span>
      </${tag}>
    `;
    }).join("");
  };

  Object.entries(updates).forEach(([heading, items]) => renderSection(heading, items));
})();