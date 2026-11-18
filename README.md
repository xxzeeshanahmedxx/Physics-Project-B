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
| `wrangler.jsonc` | Cloudflare config: worker name + assets directory |
| `README.md` | This file |

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
