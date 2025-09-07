/* submit-wizard.js — Step 1 drag/drop hardened, PNG/JPG covers only, writes to "tracks" */
(() => {
  const byId = (id) => document.getElementById(id);
  const qa = (sel) => Array.from(document.querySelectorAll(sel));

  // Expect _client from rr-supabase.js or inline on the page
  // Signed-in badge
  try {
    _client?.auth.getUser().then(({ data }) => {
      const el = byId("signed-in-email");
      if (el) el.textContent = `Signed in as ${data?.user?.email || "guest"}`;
    });
  } catch {}

  // Wizard scaffolding
  let step = 1;
  const total = 5;
  const progress = byId("progress");
  function setStep(n){
    step = Math.max(1, Math.min(total, n));
    qa(".stage").forEach(s => s.classList.toggle("active", Number(s.dataset.step) === step));
    qa(".steps li").forEach(li => {
      const s = Number(li.dataset.step);
      li.classList.toggle("active", s === step);
      li.classList.toggle("done", s < step);
    });
    if (progress) progress.style.width = `${(step-1)/(total-1)*100}%`;
    updateSummary();
  }
  qa("[data-back]").forEach(b => b.addEventListener("click", () => setStep(step-1)));

  /* =========================
     STEP 1 — AUDIO DRAG/DROP
     ========================= */
  const drop = byId("audioDrop");
  const fileInput = byId("audioFile");
  const toStep2 = byId("toStep2");
  const audioStatus = byId("audioStatus");

  let audioFile = null;
  let audioRemoteURL = null;
  let audioStoragePath = null;

  const ACCEPT_RE = /\.(mp3|wav|flac)$/i;
  const MAX_BYTES = 20 * 1024 * 1024; // 20MB

  function setStatus(msg){ if (audioStatus) audioStatus.textContent = msg || ""; }
  function setHover(v){ drop && drop.classList.toggle("hover", !!v); }
  function chooseFile(){ fileInput?.click(); }

  // Global: prevent browser from opening dropped file
  ["dragenter","dragover","dragleave","drop"].forEach(ev =>
    window.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); }, { passive:false })
  );

  // Highlight when dragging over the dropzone only
  drop?.addEventListener("dragenter", () => setHover(true));
  drop?.addEventListener("dragover",  () => setHover(true));
  drop?.addEventListener("dragleave", () => setHover(false));
  drop?.addEventListener("drop", (e) => {
    setHover(false);
    const f = e.dataTransfer?.files?.[0];
    handleAudioFile(f);
  });

  // Click / keyboard focus to open file picker
  drop?.addEventListener("click", chooseFile);
  drop?.addEventListener("keypress", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); chooseFile(); }
  });

  fileInput?.addEventListener("change", e => handleAudioFile(e.target.files?.[0]));

  function handleAudioFile(f){
    if(!f) return;
    if (!ACCEPT_RE.test(f.name)) { alert("Only MP3, WAV, or FLAC files are allowed."); setStatus("Wrong file type."); return; }
    if (f.size > MAX_BYTES)      { alert("File is larger than 20 MB."); setStatus("Too large (>20MB)."); return; }
    audioFile = f;
    setStatus(`Selected: ${f.name}`);
    if (toStep2) toStep2.disabled = false;
  }

  // Upload audio on Next → (so we fail fast)
  toStep2?.addEventListener("click", async () => {
    if (!audioFile) return;
    try {
      setStatus("Uploading…");
      const uid = crypto.randomUUID();
      const safeName = audioFile.name.replace(/[^\w.\-]+/g,"_");
      const audioPath = `audio/${uid}-${safeName}`;
      const { error } = await _client.storage.from("tracks").upload(audioPath, audioFile, { upsert:false, cacheControl:"3600" });
      if (error) throw error;
      const { data } = _client.storage.from("tracks").getPublicUrl(audioPath);
      audioRemoteURL = data.publicUrl;
      audioStoragePath = audioPath;
      setStatus("Upload complete.");
      setStep(2);
    } catch (err){
      console.error(err);
      alert("Upload failed: " + (err?.message || err));
      setStatus("Upload failed.");
    }
  });

  /* =========================
     STEP 2 — DETAILS
     ========================= */
  const title  = byId("title");
  const artist = byId("artist");
  const genre  = byId("genre");
  const notes  = byId("notes");
  const notesCount = byId("notesCount");
  const toStep3 = byId("toStep3");

  if (notes && notesCount){
    const updateCount = () => notesCount.textContent = `${notes.value.length}/500`;
    notes.addEventListener("input", updateCount); updateCount();
  }
  function validateDetails(){
    const ok = !!title?.value?.trim() && !!artist?.value?.trim() && !!genre?.value?.trim();
    if (toStep3) toStep3.disabled = !ok;
  }
  [title,artist].forEach(el => el?.addEventListener("input", validateDetails));
  genre?.addEventListener("change", validateDetails);
  toStep3?.addEventListener("click", () => setStep(3));

  /* =========================
     STEP 3 — COVER IMAGE (PNG/JPG only)
     ========================= */
  const coverFile = byId("coverFile");
  const coverPreview = byId("coverPreview");
  const toStep4 = byId("toStep4");

  let coverLocal=null, coverRemoteURL=null, coverStoragePath=null;

  coverFile?.addEventListener("change", e => {
    const f = e.target.files?.[0]; if(!f) return;
    if(!/\.(png|jpg|jpeg)$/i.test(f.name)){ alert("PNG or JPG only."); e.target.value=""; return; }
    if(f.size > 15 * 1024 * 1024){ alert("Image too large (>15MB)."); e.target.value=""; return; }
    coverLocal = f;
    const reader = new FileReader();
    reader.onload = () => { coverPreview && (coverPreview.src = reader.result); };
    reader.readAsDataURL(f);
    if (toStep4) toStep4.disabled = false;
  });

  toStep4?.addEventListener("click", async () => {
    if (coverLocal && !coverRemoteURL){
      try{
        const uid = crypto.randomUUID();
        const ext = (coverLocal.name.split(".").pop() || "jpg").toLowerCase() === "jpeg" ? "jpg" : (coverLocal.name.split(".").pop() || "jpg").toLowerCase();
        const safe = coverLocal.name.replace(/[^\w.\-]+/g,"_").replace(/\.(png|jpg|jpeg)$/i,"");
        const coverPath = `covers/${uid}-${safe}.${ext}`;
        const { error } = await _client.storage.from("tracks").upload(coverPath, coverLocal, { upsert:false, cacheControl:"3600" });
        if (error) throw error;
        const { data } = _client.storage.from("tracks").getPublicUrl(coverPath);
        coverRemoteURL  = data.publicUrl;
        coverStoragePath = coverPath;
      }catch(err){
        console.error(err);
        alert("Cover upload failed: " + (err?.message || err)); return;
      }
    }
    setStep(4);
  });

  /* =========================
     STEP 4 — RIGHTS & RELEASE
     ========================= */
  const agree = byId("agree");
  const toStep5 = byId("toStep5");
  agree?.addEventListener("change", () => { if (toStep5) toStep5.disabled = !agree.checked; });
  toStep5?.addEventListener("click", () => setStep(5));

  /* =========================
     STEP 5 — PUBLISH
     ========================= */
  const publishBtn    = byId("publishBtn");
  const publishStatus = byId("publishStatus");
  const summary       = byId("publishSummary");

  function updateSummary(){
    if (step !== 5 || !summary) return;
    summary.innerHTML = `
      <strong>Review:</strong><br>
      Audio: ${audioFile?.name || "(no file)"}<br>
      Title: ${title?.value || "(untitled)"}<br>
      Artist: ${artist?.value || "(unknown)"}<br>
      Genre: ${genre?.value || "(unset)"}<br>
      Notes: ${(notes?.value || "").substring(0,50)}${(notes?.value||"").length>50?"…":""}<br>
      Cover: ${coverStoragePath ? "uploaded" : "none"}
    `;
  }

  publishBtn?.addEventListener("click", async () => {
    publishBtn.disabled = true;
    if (publishStatus) publishStatus.textContent = "Publishing…";

    let userId = null;
    try { const { data: auth } = await _client.auth.getUser(); userId = auth?.user?.id || null; } catch {}

    const payload = {
      title:       title?.value?.trim()   || null,
      artist:      artist?.value?.trim()  || null,
      genre:       genre?.value?.trim()   || null,
      notes:      (notes?.value || "").trim() || null,
      cover_url:   coverRemoteURL         || null,
      audio_url:   audioRemoteURL         || null,
      track_path:  audioStoragePath       || null,   // private storage key
      cover_path:  coverStoragePath       || null,   // private storage key
      user_id:     userId
    };

    try {
      const { error } = await _client.from("tracks").insert(payload);
      if (error) throw error;
      if (publishStatus) publishStatus.textContent = "Success! Redirecting to Library…";
      setTimeout(() => { window.location.href = "/library"; }, 900);
    } catch (err) {
      console.error(err);
      if (publishStatus) publishStatus.textContent = "Error: " + (err?.message || err);
      publishBtn.disabled = false;
    }
  });

  // Init wizard
  setStep(1);
  // Prime validation for step 2
  (function initValidate(){ title?.dispatchEvent(new Event("input")); artist?.dispatchEvent(new Event("input")); genre?.dispatchEvent(new Event("change")); })();
})();
/* === STEP 1 HOTFIX: drag/drop & picker (no layout changes) === */
(() => {
  const drop      = document.getElementById('audioDrop');
  const fileInput = document.getElementById('audioFile');
  const toStep2   = document.getElementById('toStep2');
  const statusEl  = document.getElementById('audioStatus');

  if (!drop || !fileInput) return; // leave quietly if markup differs

  const ACCEPT_RE = /\.(mp3|wav|flac)$/i;
  const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

  const setHover  = (on) => drop.classList.toggle('hover', !!on);
  const setStatus = (t) => { if (statusEl) statusEl.textContent = t || ''; };

  // 1) Stop the browser from navigating when something is dropped anywhere
  ['dragenter','dragover','dragleave','drop'].forEach(ev => {
    window.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); }, { passive:false });
  });

  // 2) Highlight only when actually over the dropzone
  drop.addEventListener('dragenter', () => setHover(true));
  drop.addEventListener('dragover',  () => setHover(true));
  drop.addEventListener('dragleave', () => setHover(false));
  drop.addEventListener('drop', (e) => {
    setHover(false);
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    handleFile(f);
  });

  // 3) Click / keyboard to open picker
  drop.addEventListener('click',     () => fileInput.click());
  drop.addEventListener('keypress',  (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });

  // 4) Picker -> validate
  fileInput.addEventListener('change', (e) => handleFile(e.target.files && e.target.files[0]));

  function handleFile(f){
    if (!f) return;
    if (!ACCEPT_RE.test(f.name)) { alert('Only MP3, WAV, or FLAC are allowed.'); setStatus('Wrong file type.'); return; }
    if (f.size > MAX_BYTES)      { alert('File is larger than 20 MB.');         setStatus('Too large (>20MB).'); return; }

    // If your upstream wizard stores the file somewhere, expose it
    window.__step1_selected_file = f;

    if (toStep2) toStep2.disabled = false;
    setStatus(`Selected: ${f.name}`);
  }
})();
/* === STEP 1 HOTFIX: drag/drop & picker (behavior only) === */
(() => {
  const drop      = document.getElementById('audioDrop');
  const fileInput = document.getElementById('audioFile');
  const toStep2   = document.getElementById('toStep2');
  const statusEl  = document.getElementById('audioStatus');

  if (!drop || !fileInput) return;

  const ACCEPT_RE = /\.(mp3|wav|flac)$/i;
  const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

  const setHover  = (on) => drop.classList.toggle('hover', !!on);
  const setStatus = (t) => { if (statusEl) statusEl.textContent = t || ''; };

  // Stop browser from navigating anywhere on drop
  ['dragenter','dragover','dragleave','drop'].forEach(ev => {
    window.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); }, { passive:false });
  });

  // Highlight when over the zone
  drop.addEventListener('dragenter', () => setHover(true));
  drop.addEventListener('dragover',  () => setHover(true));
  drop.addEventListener('dragleave', () => setHover(false));
  drop.addEventListener('drop', (e) => {
    setHover(false);
    const f = e.dataTransfer?.files?.[0];
    handleFile(f);
  });

  // Click / keyboard to open picker
  drop.addEventListener('click', () => fileInput.click());
  drop.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });

  // Picker change
  fileInput.addEventListener('change', (e) => handleFile(e.target.files?.[0]));

  function handleFile(f){
    if (!f) return;
    if (!ACCEPT_RE.test(f.name)) { alert('Only MP3, WAV, or FLAC are allowed.'); setStatus('Wrong file type.'); return; }
    if (f.size > MAX_BYTES)      { alert('File is larger than 20 MB.');         setStatus('Too large (>20MB).'); return; }

    // expose for the rest of the wizard if it reads from here
    window.__step1_selected_file = f;

    if (toStep2) toStep2.disabled = false;
    setStatus(`Selected: ${f.name}`);
  }
})();
/* === STEP 1 HOTFIX: drag/drop & picker (behavior only) === */
(() => {
  const drop      = document.getElementById('audioDrop');
  const fileInput = document.getElementById('audioFile');
  const toStep2   = document.getElementById('toStep2');
  const statusEl  = document.getElementById('audioStatus');

  if (!drop || !fileInput) return;

  const ACCEPT_RE = /\.(mp3|wav|flac)$/i;
  const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

  const setHover  = (on) => drop.classList.toggle('hover', !!on);
  const setStatus = (t) => { if (statusEl) statusEl.textContent = t || ''; };

  // Stop browser from navigating anywhere on drop
  ['dragenter','dragover','dragleave','drop'].forEach(ev => {
    window.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); }, { passive:false });
  });

  // Highlight when over the zone
  drop.addEventListener('dragenter', () => setHover(true));
  drop.addEventListener('dragover',  () => setHover(true));
  drop.addEventListener('dragleave', () => setHover(false));
  drop.addEventListener('drop', (e) => {
    setHover(false);
    const f = e.dataTransfer?.files?.[0];
    handleFile(f);
  });

  // Click / keyboard to open picker
  drop.addEventListener('click', () => fileInput.click());
  drop.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });

  // Picker change
  fileInput.addEventListener('change', (e) => handleFile(e.target.files?.[0]));

  function handleFile(f){
    if (!f) return;
    if (!ACCEPT_RE.test(f.name)) { alert('Only MP3, WAV, or FLAC are allowed.'); setStatus('Wrong file type.'); return; }
    if (f.size > MAX_BYTES)      { alert('File is larger than 20 MB.');         setStatus('Too large (>20MB).'); return; }

    // let the rest of your wizard read it if needed
    window.__step1_selected_file = f;

    if (toStep2) toStep2.disabled = false;
    setStatus(`Selected: ${f.name}`);
  }
})();

