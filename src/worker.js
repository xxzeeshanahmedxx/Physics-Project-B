/* No cookies, no storage, no autofill: the password is checked by the worker,
   the deck is handed back in memory, and its asset URLs carry a short token. */

/* Retired service worker: removes itself and every cache it ever wrote. */
const RETIRED_SW = `self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch (e) {}
    try {
      await self.registration.unregister();
    } catch (e) {}
    try {
      const clients = await self.clients.matchAll({ type: 'window' });
      await Promise.all(clients.map((client) => client.navigate(client.url).catch(() => {})));
    } catch (e) {}
  })());
});
`;

const NO_STORE = {
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
  'clear-site-data': '"storage"',
};

async function expectedToken(secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('atlas-pass-v1'));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function same(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* Gate: no <form>, no password field, so no password manager can offer to save it. */
function gate(status, error) {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1" name="viewport"/>
<meta content="only light" name="color-scheme"/>
<meta content="noindex, no-referrer" name="robots"/>
<title>Scope of Physics · Private</title>
<link href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%23183632'/%3E%3Cellipse cx='16' cy='16' rx='11' ry='4.6' fill='none' stroke='%23f4f0e5' stroke-width='1.6' transform='rotate(-30 16 16)'/%3E%3Cellipse cx='16' cy='16' rx='11' ry='4.6' fill='none' stroke='%23b35d3d' stroke-width='1.6' transform='rotate(30 16 16)'/%3E%3Ccircle cx='16' cy='16' r='2.4' fill='%23f4f0e5'/%3E%3C/svg%3E" rel="icon" type="image/svg+xml"/>
<style>
html,body{margin:0;min-height:100%;background:#dbd9d0;color:#183632;font-family:Arial,Helvetica,sans-serif}
body{display:grid;place-items:center;padding:6vw}
main{width:min(100%,26rem);border-top:1px solid #9ba89b;padding-top:1.5rem}
.badge{display:flex;align-items:center;gap:.7rem;margin:0 0 1.1rem;font:600 .72rem/1 monospace;letter-spacing:.14em;text-transform:uppercase;color:#41574f}
.badge:before{content:"";width:2rem;border-top:2px solid #b35d3d}
h1{margin:0 0 .6rem;font:normal clamp(2rem,6.5vw,2.9rem)/.98 Georgia,"Times New Roman",serif;letter-spacing:-.045em}
p{margin:0 0 1.5rem;font:italic 1rem/1.5 Georgia,"Times New Roman",serif;color:#41574f}
.row{display:flex;gap:.5rem}
input{flex:1;min-width:0;padding:.85rem 1rem;border:1px solid #9ba89b;border-radius:99px;background:#f4f0e5;color:#183632;font:400 .95rem/1 Arial,Helvetica,sans-serif;-webkit-text-security:disc;letter-spacing:.1em}
input:focus{outline:2px solid #b35d3d;outline-offset:2px}
button{padding:.85rem 1.3rem;border:0;border-radius:99px;background:#183632;color:#f4f0e5;font:600 .78rem/1 monospace;letter-spacing:.14em;text-transform:uppercase;cursor:pointer}
button:hover{background:#b35d3d}
.err{margin:1rem 0 0;padding:.7rem .9rem;border-left:2px solid #b35d3d;background:#f4f0e5;font:400 .85rem/1.4 Arial,Helvetica,sans-serif;color:#8c3d24}
.note{margin:1.4rem 0 0;font:400 .72rem/1.5 monospace;letter-spacing:.08em;text-transform:uppercase;color:#7b8a86}
</style></head>
<body><main>
<div class="badge">Private presentation</div>
<h1>Scope of physics</h1>
<p>This deck is locked. Enter the password to open it.</p>
<div class="row">
<input aria-label="Password" autocomplete="off" autocapitalize="off" autocorrect="off" data-1p-ignore data-lpignore="true" id="p" name="presentation-code" spellcheck="false" type="text"/>
<button id="go" type="button">Open</button>
</div>
${error ? '<p class="err">' + error + '</p>' : ''}
<p class="note">Matter · Energy · Space · Time</p>
</main>
<script>
(function () {
  var input = document.getElementById('p');
  var button = document.getElementById('go');
  var busy = false;
  input.focus();
  function fail(message) {
    var p = document.createElement('p');
    p.className = 'err';
    p.textContent = message;
    var old = document.querySelector('.err');
    if (old) old.replaceWith(p); else document.querySelector('.note').before(p);
    input.select();
  }
  function open() {
    if (busy) return;
    busy = true;
    fetch('/__unlock', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: input.value }),
    })
      .then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok) throw new Error(body.error || 'Wrong password.');
          return body;
        });
      })
      .then(function (body) {
        document.open();
        document.write(body.html);
        document.close();
      })
      .catch(function (error) {
        busy = false;
        fail(error.message || 'Could not open the deck. Try again.');
      });
  }
  button.addEventListener('click', open);
  input.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      open();
    }
  });
})();
</script>
</body></html>`;
  return new Response(html, {
    status,
    headers: { ...NO_STORE, 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' },
  });
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...NO_STORE, 'content-type': 'application/json; charset=utf-8' },
  });
}

/* Give the deck's own asset URLs the token it was unlocked with. */
function authorize(html, t) {
  return html
    .replace(/((?:src|content)="\.\/img\/[^"?]+)(")/g, '$1?k=' + t + '$2')
    .replace("'./audio/'+A[i]", "'./audio/'+A[i]+'?k=" + t + "'")
    .replace('<head>', '<head><meta content="no-referrer" name="referrer"/>');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.protocol === 'http:') {
      return Response.redirect('https://' + url.host + url.pathname + url.search, 301);
    }

    /* Must stay reachable while locked so installed workers can delete themselves. */
    if (url.pathname === '/sw.js') {
      return new Response(RETIRED_SW, {
        headers: {
          ...NO_STORE,
          'content-type': 'text/javascript; charset=utf-8',
          'service-worker-allowed': '/',
        },
      });
    }

    if (!env.PASSWORD || !env.SESSION_SECRET) {
      return new Response('Gate is not configured yet.', { status: 500, headers: NO_STORE });
    }

    if (url.pathname === '/__unlock') {
      if (request.method !== 'POST') {
        return new Response(null, { status: 405, headers: { ...NO_STORE, allow: 'POST' } });
      }
      let given = '';
      try {
        given = String((await request.json()).password || '');
      } catch (error) {
        given = '';
      }
      if (!same(given, env.PASSWORD)) return json({ error: 'Wrong password.' }, 401);

      const asset = new URL('/index.html', url);
      const page = await env.ASSETS.fetch(new Request(asset.toString(), { headers: request.headers }));
      if (!page.ok) return json({ error: 'The deck is unavailable.' }, 503);

      const t = await expectedToken(env.SESSION_SECRET);
      return json({ html: authorize(await page.text(), t) }, 200);
    }

    const t = await expectedToken(env.SESSION_SECRET);
    if (url.pathname === '/' || url.pathname === '/index.html') return gate(401);

    /* Assets: only with the token handed out by /__unlock. */
    if (!same(url.searchParams.get('k') || '', t)) {
      return new Response('Not found', { status: 404, headers: NO_STORE });
    }

    const clean = new URL(url.toString());
    clean.searchParams.delete('k');
    return env.ASSETS.fetch(new Request(clean.toString(), request));
  },
};
