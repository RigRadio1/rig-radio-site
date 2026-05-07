// DJ Booth — grouped Library by Artist with A/B/C dividers
// (YouTube auto-title, URLs, no autoplay, audio crossfader unchanged)

var _client = window.supabase.createClient(
  "https://tpzpeoqdpfwqumlsyhpx.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwenBlb3FkcGZ3cXVtbHN5aHB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMDM5NTEsImV4cCI6MjA3MjU3OTk1MX0.nP8W_G_N9GKucj6tlzyvSAOjhiqTBD-F564i0gNhp8E"
);

// Deck caches
var audioA, audioB, iframeA, iframeB, pill;

// ---------- Helpers ----------
function isYouTube(url){ return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(url); }
function isMp3(url){ return /\.mp3(\?.*)?$/i.test(url); }
function ytToEmbed(url){
  try{
    var u = new URL(url), id = "";
    if (u.hostname.includes("youtu.be")) id = u.pathname.slice(1);
    if (u.hostname.includes("youtube.com")) id = u.searchParams.get("v") || "";
    return id ? "https://www.youtube.com/embed/" + id + "?rel=0&modestbranding=1&autoplay=0" : "";
  }catch(e){ return ""; }
}
function updateNowPill(){
  var a = document.getElementById("deckA_now")?.textContent || "";
  var b = document.getElementById("deckB_now")?.textContent || "";
  if (pill) pill.textContent = (a && b) ? ("A: " + a + "  |  B: " + b) : (a || b || "—");
}

// ---------- Library (Supabase) — GROUPED + DIVIDERS ----------
function loadTracks() {
  var box = document.getElementById("trackList");
  var search = document.getElementById("libSearch");
  if (!box) return;

  function render(list) {
    // Group by artist
    var groups = {};
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      var artist = (t.artist || "").trim() || "(Unknown Artist)";
      if (!groups[artist]) groups[artist] = [];
      groups[artist].push(t);
    }

    // Sort artists A–Z (Unknown at end)
    var artists = Object.keys(groups).sort(function(a,b){
      if (a === "(Unknown Artist)") return 1;
      if (b === "(Unknown Artist)") return -1;
      a = a.toLowerCase(); b = b.toLowerCase();
      return a < b ? -1 : a > b ? 1 : 0;
    });

    // Build with letter dividers
    box.textContent = "";
    var currentLetter = null;
    for (var g = 0; g < artists.length; g++) {
      var artistName = artists[g];
      var tracks = groups[artistName];

      var first = artistName.trim().charAt(0).toUpperCase();
      if (!/^[A-Z]$/.test(first)) first = "#";

      if (first !== currentLetter) {
        currentLetter = first;
        var divider = document.createElement("div");
        divider.className = "letter-divider";
        divider.textContent = currentLetter;
        box.appendChild(divider);
      }

      var details = document.createElement("details");
      details.className = "artist-folder";
      if (g < 4) details.open = true;

      var summary = document.createElement("summary");
      summary.textContent = artistName + "  (" + tracks.length + ")";
      details.appendChild(summary);

      for (var j = 0; j < tracks.length; j++) {
        var t = tracks[j];
        var row = document.createElement("div");
        row.className = "track-row";

        var title = t.title || "(untitled)";
        var label = document.createElement("span");
        label.textContent = title;

        var btn = document.createElement("button");
        btn.textContent = "Add";
        (function(title, artist, path){
          btn.addEventListener("click", function () {
            addToQueue({ type:"supabase", title:title, artist:artist, path:path });
          });
        })(title, artistName, t.track_path || "");

        row.appendChild(label);
        row.appendChild(btn);
        details.appendChild(row);
      }

      box.appendChild(details);
    }
  }

  box.textContent = "Loading…";
  _client
    .from("tracks")
    .select("id, title, artist, track_path")
    .order("artist", { ascending: true })
    .order("title", { ascending: true })
    .limit(500)
    .then(function (res) {
      var data = res.data, error = res.error;
      if (error) { box.textContent = "Error loading tracks"; console.error(error); return; }
      if (!data || !data.length) { box.textContent = "No tracks found."; return; }

      render(data);

      // simple filter (artist + title)
      if (search && !search._wired) {
        search._wired = true;
        search.addEventListener("input", function(){
          var q = (search.value || "").toLowerCase();
          var filtered = data.filter(function(t){
            var s = ((t.artist||"") + " " + (t.title||"")).toLowerCase();
            return s.indexOf(q) !== -1;
          });
          render(filtered);
        });
      }
    });
}

// ---------- Add URL (YouTube auto-title) ----------
function addUrlFromInputs(){
  var urlEl   = document.getElementById("urlInput");
  var labelEl = document.getElementById("urlLabel");
  var url  = (urlEl.value || "").trim();
  var label = (labelEl.value || "").trim();
  if (!url) return;

  function finishAdd(item){
    addToQueue(item);
    urlEl.value = "";
    labelEl.value = "";
  }

  if (isYouTube(url)) {
    var item = { type:"youtube", url:url, title: label || "YouTube", artist:"" };
    var oembed = "https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent(url);
    fetch(oembed)
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(meta){
        if (meta && meta.title && !label) item.title = meta.title;
        finishAdd(item);
      })
      .catch(function(){ finishAdd(item); });
    return;
  }

  if (isMp3(url)) {
    finishAdd({ type:"url-mp3", url:url, title: label || url.split("/").pop(), artist:"" });
    return;
  }

  finishAdd({ type:"url", url:url, title: label || url, artist:"" });
}

// ---------- Queue ops ----------
function addToQueue(item, skipSave) {
  var list = document.getElementById("queueList");
  if (!list) return;

  var li = document.createElement("li");
  li.dataset.type = item.type || "url";
  li.dataset.path = item.path || "";
  li.dataset.url  = item.url  || "";

  var display = item.title || "(untitled)";
  if (item.artist) display += " — " + item.artist;

  var span = document.createElement("span");
  span.textContent = display;
  li.appendChild(span);

  var btnA = document.createElement("button");
  btnA.textContent = "Load A";
  btnA.addEventListener("click", function(){ loadDeckFromItem("A", display, li.dataset.type, li.dataset.path, li.dataset.url); });
  li.appendChild(btnA);

  var btnB = document.createElement("button");
  btnB.textContent = "Load B";
  btnB.addEventListener("click", function(){ loadDeckFromItem("B", display, li.dataset.type, li.dataset.path, li.dataset.url); });
  li.appendChild(btnB);

  var btnX = document.createElement("button");
  btnX.textContent = "Remove";
  btnX.addEventListener("click", function(){ li.remove(); saveQueue(); });
  li.appendChild(btnX);

  list.appendChild(li);
  if (!skipSave) saveQueue();
}

function loadDeckFromItem(side, labelText, type, path, url){
  var nowEl = side === "A" ? document.getElementById("deckA_now") : document.getElementById("deckB_now");
  if (nowEl) nowEl.textContent = labelText || "(empty)";
  updateNowPill();
  localStorage.setItem("dj_now_playing", labelText || "");

  var audio = side === "A" ? audioA : audioB;
  var frame = side === "A" ? iframeA : iframeB;
  if (audio) { audio.pause(); audio.removeAttribute("src"); audio.load(); }
  if (frame) { frame.removeAttribute("src"); frame.style.display = "none"; }

  if (type === "supabase" && path) {
    _client.storage.from("tracks").createSignedUrl(path, 3600).then(function(res){
      if (res.error) { console.error(res.error); return; }
      var signed = res.data && res.data.signedUrl;
      if (!audio) return;
      audio.autoplay = false;
      audio.src = signed;
      audio.load();
    });
    return;
  }

  if ((type === "url-mp3" || (type === "url" && isMp3(url))) && url) {
    if (!audio) return;
    audio.autoplay = false;
    audio.src = url;
    audio.load();
    return;
  }

  if (type === "youtube" && url) {
    var embed = ytToEmbed(url);
    if (embed && frame) {
      frame.src = embed;      // no autoplay
      frame.style.display = "block";
    }
    return;
  }

  console.warn("Unsupported item for playback:", {type, path, url});
}

// ---------- Crossfader (audio decks only) ----------
function applyFader(value){
  var v = Math.max(0, Math.min(100, parseInt(value,10) || 0));
  var aGain = (100 - v) / 100;
  var bGain = v / 100;
  if (audioA) audioA.volume = aGain;
  if (audioB) audioB.volume = bGain;
}

// ---------- Persistence ----------
var QUEUE_KEY = "djbooth_tonight_queue";

function saveQueue() {
  var lis = document.querySelectorAll("#queueList li");
  var items = [];
  for (var i = 0; i < lis.length; i++) {
    var span = lis[i].querySelector("span");
    items.push({
      display: span ? span.textContent : "",
      type: lis[i].dataset.type || "url",
      path: lis[i].dataset.path || "",
      url : lis[i].dataset.url  || ""
    });
  }
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(items)); }
  catch (e) { console.warn("Could not save queue:", e); }
}

function loadQueueLocal() {
  var raw = localStorage.getItem(QUEUE_KEY);
  var list = document.getElementById("queueList");
  if (!list) return;
  list.innerHTML = "";
  if (!raw) return;
  try {
    var items = JSON.parse(raw);
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var parts = (it.display || "").split(" — ");
      var t = parts[0] || it.display || "";
      var a = parts.length > 1 ? parts.slice(1).join(" — ") : "";
      addToQueue({ type:it.type, title:t, artist:a, path:it.path, url:it.url }, true);
    }
  } catch (e) { console.warn("Bad queue JSON", e); }
}

function clearQueue() {
  var list = document.getElementById("queueList");
  if (list) list.innerHTML = "";
  try { localStorage.removeItem(QUEUE_KEY); } catch (e) {}
}

// ---------- Boot ----------
document.addEventListener("DOMContentLoaded", function () {
  audioA  = document.getElementById("deckA_audio");
  audioB  = document.getElementById("deckB_audio");
  iframeA = document.getElementById("deckA_iframe");
  iframeB = document.getElementById("deckB_iframe");
  pill    = document.getElementById("nowPlayingPill");

  var fader = document.getElementById("crossfader");
  if (fader) { applyFader(fader.value); fader.addEventListener("input", function(){ applyFader(this.value); }); }

  document.getElementById("saveQueueBtn").addEventListener("click", saveQueue);
  document.getElementById("loadQueueBtn").addEventListener("click", loadQueueLocal);
  document.getElementById("clearQueueBtn").addEventListener("click", clearQueue);

  var addBtn = document.getElementById("addUrlBtn");
  if (addBtn) addBtn.addEventListener("click", addUrlFromInputs);
  var urlInput = document.getElementById("urlInput");
  if (urlInput) urlInput.addEventListener("keydown", function(e){ if(e.key==="Enter") addUrlFromInputs(); });

  document.getElementById("clearDeckA").addEventListener("click", function(){ clearDeck("leftDeck"); });
  document.getElementById("clearDeckB").addEventListener("click", function(){ clearDeck("rightDeck"); });

  loadTracks();
});

function clearDeck(deckId) {
  var nowEl = deckId === "leftDeck" ? document.getElementById("deckA_now")
                                    : document.getElementById("deckB_now");
  if (nowEl) nowEl.textContent = "(empty)";
  var audio = deckId === "leftDeck" ? audioA : audioB;
  var frame = deckId === "leftDeck" ? iframeA : iframeB;
  if (audio) { audio.pause(); audio.removeAttribute("src"); audio.load(); }
  if (frame) { frame.removeAttribute("src"); frame.style.display = "none"; }
  updateNowPill();
}
/* === Waveform-style progress (A/B) === */
(function(){
  function bindWave(audioEl, waveEl){
    if (!audioEl || !waveEl) return;
    function paint(){
      var d = audioEl.duration || 0;
      var t = audioEl.currentTime || 0;
      var pct = (!d || !isFinite(d)) ? 0 : Math.max(0, Math.min(100, (t / d) * 100));
      waveEl.style.width = pct.toFixed(2) + "%";
    }
    audioEl.addEventListener("timeupdate", paint);
    audioEl.addEventListener("loadedmetadata", paint);
    audioEl.addEventListener("seeked", paint);
    audioEl.addEventListener("ended", function(){ waveEl.style.width = "0%"; });
  }
  document.addEventListener("DOMContentLoaded", function(){
    bindWave(document.getElementById("deckA_audio"), document.getElementById("waveA"));
    bindWave(document.getElementById("deckB_audio"), document.getElementById("waveB"));
  });
})();
/* === Playing indicator (green LED on deck when audio is running) === */
(function(){
  function wirePlayingClass(audioEl, deckEl){
    if (!audioEl || !deckEl) return;
    function refresh(){
      var on = !audioEl.paused && !audioEl.ended && (audioEl.currentTime||0) > 0;
      deckEl.classList.toggle("playing", !!on);
    }
    ["play","pause","ended","emptied","seeking","seeked","timeupdate","loadedmetadata"].forEach(function(ev){
      audioEl.addEventListener(ev, refresh);
    });
    refresh();
  }
  document.addEventListener("DOMContentLoaded", function(){
    wirePlayingClass(document.getElementById("deckA_audio"), document.getElementById("leftDeck"));
    wirePlayingClass(document.getElementById("deckB_audio"), document.getElementById("rightDeck"));
  });
})();

