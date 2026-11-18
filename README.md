# Physics Project - B

A working page for notes, experiments, and results.

- **Hosting:** Cloudflare Workers (static assets), auto-deploys from `main`
- **Entry point:** `public/index.html` (static, no build step)

## Editing

Everything lives in `public/index.html`. Open it, edit the text inside each
`<section>`, then commit and push:

```bash
git add -A
git commit -m "Update project content"
git push
```

Cloudflare picks up the push and redeploys within a minute.

## Structure

| Path | Purpose |
| --- | --- |
| `public/index.html` | The whole site: markup + styles |
| `wrangler.jsonc` | Cloudflare config: worker name + assets directory |
| `README.md` | This file |

## Local preview

```bash
python3 -m http.server 8000 --directory public
# then open http://localhost:8000
```
