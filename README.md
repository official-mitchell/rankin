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

Git pushes to `main` also deploy when the Cloudflare Git connection is on. Build command: `npm run build`. Deploy command: `npx wrangler deploy`.

## Rollback

1. Cloudflare dashboard → Workers & Pages → `we-rankin` → Deployments.
2. Open the previous successful deployment and choose Rollback.

## Logs

`npx wrangler tail` prints one JSON line per request. Each line has `reqId`. `CREATE_KEY` and the host secret are not logged.
