# Cloudflare Pages deployment

Cloudflare Pages owns the production build and deployment through its native GitHub integration. GitHub Actions is used only to refresh, validate, and persist public data.

## Pages project settings

Create a Git-integrated Cloudflare Pages project with these values:

| Setting | Value |
| --- | --- |
| Git repository | `qisichen74-wq/neuroimmune-cart-hub` |
| Production branch | `main` |
| Framework preset | None |
| Root directory | `/` |
| Build command | `npm run build:site` |
| Build output directory | `dist` |
| Node.js | `22` (set by `.node-version`) |
| Environment variables | None |

No Cloudflare API token or account ID is stored in GitHub. Do not create a second Direct Upload project or a second GitHub deployment workflow for this repository.

## Deployment behavior

- Every push to `main` is built and deployed by Cloudflare Pages.
- Pull requests and non-production branches can use Cloudflare preview deployments.
- At 06:30 China Standard Time each day, `.github/workflows/refresh-data.yml` discovers new records, checks primary sources and regulatory endpoints, audits the public data, generates the briefing, and verifies the complete static build.
- The scheduled workflow commits verified changes under `data/` back to `main`. That commit becomes the auditable source for the next Cloudflare deployment and preserves source snapshots and change history across days.
- A discovery or primary-source verification failure stops the update before commit, leaving the previous production version online. A temporarily unavailable regulatory endpoint is recorded in the report but does not discard the rest of a verified update.

The production build copies only HTML files, `assets/`, and `data/` into `dist/`. Repository scripts, prompts, workflow files, and credentials are not included in the public site.

## First deployment checklist

1. In Cloudflare, create a Pages application by importing the GitHub repository above.
2. Enter the build settings exactly as listed above and deploy `main`.
3. Confirm the generated `*.pages.dev` address.
4. Run `Refresh public intelligence data` manually once in GitHub Actions.
5. After Cloudflare successfully deploys the resulting data commit, add a custom domain if needed.
6. Disable GitHub Pages after the Cloudflare production address has been verified.
