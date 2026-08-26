(async function () {
  try {
    const params = new URLSearchParams(window.location.search);
    const hasPublicTarget = Boolean((params.get("handle") || "").trim() || (params.get("id") || "").trim());

    if (hasPublicTarget) {
      document.documentElement.style.visibility = "";
      return;
    }

    if (!window.supabaseClient?.auth) {
      window.location.replace("/login.html?redirect=%2Fmembers%2F");
      return;
    }

    const { data, error } = await window.supabaseClient.auth.getUser();
    const user = data?.user || null;

    if (error || !user) {
      window.location.replace("/login.html?redirect=%2Fmembers%2F");
      return;
    }

    document.documentElement.style.visibility = "";
  } catch (err) {
    console.error("PROFILE AUTH GUARD ERROR:", err);
    window.location.replace("/login.html?redirect=%2Fmembers%2F");
  }
})();
