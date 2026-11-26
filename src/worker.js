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
.row[hidden]{display:none}
input{flex:1;min-width:0;padding:.85rem 1rem;border:1px solid #9ba89b;border-radius:99px;background:#f4f0e5;color:#183632;font:400 .95rem/1 Arial,Helvetica,sans-serif;-webkit-text-security:disc;letter-spacing:.1em}
input:focus{outline:2px solid #b35d3d;outline-offset:2px}
button{padding:.85rem 1.3rem;border:0;border-radius:99px;background:#183632;color:#f4f0e5;font:600 .78rem/1 monospace;letter-spacing:.14em;text-transform:uppercase;cursor:pointer}
button:hover{background:#b35d3d}
.err{margin:1rem 0 0;padding:.7rem .9rem;border-left:2px solid #b35d3d;background:#f4f0e5;font:400 .85rem/1.4 Arial,Helvetica,sans-serif;color:#8c3d24}
.note{margin:1.4rem 0 0;font:400 .72rem/1.5 monospace;letter-spacing:.08em;text-transform:uppercase;color:#7b8a86}
.bar{position:relative;height:3px;background:#c6c2b5;overflow:hidden}
.bar i{display:block;height:100%;width:0;background:#b35d3d;transition:width .16s linear}
.pct{margin:.8rem 0 0;font:400 .72rem/1.5 monospace;letter-spacing:.08em;text-transform:uppercase;color:#41574f}
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
  var row = document.querySelector('.row');
  var note = document.querySelector('.note');
  var MIN_MS = 5000;
  var busy = false;
  input.focus();

  function fail(message) {
    var p = document.createElement('p');
    p.className = 'err';
    p.textContent = message;
    var old = document.querySelector('.err');
    if (old) old.replaceWith(p); else note.before(p);
    row.hidden = false;
    button.disabled = false;
    button.textContent = 'Open';
    input.select();
  }

  function showBar() {
    row.hidden = true;
    var wrap = document.createElement('div');
    wrap.innerHTML = '<div class="bar"><i></i></div><p class="pct">Downloading presentation</p>';
    note.before(wrap);
    var fill = wrap.querySelector('i');
    var label = wrap.querySelector('.pct');
    return function (pct, bytes) {
      fill.style.width = pct + '%';
      label.textContent =
        'Downloading presentation · ' + Math.round(pct) + '% · ' +
        (bytes / 1048576).toFixed(1) + ' MB';
    };
  }

  function download(items, state) {
    var map = {};
    var queue = items.slice();
    function runner() {
      return (async function () {
        while (queue.length) {
          var url = queue.shift();
          try {
            var response = await fetch(url);
            if (!response.ok) continue;
            var chunks = [];
            var reader = response.body.getReader();
            while (true) {
              var step = await reader.read();
              if (step.done) break;
              chunks.push(step.value);
              state.bytes += step.value.length;
            }
            var path = url.split('?')[0];
            var type = /[.]webp$/.test(path) ? 'image/webp' : /[.]mp3$/.test(path) ? 'audio/mpeg' : '';
            map[path] = URL.createObjectURL(new Blob(chunks, { type: type }));
          } catch (error) {}
        }
      })();
    }
    var runners = [];
    for (var i = 0; i < 6; i += 1) runners.push(runner());
    return Promise.all(runners).then(function () { return map; });
  }

  /* Believable five second bar; it never passes 97% until the bytes are really in. */
  function playBar(paint, state, started) {
    return new Promise(function (resolve) {
      var shown = 0;
      function frame() {
        var t = Math.min(1, (performance.now() - started) / MIN_MS);
        var eased = (1 - Math.pow(1 - t, 2.2)) * 100;
        var ceiling = state.ready ? 100 : 97;
        var target = Math.min(eased + (Math.random() - 0.5) * 2.6, ceiling);
        shown = Math.max(shown, Math.min(target, shown + 5));
        if (shown >= 99.4 && state.ready) {
          paint(100, state.bytes);
          setTimeout(resolve, 300);
          return;
        }
        paint(shown, state.bytes);
        setTimeout(frame, 80);
      }
      frame();
    });
  }

  function open() {
    if (busy) return;
    busy = true;
    button.disabled = true;
    button.textContent = 'Checking';
    var started = performance.now();
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
        if (!body.items || !body.items.length) return body.html;
        var state = { ready: false, bytes: 0 };
        var paint = showBar();
        var work = download(body.items, state).then(function (map) {
          state.ready = true;
          return map;
        });
        return playBar(paint, state, started).then(function () { return work; }).then(function (map) {
          var html = body.html.replace(/src="(\\.\\/img\\/[^"?]+)(\\?[^"]*)?"/g, function (match, path) {
            return map[path] ? 'src="' + map[path] + '"' : match;
          });
          var audio = {};
          Object.keys(map).forEach(function (key) {
            if (key.indexOf('./audio/') === 0) audio[key.slice(8)] = map[key];
          });
          return html.replace(
            '<head>',
            '<head><script>window.__B=' + JSON.stringify(audio) + '<\\/script>',
          );
        });
      })
      .then(function (html) {
        document.open();
        document.write(html);
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

/* Every file the deck can show, so the gate knows what to pull in. */
let MANIFEST = null;
async function manifest(env, base) {
  if (MANIFEST) return MANIFEST;
  const page = await env.ASSETS.fetch(new Request(new URL('/index.html', base).toString()));
  const html = await page.text();
  const urls = [];
  const seen = new Set();
  const add = (u) => {
    if (!seen.has(u)) {
      seen.add(u);
      urls.push(u);
    }
  };
  for (const m of html.matchAll(/src="(\.\/img\/[^"?]+)"/g)) add(m[1]);
  const list = html.match(/const A=\[([^\]]*)\]/);
  if (list) for (const m of list[1].matchAll(/'([^']+\.mp3)'/g)) add('./audio/' + m[1]);
  MANIFEST = urls;
  return MANIFEST;
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
      const urls = await manifest(env, url);
      return json(
        {
          html: authorize(await page.text(), t),
          items: urls.map((u) => u + '?k=' + t),
        },
        200,
      );
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
