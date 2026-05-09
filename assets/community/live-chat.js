(function () {
  const CHAT_TABLE = "live_chat_messages";

  const messagesEl = document.getElementById("live-chat-messages");
  const formEl = document.getElementById("live-chat-form");
  const inputEl = document.getElementById("live-chat-input");
  const statusEl = document.getElementById("live-chat-status");
  const emoteButtons = document.querySelectorAll("[data-emote]");

  let currentUser = null;
  let sb = null;

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function displayName(user) {
    const meta = user && user.user_metadata;
    return (
      (meta && (meta.display_name || meta.full_name || meta.name)) ||
      "Member"
    );
  }

  function renderMessages(messages) {
    if (!messagesEl) return;

    if (!messages || !messages.length) {
      messagesEl.innerHTML = `
        <div class="chat-line locked">
          <strong>System</strong>
          <span>No messages yet. Be the first to talk.</span>
        </div>
      `;
      return;
    }

    messagesEl.innerHTML = messages
      .map((msg) => {
        const name = escapeHtml(msg.display_name || "Member");
        const text = escapeHtml(msg.message || "");
        const time = new Date(msg.created_at).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        });

        return `
          <div class="chat-line">
            <strong>${name} <em>${time}</em></strong>
            <span>${text}</span>
          </div>
        `;
      })
      .join("");

    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function loadMessages() {
    const { data, error } = await sb
      .from(CHAT_TABLE)
      .select("id, display_name, message, created_at")
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) {
      console.error(error);
      if (statusEl) statusEl.textContent = "Chat could not load.";
      return;
    }

    renderMessages(data);
  }

  async function initChat() {
    sb = window._sb;

    if (!sb) {
      setTimeout(initChat, 300);
      return;
    }

    const { data } = await sb.auth.getSession();
    currentUser = data && data.session && data.session.user;

    if (!currentUser) {
  window.location.href = "/login.html";
  return;
}

if (statusEl) statusEl.textContent = "You are live in the room.";
if (formEl) formEl.style.display = "flex";

    await loadMessages();

    sb.channel("live-radio-chat")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: CHAT_TABLE,
        },
        loadMessages
      )
      .subscribe();

    if (formEl) {
      formEl.addEventListener("submit", async function (event) {
        event.preventDefault();
        emoteButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    if (!inputEl) return;

    const emote = button.getAttribute("data-emote") || "";
    inputEl.value = (inputEl.value + " " + emote).trim() + " ";
    inputEl.focus();
  });
});

        const message = (inputEl.value || "").trim();
        if (!message || !currentUser) return;

        inputEl.value = "";

     const { error } = await sb.from(CHAT_TABLE).insert({
  user_id: currentUser.id,
  display_name: displayName(currentUser),
  message,
});

if (error) {
  console.error(error);
  if (statusEl) statusEl.textContent = "Message failed to send.";
  return;
}

await loadMessages();
      });
    }
  }

  window.addEventListener("load", initChat);
})();