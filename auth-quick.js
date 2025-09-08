(function () {
  // Load the UMD bundle if Supabase isn't present
  function loadSupabase(cb) {
    if (window.supabase && window.supabase.createClient) return cb();
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
    s.onload = cb;
    document.head.appendChild(s);
  }

  function render() {
    var el = document.getElementById('auth-quick');
    if (!el) return;

    var SUPABASE_URL  = 'https://tpzpeoqdpfwqumlsyhpx.supabase.co';
    var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwenBlb3FkcGZ3cXVtbHN5aHB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMDM5NTEsImV4cCI6MjA3MjU3OTk1MX0.nP8W_G_N9GKucj6tlzyvSAOjhiqTBD-F564i0gNhp8E';

    var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

    function safeName(user) {
      var dn = user && user.user_metadata && user.user_metadata.display_name;
      if (dn && String(dn).trim()) return String(dn).trim();
      return 'Account'; // never show email
    }

    sb.auth.getUser().then(function (res) {
      var user = res && res.data && res.data.user;
      if (!user) {
        el.innerHTML = '<a href="/login">Sign in</a>';
        return;
      }
      var name = safeName(user);
      el.innerHTML =
        '<a href="/dashboard" aria-label="Your account">' + name + '</a>' +
        '<span class="sep"> | </span>' +
        '<a href="#" id="logout-link">Log out</a>';

      var out = document.getElementById('logout-link');
      if (out) out.addEventListener('click', function (e) {
        e.preventDefault();
        sb.auth.signOut().then(function () { window.location.href = '/login'; });
      });
    });
  }

  // Run after full page load so we draw last
  window.addEventListener('load', function () {
    loadSupabase(render);
  });
})();

