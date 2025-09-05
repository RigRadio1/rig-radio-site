/* Rig-Radio Supabase config */
window.rigSupabase = {
  url: "https://tpzpeoqdpfwqumlsyhpx.supabase.co",
  anon: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwenBlb3FkcGZ3cXVtbHN5aHB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMDM5NTEsImV4cCI6MjA3MjU3OTk1MX0.nP8W_G_N9GKucj6tlzyvSAOjhiqTBD-F564i0gNhp8E"
};
try {
  window.supabase = supabase.createClient(window.rigSupabase.url, window.rigSupabase.anon);
} catch (e) {
  console.error("Supabase init failed:", e);
}
/* Console helper: run rrTest() */
window.rrTest = async function(){
  try{
    if(!window.supabase) throw new Error("supabase missing");
    const { data, error } = await window.supabase.from("Profiles").select("*").limit(1);

    if (error) { console.error("FAILED:", error); return { ok:false, error }; }
    console.log("OK:", data); return { ok:true, data };
  }catch(e){ console.error("Unexpected:", e); return { ok:false, error:e }; }
};
