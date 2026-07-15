# Deploy guide

The Cloudflare Worker **`habit-tracker`** already exists and is git-connected to this repo, so it rebuilds and redeploys automatically on every push to the connected branch. There is no `wrangler deploy` to run by hand.

Two one-time setup steps are needed before the first successful deploy: create the D1 database, and tell Cloudflare's build to run `npm run build`. Both need your Cloudflare login.

## 1. Create the D1 database (one time)

The app stores everything in a Cloudflare D1 database. Create it and copy the printed `database_id`:

```bash
npx wrangler login
npx wrangler d1 create habit_tracker
```

Open `wrangler.jsonc` and replace the placeholder with the real id:

```jsonc
"d1_databases": [
  { "binding": "DB", "database_name": "habit_tracker", "database_id": "PASTE_THE_REAL_ID_HERE" }
]
```

(The `database_id` is not a secret — it is safe to commit.)

Then create the tables and seed the starter habits **on the remote database**:

```bash
npx wrangler d1 execute habit_tracker --remote --file=./schema.sql
npx wrangler d1 execute habit_tracker --remote --file=./seed.sql
```

> ⚠️ `--remote` seeds the real database. Omit it (`--local`) only for local dev. Run the two `--remote` commands once; running `schema.sql` again will DROP and recreate the tables (you lose data).

## 2. Set the build command in Cloudflare (one time)

The Worker serves the built SPA from `dist/`, so Cloudflare must build it before deploying.

In the Cloudflare dashboard → **Workers & Pages → habit-tracker → Settings → Build**:

- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler deploy` (this is the default)

`npm install` runs automatically; the committed `.npmrc` (`legacy-peer-deps=true`) makes it resolve cleanly.

## 3. Deploy

Push the branch and merge the pull request into the connected branch (usually `main`). That push triggers a Cloudflare build:

1. `npm install`
2. `npm run build` → produces `dist/`
3. `npx wrangler deploy` → uploads the Worker + `dist/` assets, binding the `DB` database from `wrangler.jsonc`.

Watch the build under **habit-tracker → Deployments**. Once green, enable a URL (the Worker's `*.workers.dev` route or a custom domain) under the Worker's settings.

## 4. First visit

Open the deployed URL. Anyone can view the habits. Click **🔒 Unlock** → the app prompts you to *set an edit password* (use your mobile number). After that, editing is unlocked on that device (the password is remembered in the browser; **Lock** clears it). You can change the password later under **Settings → Change edit password**.

Nothing secret is committed to the repo — the password lives only as a SHA-256 hash in the D1 database.

## Troubleshooting

- **Build fails on `npm install` (ERESOLVE):** confirm `.npmrc` with `legacy-peer-deps=true` is present in the repo root.
- **Deploy fails: D1 database not found / bad `database_id`:** you skipped step 1, or the id in `wrangler.jsonc` is still the placeholder.
- **App loads but shows no habits / API errors:** you didn't run the `--remote` `schema.sql` + `seed.sql` commands, so the remote database is empty.
- **"Latest build failed" while only `README.md` is on the branch:** expected — the build only succeeds once the app code is merged.
