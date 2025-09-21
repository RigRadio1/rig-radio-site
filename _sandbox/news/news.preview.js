console.log("NEWS: js loaded");

// --- Supabase init (sandbox only) ---
const SUPABASE_URL = "https://tpzpeoqdpfwqumlsyhpx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwenBlb3FkcGZ3cXVtbHN5aHB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMDM5NTEsImV4cCI6MjA3MjU3OTk1MX0.nP8W_G_N9GKucj6tlzyvSAOjhiqTBD-F564i0gNhp8E";

if (!window.supabase) {
  console.error("Supabase SDK missing");
} else {
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  (async () => {
    try {
      console.log("NEWS: querying latest public tracks…");
      const { data, error } = await sb
        .from('tracks')
        .select('id,title,artist,created_at')
        .eq('status','public')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error("NEWS: query error:", error.message);
      } else {
        console.log("NEWS: got rows:", data?.length ?? 0, data);
      }
    } catch (e) {
      console.error("NEWS: exception:", e.message);
    }
  })();
}
