(function(){
  const BOX = document.getElementById("live-list");
  if (!BOX) return;

  // show loading immediately
  BOX.innerHTML = '<div class="card"><div class="status">Loading AI music headlines…</div></div>';

  const proxy = (u) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u);

  const FEEDS = [
    'https://news.google.com/rss/search?q=%22AI%20music%22&hl=en-US&gl=US&ceid=US:en',
    'https://musictech.com/feed/',
    'https://www.theverge.com/rss/index.xml',
    'https://techcrunch.com/tag/ai/feed/',
    'https://www.billboard.com/feed/'
  ];

  function okTitle(t){
    t = (t || '').toLowerCase();
    const hasAI = /(^|\b)ai(\b|$)|artificial intelligence|generative ai/.test(t);
    const hasMusic = /\bmusic\b|\baudio\b|\bsong\b|\bartist\b/.test(t);
    return hasAI && hasMusic;
  }

  async function pull(url){
    try{
      const r = await fetch(proxy(url), { cache: 'no-store' });
      if (!r.ok) throw new Error('http ' + r.status);
      const xml = await r.text();
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      const src = (doc.querySelector('channel>title,feed>title')?.textContent || '').trim();
      const nodes = Array.from(doc.querySelectorAll('item,entry'));
      return nodes.map(n => ({
        title: (n.querySelector('title')?.textContent || '').trim(),
        link:  (n.querySelector('link')?.textContent || n.querySelector('link')?.getAttribute('href') || '').trim(),
        date:  (n.querySelector('pubDate,updated,published')?.textContent || '').trim(),
        src
      })).filter(it => okTitle(it.title));
    }catch(e){
      console.warn('live-feeds pull error:', e.message);
      return [];
    }
  }

  function render(items){
    if (!items.length){
      BOX.innerHTML = '<div class="card"><div class="status">No AI music headlines right now.</div></div>';
      return;
    }
    const top = items
      .slice(0, 10)                          // cap raw size
      .sort((a,b)=> (b.date||'').localeCompare(a.date||'')) // newest first
      .slice(0, 5);                           // show 5

    BOX.innerHTML = top.map(it => `
      <div class="card" style="display:flex;gap:12px;align-items:flex-start;padding:10px 12px;margin:8px 0;border-radius:12px;">
        <div class="meta" style="display:flex;flex-direction:column;">
          <a href="${it.link || '#'}" target="_blank" rel="noopener" style="font-weight:700;text-decoration:none;">
            ${it.title || 'Untitled'}
          </a>
          <div class="tiny" style="opacity:.7;margin-top:2px;">
            ${it.src ? it.src : 'Source'}${it.date ? ' — ' + it.date : ''}
          </div>
        </div>
      </div>
    `).join('');
  }

  async function boot(){
    try{
      const batches = await Promise.all(FEEDS.map(pull));
      const merged = [].concat(...batches);
      render(merged);
      // light auto-refresh every 2 min for headlines
      setInterval(async ()=>{
        const batches = await Promise.all(FEEDS.map(pull));
        render([].concat(...batches));
      }, 120000);
    }catch(e){
      BOX.innerHTML = '<div class="card"><div class="status">Failed to load headlines.</div></div>';
      console.error('live-feeds boot error:', e.message);
    }
  }

  boot();
})();
// --- vdecor-1 ---
console.log("NEWS-FEEDS: loaded vdecor-1");

// Post-render decorator: add ↗ icon and clean quotes
(function(){
  function decorate(){
    try{
      // add ↗ after anchors (once)
      document.querySelectorAll('#live-feeds .card a').forEach(a=>{
        if (!a.querySelector('span.ext-icon')){
          const s = document.createElement('span');
          s.className = 'ext-icon';
          s.textContent = ' ↗';
          s.style.cssText = 'opacity:.6;font-size:12px;';
          a.appendChild(s);
        }
      });
      // strip double quotes from source/date line
      document.querySelectorAll('#live-feeds .tiny').forEach(el=>{
        el.textContent = (el.textContent || '').replace(/"/g,'');
      });
    }catch(e){ /* no-op */ }
  }
  // run soon and periodically (covers refresh updates)
  setTimeout(decorate, 0);
  setInterval(decorate, 5000);
})();
