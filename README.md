# Physics Project - B

A working page for notes, experiments, and results.

- **Live site:** https://physics-project-b.pages.dev
- **Hosting:** Cloudflare Pages (auto-deploys from `main`)
- **Entry point:** `index.html` (static, no build step)

## Editing

Everything is in a single file, `index.html`. Open it, edit the text inside each
`<section>`, commit, and push:

```bash
git add -A
git commit -m "Update project content"
git push
```

Cloudflare Pages picks up the push and redeploys within a minute.

## Structure

| Path | Purpose |
| --- | --- |
| `index.html` | The whole site: markup + styles |
| `README.md` | This file |

## Local preview

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```
