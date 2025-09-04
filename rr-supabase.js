// Rig-Radio Supabase config (server-linked)
window.rigSupabase = {
  url: "https://tpzpeoqdpfwqumlsyhpx.supabase.co",
  anon: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwenBlb3FkcGZ3cXVtbHN5aHB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMDM5NTEsImV4cCI6MjA3MjU3OTk1MX0.nP8W_G_N9GKucj6tlzyvSAOjhiqTBD-F564i0gNhp8E"
};

// Create Supabase client (supabase lib is loaded in the HTML page)
window.supabase = window.supabase ?? supabase.createClient(window.rigSupabase.url, window.rigSupabase.anon);

// Simple console test you can run in the browser: rrTest()
window.rrTest = async function(){
  try{
    const { data, error } = await window.supabase.from("profiles").select("*").limit(1);
    if (error) {
      console.error("Supabase connection FAILED:", error);
    } else {
      console.log("Supabase connection OK. profiles sample:", data);
    }
  }catch(e){
    console.error("Unexpected error:", e);
  }
};
