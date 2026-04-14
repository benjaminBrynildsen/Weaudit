# WeAudit Security Overview Page

Static, GitHub Pages-friendly security overview for enterprise security reviews.

## Local preview

From repo root:

```bash
python3 -m http.server 8080
```

Then open:
- `http://localhost:8080/docs/security/`

## Publish via GitHub Pages

### Option A: Publish from `/docs` on `main`
1. Push this branch to GitHub.
2. In GitHub repo settings, go to **Pages**.
3. Set **Source** to `Deploy from a branch`.
4. Select branch `main` and folder `/docs`.
5. Page will be available at: `https://<org-or-user>.github.io/<repo>/security/`

### Option B: Publish from dedicated `gh-pages` branch
If you prefer, copy `docs/security/*` to the root of a `gh-pages` branch and publish that branch.

## Theme
Uses the current app-style palette:
- Dark navy background
- Emerald accent (`#10b981`) matching the existing UI accent
