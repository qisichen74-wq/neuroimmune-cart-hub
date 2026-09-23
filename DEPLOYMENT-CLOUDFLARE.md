# Cloudflare deployment

The connected GitHub check is **Workers Builds: neuroimmune-cart-hub**, not Pages. Keep the existing Git integration; do not create a second project or deployment workflow. GitHub Pages is also enabled on main, but only serves a static mirror and cannot execute the assistant API.

## Workers configuration

- Build: `npm run build:site`; Node.js 22.
- Wrangler entry: `worker.mjs`; static directory: `dist/`; binding: `ASSETS`.
- `/api/*` runs the Worker first. `/api/assistant` supports GET status and POST questions. Other API paths return 404.
- Non-API requests serve static assets. The index is read through the assets binding, avoiding public-network self-fetch.
- Deploy using the existing Workers Builds configuration. Verify its production branch and the successful check for the exact release commit; a merge alone is not deployment evidence.

## Model configuration

Set `DEEPSEEK_API_KEY` as a runtime secret in the existing Cloudflare Worker, never a public build variable. Optional variables: `DEEPSEEK_MODEL`, `DEEPSEEK_API_BASE`, `DEEPSEEK_THINKING`. Local `.env.local` is excluded from Git and is not uploaded.

Without a key the assistant serves retrieval-only answers. `ASSISTANT_DISABLE_MODEL=1` forces this mode even if a key exists. In-memory rate limiting is best-effort per isolate, not a global cost cap; configure account-side limits before opening paid model access broadly.

## Release verification

1. Run audit, build, assistant tests and retrieval evaluation in the release checkout.
2. Verify the deployment check belongs to the intended commit and reports success.
3. Confirm the deployed assistant page and index contents.
4. Read `/api/assistant` to distinguish API availability from model configuration.
5. Test POST without private content. A retrieval response is not proof of a live model call.

The scheduled GitHub workflow refreshes public data and validates the build; it does not configure model secrets. The static build copies allowlisted pages/data plus assets, not local credentials or server scripts.

The Pages-compatible function remains available for a future explicit Pages deployment, but is not a substitute for the Workers entry point used today.

Configuration follows [Cloudflare asset bindings](https://developers.cloudflare.com/workers/static-assets/binding/) and [Worker routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/).
