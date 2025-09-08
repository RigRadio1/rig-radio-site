/* Rig-Radio auth helper: single Supabase client, header renderer, and rrRequireAuth() */
(function () {
  var SUPABASE_URL  = 'https://tpzpeoqdpfwqumlsyhpx.supabase.co';
  var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwenBlb3FkcGZ3cXVtbHN5aHB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMDM5NTEsImV4cCI6MjA3MjU3OTk1MX0.nP8W_G_N9GKucj6tlzyvSAOjhiqTBD-F564i0gNhp8E';

  function ensureSupabase(cb) {
    if (window.supabase && window.supabase.createClient) return cb();
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
    s.onload = cb;
    document.head.appendChild(s);
  }

  function getClient() {
    if (!window._sb && window.supabase && window.supabase.createClient) {
      window._sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    }
    return window._sb;
  }

  function safeName(user) {
    var dn = user && user.user_metadata && user.user_metadata.display_name;
    if (dn && ('' + dn).trim()) return ('' + dn).trim();
    return 'Account'; // NEVER show email by default
  }

  async function rrShowAuthQuicklink() {
    var el = document.getElementById('auth-quick');
    if (!el) return;
    var sb = getClient(); if (!sb) return;

    try {
      var { data } = await sb.auth.getUser();
      var user = data && data.user;

      if (!user) { el.innerHTML = '<a href="/login">Sign in</a>'; return; }

      el.innerHTML =
        '<a href="/dashboard" aria-label="Your account">' + safeName(user) + '</a>' +
        '<span class="sep"> | </span>' +
        '<a href="#" id="logout-link">Log out</a>';

      var out = document.getElementById('logout-link');
      if (out) out.addEventListener('click', async function (e) {
        e.preventDefault();
        try { await sb.auth.signOut(); } catch(e){}
        window.location.href = '/login';
      });
    } catch (e) {
      el.innerHTML = '<a href="/login">Sign in</a>';
    }
  }

  // Optional: one-time backfill from localStorage if signup stored pending_display_name
  async function backfillDisplayNameIfPending() {
    var sb = getClient(); if (!sb) return;
    var pending = null;
    try { pending = localStorage.getItem('pending_display_name'); } catch(e){}
    if (!pending) return;

    try {
      var { data } = await sb.auth.getUser();
      var user = data && data.user; if (!user) return;
      var current = user.user_metadata && user.user_metadata.display_name;
      if (current && (''+current).trim()) { localStorage.removeItem('pending_display_name'); return; }
      await sb.auth.updateUser({ data: { display_name: (''+pending).trim() } });
      localStorage.removeItem('pending_display_name');
    } catch (e) { /* ignore */ }
  }

  // Gate for pages that require auth
  async function rrRequireAuth(opts) {
    opts = opts || {};
    var redirect = opts.redirect !== false;       // default true
    var to = opts.to || '/login';

    var sb = getClient(); if (!sb) return null;

    var { data } = await sb.auth.getSession();
    var user = data && data.session && data.session.user;
    if (!user) {
      if (redirect) window.location.href = to;
      return null;
    }

    // try one-time display_name backfill (non-blocking)
    backfillDisplayNameIfPending().then(rrShowAuthQuicklink);

    return user;
  }

  function init() {
    getClient();
    rrShowAuthQuicklink();
    try { window._sb.auth.onAuthStateChange(rrShowAuthQuicklink); } catch(e){}
    setTimeout(rrShowAuthQuicklink, 400);
    setTimeout(rrShowAuthQuicklink, 1200);
  }

  window.addEventListener('load', function () { ensureSupabase(init); });

  // expose helpers for pages
  window.rrShowAuthQuicklink = rrShowAuthQuicklink;
  window.rrRequireAuth = rrRequireAuth;
})();

