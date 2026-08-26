const http = require('http');

const PORT = Number(process.env.PORT || 8788);
const SUPABASE_URL = 'https://tpzpeoqdpfwqumlsyhpx.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwenBlb3FkcGZ3cXVtbHN5aHB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMDM5NTEsImV4cCI6MjA3MjU3OTk1MX0.nP8W_G_N9GKucj6tlzyvSAOjhiqTBD-F564i0gNhp8E';
const SITE_ORIGIN = 'https://www.rig-radio.ai';

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const publicTrackUrl = (path) => {
  if (!path) return '';
  const raw = String(path).trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${SUPABASE_URL}/storage/v1/object/public/tracks/${raw.replace(/^tracks\//, '').replace(/^\/+/, '')}`;
};

const isMp4 = (url = '') => String(url).split('?')[0].toLowerCase().endsWith('.mp4');

async function getTrack(id) {
  const url = `${SUPABASE_URL}/rest/v1/tracks?id=eq.${encodeURIComponent(id)}&select=id,title,artist,artist_name,cover_path,cover_url,artwork_url,audio_url,track_path,genre&limit=1`;
  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      Accept: 'application/json'
    }
  });

  if (!response.ok) throw new Error(`Supabase ${response.status}`);
  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] : null;
}

function renderPage(track) {
  const id = track.id;
  const title = track.title || 'Rig-Radio Song';
  const artist = track.artist || track.artist_name || 'Rig-Radio Artist';
  const shareTitle = `${title} — ${artist}`;
  const description = 'Listen on Rig-Radio 2.0.';
  const shareUrl = `${SITE_ORIGIN}/song/${encodeURIComponent(id)}`;
  const liveUrl = `${SITE_ORIGIN}/song.html?id=${encodeURIComponent(id)}`;

  const coverPathUrl = publicTrackUrl(track.cover_path);
  const fallbackCover = publicTrackUrl(track.cover_url || track.artwork_url);
  const videoUrl = isMp4(coverPathUrl) ? coverPathUrl : '';
  const imageUrl = videoUrl ? fallbackCover : (coverPathUrl || fallbackCover || `${SITE_ORIGIN}/banner.png`);
  const audioUrl = publicTrackUrl(track.audio_url || track.track_path);

  const tags = [
    `<meta property="og:type" content="music.song">`,
    `<meta property="og:site_name" content="Rig-Radio 2.0">`,
    `<meta property="og:title" content="${escapeHtml(shareTitle)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(shareUrl)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(shareTitle)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`
  ];

  if (imageUrl) {
    tags.push(`<meta property="og:image" content="${escapeHtml(imageUrl)}">`);
    tags.push(`<meta name="twitter:image" content="${escapeHtml(imageUrl)}">`);
  }

  if (videoUrl) {
    tags.push(`<meta property="og:video" content="${escapeHtml(videoUrl)}">`);
    tags.push(`<meta property="og:video:secure_url" content="${escapeHtml(videoUrl)}">`);
    tags.push(`<meta property="og:video:type" content="video/mp4">`);
  }

  if (audioUrl) {
    tags.push(`<meta property="og:audio" content="${escapeHtml(audioUrl)}">`);
    tags.push(`<meta property="og:audio:secure_url" content="${escapeHtml(audioUrl)}">`);
    tags.push(`<meta property="og:audio:type" content="audio/mpeg">`);
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(shareTitle)} | Rig-Radio 2.0</title>
<meta name="description" content="${escapeHtml(description)}">
${tags.join('\n')}
<meta http-equiv="refresh" content="0;url=${escapeHtml(liveUrl)}">
<script>window.location.replace(${JSON.stringify(liveUrl)});</script>
</head>
<body style="background:#050505;color:#fff;font-family:Arial,sans-serif;padding:40px">
<p>Opening ${escapeHtml(shareTitle)} on Rig-Radio 2.0...</p>
<p><a style="color:#ff6a2a" href="${escapeHtml(liveUrl)}">Open song</a></p>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const match = url.pathname.match(/^\/song\/([0-9a-f-]{36})\/?$/i);

    if (!match) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const track = await getTrack(match[1]);
    if (!track) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Song not found');
      return;
    }

    const html = renderPage(track);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60'
    });
    res.end(html);
  } catch (error) {
    console.error('SONG SHARE SERVER ERROR:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Could not load song share page');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Rig-Radio song share server listening on 127.0.0.1:${PORT}`);
});
