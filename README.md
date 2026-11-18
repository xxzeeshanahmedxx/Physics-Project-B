# Physics Project - B

A presentation on the interdisciplinary nature of physics.

- **Hosting:** Cloudflare Workers (static assets), auto-deploys from `main`
- **Entry point:** `public/index.html` (static, no build step)

## Using the presentation

| Action | Control |
| --- | --- |
| Next slide | `→` `↓` `Space` `Enter` `PageDown`, next arrow, or swipe left |
| Previous slide | `←` `↑` `PageUp`, previous arrow, or swipe right |
| Jump to a slide | click a dot, or open `#4` in the URL |
| First / last slide | `Home` / `End` |
| Play the thank-you sound | press `T` |

## Structure

| Path | Purpose |
| --- | --- |
| `public/index.html` | The whole site: markup, styles, navigation |
| `public/ThankYou.mp3` | Sound played when `T` is pressed |
| `public/test.html` | Deployment check page |
| `public/sw.js` | Service worker: offline-first caching |
| `public/offline-files.json` | Extra files to download and keep on the device |
| `public/_headers` | HTTP `Cache-Control` rules |
| `wrangler.jsonc` | Cloudflare config: worker name + assets directory |
| `README.md` | This file |

## Caching / offline

Every visit stores the whole site on the device:

- **On install** the service worker precaches `/`, `/index.html`, `/test.html`,
  `/ThankYou.mp3`, plus everything listed in `public/offline-files.json`.
- **Any same-origin file** requested later (a new page, image, PDF) is fetched
  once and then served from the device cache — so future files are cached too.
- **HTML** is served instantly from cache and refreshed quietly in the background.
- **Offline** the presentation still opens and the `T` sound still plays.

To force every device to re-download the site after a change, bump the line
`const VERSION = 'v1';` at the top of `public/sw.js` and push. Bumping it
deletes the old cache and builds a fresh one.

To add a file to the offline set without visiting it, add its path to
`public/offline-files.json`.

## Editing

Everything lives in `public/index.html`. Edit the text inside each `<section>`,
then commit and push:

```bash
git add -A
git commit -m "Update project content"
git push
```

Cloudflare picks up the push and redeploys within a minute.

## Local preview

```bash
python3 -m http.server 8000 --directory public
# then open http://localhost:8000
```
