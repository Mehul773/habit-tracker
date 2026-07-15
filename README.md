# Habit Tracker

A personal, fully-customizable daily habit tracker. A GitHub-style completion grid, streak / perfect-day / active-day stats, a "Today" checklist, trend charts for numeric habits, and an optional "sprint" goal overlay.

Runs entirely on Cloudflare's free tier: one Worker serves the app and a small sync API backed by a Cloudflare D1 (SQLite) database, so the same data shows up on every device.

## How it works

- **Two kinds of habits, both editable in the app:**
  - **Check** — a simple done / not-done tick for the day (e.g. "LinkedIn post", "Exercise").
  - **Number** — log a value with a goal and a direction (e.g. "Pushups ≥ 50 reps", "Morning run ≥ 3 km"). Each number habit gets a trend chart with a goal line.
- **The grid** shades each day by how much of that day you completed, like a GitHub contribution graph.
- **Stats:** current streak, total perfect days, total active days.
- **Sprint mode** (optional) turns it into a fixed "Day N / 84" countdown with a progress bar.
- **Access:** anyone with the link can *view* your habits and stats. *Editing* (ticking, adding, renaming, logging numbers) requires a password. You set the password on first visit — the app suggests your mobile number. The password is stored only as a SHA-256 hash in the database.

All dates use IST (Asia/Kolkata) as the day boundary.

## Local development

Requirements: Node.js and npm.

```bash
npm install                # installs deps (.npmrc sets legacy-peer-deps)
npm run db:local           # creates + seeds a LOCAL D1 database
npm run build              # type-check + build the SPA to dist/
npx wrangler dev           # serve the app + API locally at http://localhost:8787
```

For UI-only work you can run `npm run dev` (Vite dev server), but the API and database only work under `npx wrangler dev` (which serves the built `dist/` plus the Worker).

Run the tests with `npm test` (Vitest — covers the date, logic, and auth helpers).

## Deploying

The app is built and deployed by Cloudflare automatically whenever the connected branch is pushed. See [docs/DEPLOY.md](docs/DEPLOY.md) for the one-time setup (creating the D1 database and setting the build command).

## Project layout

- `src/` — React + Vite + Tailwind single-page app (`lib/` = types, IST dates, habit logic, API client; `components/` = UI).
- `worker/` — the Cloudflare Worker: serves the SPA and the `/api/*` routes backed by D1.
- `schema.sql` / `seed.sql` — database tables and the starter habits.
- `docs/superpowers/` — the design spec and implementation plan this was built from.
