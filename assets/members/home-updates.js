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
        title: "Contest Center Coming",
        text: "This area will show open contests, voting dates, prizes, and winners."
      },
      {
        title: "Member Voting",
        text: "Future contests can tie into likes, plays, playlists, and community picks."
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

    oldList.innerHTML = items.map((item) => `
      <div class="rr-home-update">
        <strong>${esc(item.title)}</strong>
        <span>${esc(item.text)}</span>
      </div>
    `).join("");
  };

  Object.entries(updates).forEach(([heading, items]) => renderSection(heading, items));
})();