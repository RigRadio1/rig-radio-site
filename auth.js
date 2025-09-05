// ---------- Tiny utils ----------
function rrQS(sel) { return document.querySelector(sel); }
function rrText(el, html) { if (el) el.innerHTML = html; }

// ---------- Auth quicklink (top-right) ----------
async function rrShowAuthQuicklink() {
  const target = rrQS('#auth-quick');
  if (!target) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const label = user.email || 'Account';
    rrText(target, `
      <span style="opacity:.8;margin-right:.5rem;">${label}</span>
      <a href="#" id="rr-signout">Sign out</a>
    `);
    const signout = rrQS('#rr-signout');
    if (signout) {
      signout.addEventListener('click', async (e) => {
        e.preventDefault();
        await supabase.auth.signOut();
        window.location.replace('/login.html');
      });
    }
  } else {
    rrText(target, `<a href="/login.html">Sign in</a> &nbsp;|&nbsp; <a href="/signup.html">Create account</a>`);
  }
}

// Keep quicklink in sync as auth state changes
if (window.supabase) {
  supabase.auth.onAuthStateChange((_event, _session) => {
    rrShowAuthQuicklink();
  });
}

// ---------- Signup handler ----------
function rrBindSignupForm(formId = 'signup-form', next = '/dashboard.html') {
  const form = rrQS(`#${formId}`);
  const msg = rrQS('#signup-msg');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    rrText(msg, 'Creating your account...');

    const email = form.email.value.trim();
    const password = form.password.value;

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      rrText(msg, `<span style="color:#c0392b;">${error.message}</span>`);
      return;
    }

    const hasSession = !!data.session;
    if (!hasSession) {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) {
        rrText(msg, `<span style="color:#c0392b;">${signInErr.message}</span>`);
        return;
      }
    }

    rrText(msg, 'Success! Redirecting...');
    window.location.assign(next);
  });
}

// ---------- Login handler ----------
function rrBindLoginForm(formId = 'login-form', next = '/dashboard.html') {
  const form = rrQS(`#${formId}`);
  const msg = rrQS('#login-msg');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    rrText(msg, 'Signing you in...');

    const email = form.email.value.trim();
    const password = form.password.value;

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      rrText(msg, `<span style="color:#c0392b;">${error.message}</span>`);
      return;
    }

    rrText(msg, 'Success! Redirecting...');
    window.location.assign(next);
  });
}

// ---------- Redirect if already authed ----------
async function rrRedirectIfAuthed(next = '/dashboard.html') {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) window.location.replace(next);
}

// ---------- Export ----------
window.rrShowAuthQuicklink = rrShowAuthQuicklink;
window.rrBindSignupForm = rrBindSignupForm;
window.rrBindLoginForm = rrBindLoginForm;
window.rrRedirectIfAuthed = rrRedirectIfAuthed;
window.rrTest = window.rrTest || function(){};

// ---------- Require auth on protected pages ----------
async function rrRequireAuth(redirectTo = '/login.html') {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) window.location.replace(redirectTo);
}
window.rrRequireAuth = rrRequireAuth;

// ---------- rrRequireAuth (robust) ----------
window.rrRequireAuth = async function rrRequireAuth(redirectTo = '/login.html') {
  const hasUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return !!(session && session.user);
    } catch (_) { return false; }
  };

  // Fast path
  if (await hasUser()) return;

  // Wait briefly for session to hydrate (race-safe)
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 100)); // 1s total
    if (await hasUser()) return;
  }

  // Still no user → go to login
  window.location.replace(redirectTo);
};

// ---------- Robust auth gate (waits for session) ----------
window.rrRequireAuth = async function rrRequireAuth(redirectTo = '/login.html') {
  const box = document.getElementById('sb-status');
  const note = (m) => { if (box) box.textContent = 'AUTH: ' + m; try { console.log('[auth]', m); } catch(_){} };

  // quick check
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session && session.user) { note('session OK'); return; }
  } catch(_) { /* ignore */ }

  note('no session yet; waiting briefly…');

  // wait up to ~2s for hydration or auth event
  let got = false;
  const unsub = supabase.auth.onAuthStateChange((_e, sess) => {
    if (sess && sess.user) { got = true; note('session became OK'); }
  });

  // poll a few times in parallel with the event
  for (let i = 0; i < 10 && !got; i++) {
    await new Promise(r => setTimeout(r, 200)); // 2s total
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && session.user) { got = true; note('session OK after wait'); break; }
    } catch(_) { /* ignore */ }
  }

  try { unsub?.data?.subscription?.unsubscribe?.(); } catch(_) {}

  if (got) return;

  note('still no session → redirecting to login');
  window.location.replace(redirectTo);
};
