(function(){
  const SUPABASE_URL = "https://tpzpeoqdpfwqumlsyhpx.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwenBlb3FkcGZ3cXVtbHN5aHB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMDM5NTEsImV4cCI6MjA3MjU3OTk1MX0.nP8W_G_N9GKucj6tlzyvSAOjhiqTBD-F564i0gNhp8E";
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const $  = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  /* ---------- Tracks (existing) ---------- */
  const TBL = $("#tbl tbody");
  const Q = $("#q"), STATUS = $("#status"), LIMIT = $("#limit");
  const REFRESH = $("#refresh"), SL = $("#statusline");

  function pill(status){
    if(status === "public") return `<span class="pill ok">public</span>`;
    if(status === "draft")  return `<span class="pill draft">draft</span>`;
    return `<span class="pill hide">${status||"—"}</span>`;
  }

  async function loadTracks(){
    SL.textContent = "Loading…";
    TBL.innerHTML = `<tr><td colspan="8">Loading…</td></tr>`;
    const limit = parseInt(LIMIT.value||"50", 10);
    const q = (Q.value||"").trim();
    const st = (STATUS.value||"").trim();

    let query = client.from("tracks")
      .select("id,title,artist,status,plays,likes,created_at", { count: "exact" })
      .order("created_at", { ascending:false })
      .limit(limit);

    if (st) query = query.eq("status", st);
    if (q)  query = query.ilike("title", `%${q}%`);

    const { data, error, count } = await query;
    if (error){
      SL.textContent = `Error: ${error.message}`;
      TBL.innerHTML = `<tr><td colspan="8">Failed to load.</td></tr>`;
      return;
    }
    const rows = data||[];
    SL.textContent = `${rows.length} rows${typeof count==='number' ? ` (count: ${count})` : ""}.`;
    if (!rows.length){ TBL.innerHTML = `<tr><td colspan="8">No rows.</td></tr>`; return; }

    TBL.innerHTML = rows.map(r => `
      <tr>
        <td>${r.id}</td>
        <td title="${(r.title||"").replace(/"/g,'&quot;')}">${r.title||"—"}</td>
        <td title="${(r.artist||"").replace(/"/g,'&quot;')}">${r.artist||"—"}</td>
        <td>${pill(r.status||"")}</td>
        <td>${r.plays ?? 0}</td>
        <td>${r.likes ?? 0}</td>
        <td>${new Date(r.created_at).toLocaleString()}</td>
        <td class="actions"><span class="pill">view-only</span></td>
      </tr>
    `).join("");
  }

  REFRESH?.addEventListener("click", loadTracks);
  Q?.addEventListener("input", () => { clearTimeout(window._t); window._t=setTimeout(loadTracks, 300); });
  STATUS?.addEventListener("change", loadTracks);
  LIMIT?.addEventListener("change", loadTracks);

  /* ---------- Contests ---------- */
  const cTBL = $("#c_tbl tbody");
  const cQ = $("#c_q"), cSTATUS = $("#c_status"), cLIMIT = $("#c_limit");
  const cREFRESH = $("#c_refresh"), cSL = $("#c_statusline");

  async function loadContests(){
    if (!cTBL) return;
    cSL.textContent = "Loading…";
    cTBL.innerHTML = `<tr><td colspan="7">Loading…</td></tr>`;
    const limit = parseInt(cLIMIT?.value||"50", 10);
    const q = (cQ?.value||"").trim();
    const st = (cSTATUS?.value||"").trim();

    let query = client.from("contests")
      .select("id,title,status,start_date,end_date,created_at", { count: "exact" })
      .order("created_at", { ascending:false })
      .limit(limit);

    if (st) query = query.eq("status", st);
    if (q)  query = query.ilike("title", `%${q}%`);

    const { data, error, count } = await query;
    if (error){
      cSL.textContent = (/relation .* does not exist/i.test(error.message))
        ? "Table 'contests' not found (create it in Supabase, see notes below)."
        : `Error: ${error.message}`;
      cTBL.innerHTML = `<tr><td colspan="7">No data.</td></tr>`;
      return;
    }
    const rows = data||[];
    cSL.textContent = `${rows.length} rows${typeof count==='number' ? ` (count: ${count})` : ""}.`;
    if (!rows.length){ cTBL.innerHTML = `<tr><td colspan="7">No contests.</td></tr>`; return; }

    cTBL.innerHTML = rows.map(r => `
      <tr>
        <td>${r.id}</td>
        <td title="${(r.title||"").replace(/"/g,'&quot;')}">${r.title||"—"}</td>
        <td>${r.status||"—"}</td>
        <td>${r.start_date ? new Date(r.start_date).toLocaleString() : "—"}</td>
        <td>${r.end_date ? new Date(r.end_date).toLocaleString() : "—"}</td>
        <td>${new Date(r.created_at).toLocaleString()}</td>
        <td class="actions"><span class="pill">view-only</span></td>
      </tr>
    `).join("");
  }

  cREFRESH?.addEventListener("click", loadContests);
  cQ?.addEventListener("input", () => { clearTimeout(window._ct); window._ct=setTimeout(loadContests, 300); });
  cSTATUS?.addEventListener("change", loadContests);
  cLIMIT?.addEventListener("change", loadContests);

  /* ---------- Events ---------- */
  const eTBL = $("#e_tbl tbody");
  const eQ = $("#e_q"), eSTATUS = $("#e_status"), eLIMIT = $("#e_limit");
  const eREFRESH = $("#e_refresh"), eSL = $("#e_statusline");

  async function loadEvents(){
    if (!eTBL) return;
    eSL.textContent = "Loading…";
    eTBL.innerHTML = `<tr><td colspan="8">Loading…</td></tr>`;
    const limit = parseInt(eLIMIT?.value||"50", 10);
    const q = (eQ?.value||"").trim();
    const st = (eSTATUS?.value||"").trim();

    let query = client.from("events")
      .select("id,title,status,start_time,end_time,location,created_at", { count: "exact" })
      .order("created_at", { ascending:false })
      .limit(limit);

    if (st) query = query.eq("status", st);
    if (q)  query = query.ilike("title", `%${q}%`);

    const { data, error, count } = await query;
    if (error){
      eSL.textContent = (/relation .* does not exist/i.test(error.message))
        ? "Table 'events' not found (create it in Supabase, see notes below)."
        : `Error: ${error.message}`;
      eTBL.innerHTML = `<tr><td colspan="8">No data.</td></tr>`;
      return;
    }
    const rows = data||[];
    eSL.textContent = `${rows.length} rows${typeof count==='number' ? ` (count: ${count})` : ""}.`;
    if (!rows.length){ eTBL.innerHTML = `<tr><td colspan="8">No events.</td></tr>`; return; }

    eTBL.innerHTML = rows.map(r => `
      <tr>
        <td>${r.id}</td>
        <td title="${(r.title||"").replace(/"/g,'&quot;')}">${r.title||"—"}</td>
        <td>${r.status||"—"}</td>
        <td>${r.start_time ? new Date(r.start_time).toLocaleString() : "—"}</td>
        <td>${r.end_time ? new Date(r.end_time).toLocaleString() : "—"}</td>
        <td>${r.location || "—"}</td>
        <td>${new Date(r.created_at).toLocaleString()}</td>
        <td class="actions"><span class="pill">view-only</span></td>
      </tr>
    `).join("");
  }

  eREFRESH?.addEventListener("click", loadEvents);
  eQ?.addEventListener("input", () => { clearTimeout(window._et); window._et=setTimeout(loadEvents, 300); });
  eSTATUS?.addEventListener("change", loadEvents);
  eLIMIT?.addEventListener("change", loadEvents);

/* ---------- Users (profiles table) ---------- */
const USERS_TABLE = "profiles";

const uTBL = $("#u_tbl tbody");
const uQ = $("#u_q"), uROLE = $("#u_role"), uSTATUS = $("#u_status");
const uLIMIT = $("#u_limit"), uREFRESH = $("#u_refresh"), uSL = $("#u_statusline");

// Map to your actual columns
function getId(r){ return r.user_id ?? "—"; }
function getName(r){ return r.display_name ?? "—"; }
function getEmail(r){ return "—"; }          // not stored here (lives in auth.users)
function getRole(r){ return "user"; }        // not in this table; default
function getStatus(r){ return "active"; }    // not in this table; default
function getCreated(r){ return r.updated_at ?? null; } // closest available
function getPlan(r){ return r.plan ?? "—"; }           // extra info we can show

async function loadUsers(){
  if (!uTBL) return;
  uSL.textContent = "Loading…";
  uTBL.innerHTML = `<tr><td colspan="7">Loading…</td></tr>`;

  const limit = parseInt(uLIMIT?.value||"50", 10);
  const qVal = (uQ?.value||"").trim().toLowerCase();

  // No order() to avoid 400s; simple select *
  const { data, error, count } = await client
    .from(USERS_TABLE)
    .select("*", { count: "exact" })
    .limit(limit);

  if (error){
    console.warn("Users load error:", error);
    uSL.textContent = `Error: ${error.message}`;
    uTBL.innerHTML = `<tr><td colspan="7">No data.</td></tr>`;
    return;
  }

  // Filter by search (name only, since email/role/status aren’t in this table)
  let rows = (data||[]).filter(r=>{
    if (!qVal) return true;
    const hay = String(getName(r)).toLowerCase();
    return hay.includes(qVal);
  });

  uSL.textContent = `${rows.length} rows${typeof count==='number' ? ` (count: ${count})` : ""}.`;
  if (!rows.length){
    uTBL.innerHTML = `<tr><td colspan="7">No users.</td></tr>`;
    return;
  }

  // Render: keep existing columns (Email/Role/Status placeholders); add plan into Role column for visibility
  uTBL.innerHTML = rows.map(r => {
    const created = getCreated(r);
    return `
      <tr>
        <td>${getId(r)}</td>
        <td>${getName(r)}</td>
        <td>${getEmail(r)}</td>
        <td>${getRole(r)}${getPlan(r)!=="—" ? ` · ${getPlan(r)}` : ""}</td>
        <td>${getStatus(r)}</td>
        <td>${created ? new Date(created).toLocaleString() : "—"}</td>
        <td class="actions"><span class="pill">view-only</span></td>
      </tr>
    `;
  }).join("");
}

uREFRESH?.addEventListener("click", loadUsers);
uQ?.addEventListener("input", () => { clearTimeout(window._ut); window._ut=setTimeout(loadUsers, 300); });
uROLE?.addEventListener("change", loadUsers);   // placeholders (no-op for now)
uSTATUS?.addEventListener("change", loadUsers); // placeholders (no-op for now)
uLIMIT?.addEventListener("change", loadUsers);

  /* ---------- Tabs ---------- */
  function showTab(name){
    $$(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab===name));
    $$(".panel").forEach(p => p.style.display = p.id === `panel-${name}` ? "" : "none");
    // lazy load per tab
    if (name === "tracks")   loadTracks();
    if (name === "contests") loadContests();
    if (name === "events")   loadEvents();
    if (name === "users")    loadUsers();
  }

  $$("#tabs .tab").forEach(b => b.addEventListener("click", () => showTab(b.dataset.tab)));
  // initial
  showTab("tracks");
})();
