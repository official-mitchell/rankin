<!-- Deploy: GitHub Action on main runs npm ci, npm run build, npx wrangler deploy. CREATE_KEY is not in the workflow. Custom hostnames go in wrangler.jsonc routes. -->

# We Rankin'

Phone-first pitch-night voting. The Vite React client is served by a Cloudflare Worker. Each session is one SQLite Durable Object.

## Local

1. `npm install`
2. Copy `.dev.vars.example` to `.dev.vars` and set `CREATE_KEY` (at least 12 random characters).
3. Put `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in `.env` (gitignored). Wrangler reads that file. Do not put the API token in `.dev.vars`.
4. `npm run build && npm test`
5. `npm run dev`, then `curl http://localhost:8787/api/health`

`LOG_LEVEL` is `info` in `wrangler.jsonc` and `debug` in `.dev.vars`.

## Deploy

1. `npm run build`
2. `npx wrangler secret put CREATE_KEY`
3. `npx wrangler deploy`
4. Open `/api/health` on the workers.dev URL from the deploy output.

A push to `main` runs `.github/workflows/deploy.yml`: `npm ci`, `npm run build`, `npx wrangler deploy`. GitHub repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` must exist. The workflow does not set `CREATE_KEY`; the secret already on the Worker stays.

A hostname on a zone in this Cloudflare account can be attached in `wrangler.jsonc`:

```jsonc
"routes": [{ "pattern": "rankin.example.com", "custom_domain": true }]
```

The next deploy creates the DNS record and certificate. The workers.dev name stays `we-rankin.<account-subdomain>.workers.dev`. Changing that name means a new Worker and a new Durable Object, so existing sessions would not move with it.

## Rollback

1. Cloudflare dashboard → Workers & Pages → `we-rankin` → Deployments.
2. Open the previous successful deployment and choose Rollback.

## Logs

`npx wrangler tail` prints one JSON line per request. Each line has `reqId`. `CREATE_KEY` and the host secret are not logged.
