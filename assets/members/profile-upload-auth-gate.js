(function () {
  const redirectToLogin = () => {
    window.location.replace('/login.html?redirect=%2Fmembers%2F');
  };

  const verifyProfileSession = async () => {
    const client = window.supabaseClient;
    if (!client?.auth) return null;

    try {
      let { data: sessionData } = await client.auth.getSession();
      let session = sessionData?.session || null;

      if (!session) return null;

      if (session.expires_at && session.expires_at * 1000 <= Date.now() + 60000) {
        const { data: refreshData, error: refreshError } = await client.auth.refreshSession();
        if (refreshError) return null;
        session = refreshData?.session || null;
        if (!session) return null;
      }

      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError || !userData?.user) return null;

      if (!session.user?.id || session.user.id !== userData.user.id) return null;
      return userData.user;
    } catch (err) {
      console.error('PROFILE UPLOAD AUTH CHECK ERROR:', err);
      return null;
    }
  };

  document.addEventListener('click', async (event) => {
    const saveBtn = event.target.closest('#saveEditProfile');
    if (!saveBtn) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Checking session...';

    const user = await verifyProfileSession();
    if (!user) {
      saveBtn.textContent = 'Session expired';
      setTimeout(redirectToLogin, 150);
      return;
    }

    saveBtn.disabled = false;
    saveBtn.textContent = originalText || 'Save';

    if (typeof window.saveProfile === 'function') {
      await window.saveProfile();
      return;
    }

    console.error('PROFILE SAVE HANDLER NOT AVAILABLE');
    alert('Profile save is not available. Please refresh and try again.');
  }, true);
})();
