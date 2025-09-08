/* submit-wizard.js
   Requires rr-supabase.js to export `supabase` client (anon key / URL already set).
*/
(() => {
  const byId = (id) => document.getElementById(id);
  const q = (sel) => document.querySelector(sel);
  const qa = (sel) => Array.from(document.querySelectorAll(sel));

  // Signed-in email indicator
  supabase.auth.getUser().then(({ data }) => {
    const email = data?.user?.email || "guest";
    const el = byId("signed-in-email");
    if (el) el.textContent = `Signed in as ${email}`;
  });

  // Step logic
  let step = 1;
  const total = 5;
  const progress = byId("progress");

  function setStep(n) {
    step = n;
    qa(".stage").forEach(s => s.classList.toggle("active", Number(s.dataset.step) === step));
    qa(".steps li").forEach(li => {
      const s = Number(li.dataset.step);
      li.classList.toggle("active", s === step);
      li.classList.toggle("done", s < step);
    });
    progress.style.width = `${(step - 1) / (total - 1) * 100}%`;
    updateSummary();
  }

  // Back buttons
  qa("[data-back]").forEach(btn => btn.addEventListener("click", () => setStep(step - 1)));

  // -------- Step 1: Audio upload selection --------
  const drop = byId("audioDrop");
  const fileInput = byId("audioFile");
  const toStep2 = byId("toStep2");
  let audioFile = null;
  let audioRemoteURL = null;

  function chooseFile() { fileInput.click(); }
  function setHover(v){ drop.classList.toggle("hover", v); }

  ["dragenter","dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); setHover(true); }));
  ["dragleave","drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); setHover(false); }));
  drop.addEventListener("drop", (e) => {
    const f = e.dataTransfer.files?.[0];
    handleAudioFile(f);
  });
  drop.addEventListener("click", chooseFile);
  fileInput.addEventListener("change", (e) => handleAudioFile(e.target.files?.[0]));

  function handleAudioFile(f){
    if(!f) return;
    const ok = /\.(mp3|wav|flac)$/i.test(f.name);
    if(!ok){ alert("Please select MP3, WAV, or FLAC."); return; }
    if(f.size > 100 * 1024 * 1024){ alert("Demo limit 100MB."); return; }
    audioFile = f;
    toStep2.disabled = false;
    drop.querySelector("strong").textContent = `Selected: ${f.name}`;
  }

  toStep2.addEventListener("click", async () => {
    // lazy upload on step advance to get URL early
    if(audioFile && !audioRemoteURL){
      const uid = crypto.randomUUID();
      const path = `audio/${uid}-${audioFile.name}`;
      const { error } = await supabase.storage.from("tracks").upload(path, audioFile, { upsert: false, cacheControl: "3600" });
      if(error){ alert("Upload failed: " + error.message); return; }
      const { data } = supabase.storage.from("tracks").getPublicUrl(path);
      audioRemoteURL = data.publicUrl;
    }
    setStep(2);
  });

  // -------- Step 2: Details --------
  const title = byId("title");
  const artist = byId("artist");
  const genre = byId("genre");
  const notes = byId("notes");
  const toStep3 = byId("toStep3");

  function validateDetails(){
    toStep3.disabled = !(title.value.trim() && artist.value.trim());
  }
  [title, artist].forEach(i => i.addEventListener("input", validateDetails));
  toStep3.addEventListener("click", () => setStep(3));

  // -------- Step 3: Cover --------
  const coverFile = byId("coverFile");
  const coverPreview = byId("coverPreview");
  let coverLocal = null, coverRemoteURL = null;

  coverFile.addEventListener("change", e => {
    const f = e.target.files?.[0];
    if(!f) return;
    if(!/\.(jpg|jpeg|png)$/i.test(f.name)){ alert("Please select JPG/PNG."); return; }
    coverLocal = f;
    const reader = new FileReader();
    reader.onload = () => coverPreview.src = reader.result;
    reader.readAsDataURL(f);
  });

  const toStep4 = byId("toStep4");
  toStep4.addEventListener("click", async () => {
    if(coverLocal && !coverRemoteURL){
      const uid = crypto.randomUUID();
      const ext = coverLocal.name.split(".").pop();
      const path = `covers/${uid}.${ext}`;
      const { error } = await supabase.storage.from("tracks").upload(path, coverLocal, { upsert: false, cacheControl: "3600" });
      if(error){ alert("Cover upload failed: " + error.message); return; }
      const { data } = supabase.storage.from("tracks").getPublicUrl(path);
      coverRemoteURL = data.publicUrl;
    }
    setStep(4);
  });

  // -------- Step 4: Rights --------
  const agree = byId("agree");
  const toStep5 = byId("toStep5");
  agree.addEventListener("change", () => { toStep5.disabled = !agree.checked; });
  toStep5.addEventListener("click", () => setStep(5));

  // -------- Step 5: Publish --------
  const publishBtn = byId("publishBtn");
  const publishStatus = byId("publishStatus");
  const summary = byId("publishSummary");

  function updateSummary(){
    if(step !== 5) return;
    const name = audioFile?.name || "(no file)";
    const t = title.value || "(untitled)";
    const a = artist.value || "(unknown)";
    const g = genre.value || "(unset)";
    summary.innerHTML = `
      <strong>Review:</strong><br>
      Audio: ${name}<br>
      Title: ${t}<br>
      Artist: ${a}<br>
      Genre: ${g}<br>
      License: ${byId("license").value}<br>
      Cover: ${coverRemoteURL ? "uploaded" : "none"}
    `;
  }

  publishBtn.addEventListener("click", async () => {
    publishBtn.disabled = true;
    publishStatus.textContent = "Publishing…";

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id || null;

    // Insert DB row
    const payload = {
      title: title.value.trim(),
      artist: artist.value.trim(),
      genre: genre.value.trim(),
      notes: notes.value.trim(),
      cover_url: coverRemoteURL || null,
      audio_url: audioRemoteURL,
      user_id: userId
    };

    const { error } = await supabase.from("songs").insert(payload);
    if(error){
      publishStatus.textContent = "Error: " + error.message;
      publishBtn.disabled = false;
      return;
    }
    publishStatus.textContent = "Success! Redirecting to Library…";
    setTimeout(() => { window.location.href = "/library"; }, 900);
  });

  // init
  setStep(1);
})();

