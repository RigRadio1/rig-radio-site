(function(){
  const BOX = document.querySelector(".news-list");
  if (!BOX) return;

  // show loading immediately
  BOX.innerHTML = '<div class="news-item"><div class="tiny">Loading AI music headlines…</div></div>';

  const proxy = u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u);

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
      const nodes = Array.from(doc.querySelectorAll('item,entry'));
      return nodes.map(n => ({
        title: (n.querySelector('title')?.textContent || '').trim(),
        src: (doc.querySelector('channel>title,feed>title')?.textContent || '').trim(),
        date: n.querySelector('pubDate,updated,published')?.textContent || ''
      })).filter(it => okTitle(it.title));
    }catch(e){ return []; }
  }

  function render(items){
    if (!items || items.length === 0){
      BOX.innerHTML = '<div class="news-item"><div class="tiny">No AI music headlines found right now.</div></div>';
      return;
    }
    BOX.innerHTML = items.map(it=>{
      const src = it.src ? ' — ' + it.src : '';
      return '<div class="news-item"><div><strong>' + it.title + '</strong><span class="tiny">' + src + '</span></div></div>';
    }).join('');
  }

  // Fallback content if the network step stalls or fails
  const FALLBACK = [
    { title: 'New AI tools reshape indie production', src: 'Rig-Radio Picks', date: '' },
    { title: 'How creators use stems with AI safely', src: 'Rig-Radio Picks', date: '' },
    { title: 'Prompting tips for better vocal clones', src: 'Rig-Radio Picks', date: '' },
    { title: 'Label deals and AI: what to know', src: 'Rig-Radio Picks', date: '' },
  ];

  // Hard timeout so the UI never looks stuck
  const timer = setTimeout(()=>render(FALLBACK), 3500);

  (async function(){
    try{
      const lists = await Promise.all(FEEDS.map(pull));
      const all = lists.flat();
      const seen = new Set();
      const uniq = [];
      for (const it of all){
        const k = (it.title || '').toLowerCase();
        if (k && !seen.has(k)){ seen.add(k); uniq.push(it); }
      }
      uniq.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
      const pick = uniq.slice(0,4);
      clearTimeout(timer);
      render(pick.length ? pick : FALLBACK);
    }catch(e){
      clearTimeout(timer);
      render(FALLBACK);
    }
  })();
})();
