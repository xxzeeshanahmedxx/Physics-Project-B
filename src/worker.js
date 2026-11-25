const COOKIE = 'atlas_pass';
const MAX_AGE = 60 * 60 * 24 * 30;

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

function token(cookieHeader) {
  const m = (cookieHeader || '').match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)'));
  return m ? m[1] : '';
}

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

function gate(status, error) {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1" name="viewport"/>
<meta content="only light" name="color-scheme"/>
<meta content="noindex" name="robots"/>
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
form{display:flex;gap:.5rem}
input{flex:1;min-width:0;padding:.85rem 1rem;border:1px solid #9ba89b;border-radius:99px;background:#f4f0e5;color:#183632;font:400 .95rem/1 Arial,Helvetica,sans-serif}
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
<form action="/__unlock" method="post">
<input aria-label="Password" autocomplete="current-password" autofocus id="password" name="password" placeholder="Password" required type="password"/>
<button type="submit">Open</button>
</form>
${error ? '<p class="err">' + error + '</p>' : ''}
<p class="note">Matter · Energy · Space · Time</p>
</main></body></html>`;
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
      'clear-site-data': '"storage"',
    },
  });
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
          'content-type': 'text/javascript; charset=utf-8',
          'cache-control': 'no-store',
          'service-worker-allowed': '/',
        },
      });
    }

    if (!env.PASSWORD || !env.SESSION_SECRET) {
      return new Response('Gate is not configured yet.', { status: 500 });
    }

    if (url.pathname === '/__unlock') {
      if (request.method !== 'POST') {
        return new Response(null, { status: 405, headers: { allow: 'POST' } });
      }
      const form = await request.formData();
      const given = String(form.get('password') || '');
      if (!same(given, env.PASSWORD)) return gate(401, 'Wrong password.');
      const value = await expectedToken(env.SESSION_SECRET);
      return new Response(null, {
        status: 303,
        headers: {
          location: '/',
          'set-cookie':
            COOKIE + '=' + value + '; Path=/; Max-Age=' + MAX_AGE + '; HttpOnly; Secure; SameSite=Lax',
          'cache-control': 'no-store',
        },
      });
    }

    const value = await expectedToken(env.SESSION_SECRET);
    if (!same(token(request.headers.get('cookie')), value)) return gate(401);

    const response = await env.ASSETS.fetch(request);
    const doc =
      request.headers.get('sec-fetch-mode') === 'navigate' ||
      (request.headers.get('accept') || '').includes('text/html');
    if (!doc) return response;

    /* No storage on anyone's device: wipe any service worker + cache state the
       page used to install, on every document load. Cookies are untouched. */
    const headers = new Headers(response.headers);
    headers.set('clear-site-data', '"storage"');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
