(async function () {
  const loginUrl = "/login.html?redirect=%2Fmembers%2F";
  const params = new URLSearchParams(window.location.search);
  const hasPublicTarget = Boolean((params.get("handle") || "").trim() || (params.get("id") || "").trim());

  const style = document.createElement("style");
  style.id = "rr-profile-auth-lock";
  style.textContent = `
    html:not(.rr-profile-authenticated):not(.rr-profile-public) #openEditProfile,
    html:not(.rr-profile-authenticated):not(.rr-profile-public) #copyPublicProfile,
    html:not(.rr-profile-authenticated):not(.rr-profile-public) #createPlaylistBtn,
    html:not(.rr-profile-authenticated):not(.rr-profile-public) #changeFeaturedBtn,
    html:not(.rr-profile-authenticated):not(.rr-profile-public) #memberLogoutBtn,
    html:not(.rr-profile-authenticated):not(.rr-profile-public) #bannerUploadButton,
    html:not(.rr-profile-authenticated):not(.rr-profile-public) #avatarUploadButton {
      display: none !important;
    }
  `;
  document.head.appendChild(style);

  const sendToLogin = () => {
    document.documentElement.classList.remove("rr-profile-authenticated");
    window.location.replace(loginUrl);
  };

  const loadProfileTools = () => {
    if (!document.querySelector('link[data-rr-profile-mobile="1"]')) {
      const mobileCss = document.createElement("link");
      mobileCss.rel = "stylesheet";
      mobileCss.href = "/assets/members/profile-mobile.css?v=PROFILE-MOBILE-1";
      mobileCss.dataset.rrProfileMobile = "1";
      document.head.appendChild(mobileCss);
    }

    if (!document.querySelector('script[data-rr-profile-upload-auth="1"]')) {
      const authScript = document.createElement("script");
      authScript.src = "/assets/members/profile-upload-auth-gate.js?v=PROFILE-UPLOAD-AUTH-1";
      authScript.dataset.rrProfileUploadAuth = "1";
      authScript.defer = true;
      document.head.appendChild(authScript);
    }

    if (!document.querySelector('script[data-rr-profile-cropper="1"]')) {
      const cropScript = document.createElement("script");
      cropScript.src = "/assets/members/profile-image-cropper.js?v=PROFILE-CROP-2";
      cropScript.dataset.rrProfileCropper = "1";
      cropScript.defer = true;
      document.head.appendChild(cropScript);
    }
  };

  try {
    if (hasPublicTarget) {
      document.documentElement.classList.add("rr-profile-public");
      document.documentElement.style.visibility = "";
      return;
    }

    const auth = window.supabaseClient?.auth;
    if (!auth) {
      sendToLogin();
      return;
    }

    auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        sendToLogin();
      }
    });

    const [{ data: sessionData, error: sessionError }, { data: userData, error: userError }] = await Promise.all([
      auth.getSession(),
      auth.getUser()
    ]);

    const sessionUser = sessionData?.session?.user || null;
    const verifiedUser = userData?.user || null;

    if (
      sessionError ||
      userError ||
      !sessionUser ||
      !verifiedUser ||
      sessionUser.id !== verifiedUser.id
    ) {
      sendToLogin();
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 350));
    const { data: finalUserData, error: finalUserError } = await auth.getUser();
    const finalUser = finalUserData?.user || null;

    if (finalUserError || !finalUser || finalUser.id !== verifiedUser.id) {
      sendToLogin();
      return;
    }

    window.__RR_PROFILE_AUTH_USER_ID = finalUser.id;
    loadProfileTools();
    document.documentElement.classList.add("rr-profile-authenticated");
    document.documentElement.style.visibility = "";
  } catch (err) {
    console.error("PROFILE AUTH GUARD ERROR:", err);
    sendToLogin();
  }
})();
