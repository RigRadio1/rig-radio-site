(function(){
  const BOX = document.querySelector(".news-list");
  if (!BOX) return;

  // Show fallback immediately so the section never looks broken
  const FALLBACK = [
    { title: 'New AI tools reshape indie production', src: 'Rig-Radio Picks' },
    { title: 'How creators use stems with AI safely', src: 'Rig-Radio Picks' },
    { title: 'Prompting tips for better vocal clones', src: 'Rig-Radio Picks' },
    { title: 'Label deals and AI: what to know', src: 'Rig-Radio Picks' },
  ];
  BOX.innerHTML = FALLBACK.map(i =>
    '<div class="news-item"><div><strong>' + i.title +
    '</strong><span class="tiny"> — ' + i.src + '</span></div></div>'
  ).join('');

  // Try to upgrade to real headlines (non-blocking)
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
    const hasAI = /(\bai\b|artificial intelligence|generative ai)/.test(t);
    const hasMusic = /(music|audio|song|artist)/.test(t);
    return hasAI && hasMusic;
  }
  async function pull(url){
    try{
      const r = await fetch(proxy(url), { cache: 'no-store' });
      if (!r.ok) throw 0;
      const xml = await r.text();
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      return Array.from(doc.querySelectorAll('item,entry')).map(n => ({
        title: (n.querySelector('title')?.textContent || '').trim(),
        src: (doc.querySelector('channel>title,feed>title')?.textContent || '').trim(),
        date: n.querySelector('pubDate,updated,published')?.textContent || ''
      })).filter(i => okTitle(i.title));
    }catch{ return []; }
  }
  (async () => {
    try{
      const lists = await Promise.all(FEEDS.map(pull));
      const all = lists.flat();
      const seen = new Set();
      const uniq = [];
      for (const it of all){
        const k = (it.title || '').toLowerCase();
        if (k && !seen.has(k)){ seen.add(k); uniq.push(it); }
      }
      uniq.sort((a,b)=> new Date(b.date||0) - new Date(a.date||0));
      const pick = uniq.slice(0,4);
      if (pick.length){
        BOX.innerHTML = pick.map(i =>
          '<div class="news-item"><div><strong>' + i.title +
          '</strong><span class="tiny"> — ' + (i.src || '') + '</span></div></div>'
        ).join('');
      }
    }catch{/* keep fallback */}
  })();
})();
