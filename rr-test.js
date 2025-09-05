// Returns a Promise; resolves { ok: boolean, user?: object, error?: string }
window.rrTest = async function rrTest() {
  try {
    if (!window.supabase) return { ok:false, error:'supabase SDK not loaded' };
    // Lightweight connectivity check: can we call auth.getUser?
    const { data, error } = await supabase.auth.getUser();
    if (error) return { ok:false, error:error.message || 'auth.getUser error' };
    return { ok:true, user:(data && data.user) || null };
  } catch (e) {
    return { ok:false, error: (e && e.message) ? e.message : String(e) };
  }
};
