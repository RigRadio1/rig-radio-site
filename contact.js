(function(){
  const $ = sel => document.querySelector(sel);
  const form = $('#contactForm');
  const status = $('#status');
  const copyBtn = $('#copyBtn');

  function setStatus(msg, ok=false){
  status.className = 'status ' + (ok ? 'ok' : 'err');
  status.textContent = msg;
  clearTimeout(window._statusTimer);
  if(ok){
    window._statusTimer = setTimeout(()=>{ status.textContent=''; }, 6000);
  }
}


  function validEmail(v){
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  form?.addEventListener('submit', (e)=>{
    e.preventDefault();
    status.textContent = '';

    // Honeypot trip = spam
    if ($('#website')?.value?.trim()){
      setStatus('Error: invalid submission.', false);
      return;
    }

    const name = $('#name')?.value.trim();
    const email = $('#email')?.value.trim();
    const subject = $('#subject')?.value.trim();
    const message = $('#message')?.value.trim();

    if (!name || !email || !subject || !message){
      setStatus('Please fill out all fields.', false);
      return;
    }
    if (!validEmail(email)){
      setStatus('Please enter a valid email address.', false);
      return;
    }

    const to = 'submissions@rig-radio.ai';
    const sub = encodeURIComponent(`[Contact] ${subject}`);
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}\n\n— Sent from Rig-Radio Contact`
    );

    // Try mailto
    const href = `mailto:${to}?subject=${sub}&body=${body}`;
    window.location.href = href;

    setStatus('Opening your email client… if nothing opens, click “Copy Message” and email us directly.', true);
  });

  copyBtn?.addEventListener('click', async ()=>{
    const name = $('#name')?.value.trim() || '(no name)';
    const email = $('#email')?.value.trim() || '(no email)';
    const subject = $('#subject')?.value.trim() || '(no subject)';
    const message = $('#message')?.value.trim() || '';

    const payload =
`To: submissions@rig-radio.ai
Subject: [Contact] ${subject}

Name: ${name}
Email: ${email}

Message:
${message}

— Sent from Rig-Radio Contact`;

    try{
      await navigator.clipboard.writeText(payload);
      setStatus('Copied. Paste into your email to send.', true);
    }catch{
      setStatus('Could not copy. Manually select and copy your message.', false);
    }
  });
})();
