const SUPABASE_URL = 'https://tpzpeoqdpfwqumlsyhpx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwenBlb3FkcGZ3cXVtbHN5aHB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMDM5NTEsImV4cCI6MjA3MjU3OTk1MX0.nP8W_G_N9GKucj6tlzyvSAOjhiqTBD-F564i0gNhp8E';

// Create the client
const _client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Expose both names so old/new code works
window.supabase = _client;
window.rigSupabase = _client;
