# Gaband323 Tech Watch

Cloudflare Worker + D1 dashboard for AI model updates, developer deals/free-tier changes, RSS/changelog feeds, and service status notes.

## Dashboard deploy flow

1. Push this folder to a GitHub repo.
2. Cloudflare Dashboard → Workers & Pages → Create application → Import repository.
3. Use Worker deployment, not static Pages.
4. Build command: `npm install`
5. Deploy command: `npx wrangler deploy`
6. Root directory: `/` unless these files are inside a subfolder.
7. Create a D1 database named `gaband-tech-watch-db`.
8. Put its database ID into `wrangler.toml` under `database_id`.
9. In Worker settings, add a D1 binding named exactly `DB`.
10. Add custom domain `tech.gaband323.dev`.
11. Add variables/secrets below, then redeploy.

## Required secret

`ADMIN_PRESET_PASSWORD` — your admin password, 8+ chars recommended.

## Recommended variables

`ADMIN_PRESET_EMAIL=gaband323@gmail.com`
`ADMIN_EMAILS=gaband323@gmail.com`
`SITE_NAME=Gaband323 Tech Watch`
`SITE_ORIGIN=https://tech.gaband323.dev`

## Optional email digest secrets

`RESEND_API_KEY` — enables the admin digest send button and daily digest cron.

## Notes

The app creates its D1 tables automatically on first request, so you do not need to run SQL manually.
Default RSS sources are added automatically on startup and can be managed in `/admin`.
