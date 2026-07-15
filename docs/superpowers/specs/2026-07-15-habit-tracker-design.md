# Habit Tracker — Design Spec

**Date:** 2026-07-15
**Owner:** Mehul Chovatiya
**Repo:** https://github.com/Mehul773/habit-tracker.git
**Status:** Approved design → ready for implementation plan

---

## 1. Overview

A personal, fully-customizable daily habit tracker inspired by a "12 Week Sprint"
dashboard screenshot: a GitHub-style completion grid, streak/perfect/active-day
stats, a "Today" checklist, and trend charts for numeric habits.

Runs on the user's Cloudflare stack (one Worker + D1 SQLite), free tier.
Data syncs across the user's Windows laptop and Android phone via the shared DB.

**Access model:** *public read, login to edit.* Anyone with the URL can view all
habits and stats. Any change (tick, add, rename, log a number, edit goals) requires
a password stored in the database.

## 2. Goals

- Track two kinds of daily habits, both customizable at runtime:
  - **`check`** — boolean, done / not done for the day.
  - **`number`** — a numeric value logged per day, with a **goal** and a
    **direction** (`atLeast` / `atMost`); shows a trend chart.
- GitHub-style grid: one cell per day, shade = fraction of habits met that day.
- Stats: current **streak**, **perfect** days, **active** days.
- Optional, switchable **sprint** overlay ("Day 45 / 84" + progress bar); default
  open-ended.
- Full habit management: add, rename, recolor, set emoji, set goal/unit, reorder,
  archive.
- Public read; edit gated by a DB-stored password (seed = user's mobile number),
  changeable in a settings screen.
- Correct IST date handling (the app's day boundary is `Asia/Kolkata`).

## 3. Non-goals (YAGNI for v1)

- No flexible frequencies (`3x/week`, weekdays-only) — daily only.
- No multi-user accounts / signup — single owner, one edit password.
- No reminders / push notifications.
- No third-party chart library — charts are hand-rolled SVG.
- No native app — responsive web (works well on phone; PWA optional, later).

## 4. Stack & hosting

- **Frontend:** React + Vite + TypeScript + Tailwind (user's existing stack).
- **Charts:** hand-rolled inline SVG (line chart with goal line; grid) — no dependency.
- **Backend:** a single **Cloudflare Worker** that:
  - serves the built SPA via the static-assets binding, and
  - answers `/api/*` from **Cloudflare D1** (SQLite).
- **Deploy:** git-connected auto-build on push (per repo). One repo, one Worker,
  one deploy.
- **Config:** `wrangler.toml` (or `wrangler.jsonc`) with the D1 binding + assets
  binding. No secrets committed. The edit password is **not** an env var — it lives
  in D1 (see §7).

## 5. Data model (D1 / SQLite)

```sql
CREATE TABLE habits (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL,
  emoji        TEXT    NOT NULL DEFAULT '',
  color        TEXT    NOT NULL DEFAULT '#22c55e',
  kind         TEXT    NOT NULL CHECK (kind IN ('check','number')),
  goal         REAL,                       -- number habits only
  goal_dir     TEXT    CHECK (goal_dir IN ('atLeast','atMost')), -- number only
  unit         TEXT    NOT NULL DEFAULT '',-- e.g. 'reps','km'
  sort         INTEGER NOT NULL DEFAULT 0,
  archived     INTEGER NOT NULL DEFAULT 0, -- 0/1
  created_at   TEXT    NOT NULL            -- ISO
);

CREATE TABLE entries (
  habit_id  INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date      TEXT    NOT NULL,              -- 'YYYY-MM-DD' in IST
  value     REAL,                          -- number habits: the logged value
  done      INTEGER NOT NULL DEFAULT 0,    -- check habits: 0/1
  PRIMARY KEY (habit_id, date)
);

CREATE TABLE settings (
  id                  INTEGER PRIMARY KEY CHECK (id = 1), -- single row
  title               TEXT    NOT NULL DEFAULT '12 Week Sprint',
  sprint_on           INTEGER NOT NULL DEFAULT 0,
  sprint_start        TEXT,                -- 'YYYY-MM-DD' IST
  sprint_len_days     INTEGER NOT NULL DEFAULT 84,
  edit_password_hash  TEXT                 -- SHA-256 hex; NULL = not set yet
);
```

- `entries` is an upsert target keyed on `(habit_id, date)`.
- Deleting a habit cascades its entries. Prefer **archive** over delete in the UI.

## 6. API (Worker `/api/*`)

All JSON. Reads are public. Writes require the edit password (see §7).

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/state?from=YYYY-MM-DD&to=YYYY-MM-DD` | public | habits + settings + entries in range (default: sprint or last ~120 days) |
| POST | `/api/auth/verify` | — | body `{password}` → `{ok:true}` if hash matches (used to unlock edit mode) |
| POST | `/api/auth/set` | write* | body `{newPassword, currentPassword?}` → set/change edit password |
| POST | `/api/habits` | write | create a habit |
| PATCH | `/api/habits/:id` | write | rename/recolor/emoji/goal/unit/sort/archive |
| DELETE | `/api/habits/:id` | write | delete (UI prefers archive) |
| PUT | `/api/entries` | write | upsert `{habit_id, date, value?, done?}` |
| PATCH | `/api/settings` | write | title + sprint config |

\* `auth/set`: if `edit_password_hash` is NULL (never set), allow setting without
`currentPassword` (first-run). Otherwise require a correct `currentPassword`.

## 7. Auth flow

- **Storage:** `settings.edit_password_hash` = `SHA-256(password)` hex. Seed value is
  the user's mobile number, set by the user via the settings screen (or first-run
  prompt) — **not** hardcoded in the repo.
- **Verify:** write requests send `Authorization: Bearer <password>`. The Worker
  computes `SHA-256` of it and compares to the stored hash. Reads send nothing.
- **Client:** after a successful `auth/verify`, the app enters "edit mode" and stores
  the password in `localStorage` so edit mode persists on that device. A "Lock"
  button clears it. Over HTTPS only.
- **First run:** if `edit_password_hash` is NULL, the app shows a "set edit password"
  prompt and edit mode is open until one is set.
- **Rationale for hashing:** DB is publicly readable via the app but the raw
  `/api/state` never returns the hash; even so, hashing means a DB dump never exposes
  the number in plaintext. (Note: SHA-256 of a phone number is low-entropy and
  brute-forceable — acceptable for this personal, low-stakes app; documented so it's
  a known tradeoff, not an oversight.)

## 8. Screens (single page, responsive)

- **Header** — title; `streak` / `perfect` / `active` stat chips; if `sprint_on`,
  "Day N / total" + progress bar. A **Lock/Unlock** button (edit mode).
- **Grid** — GitHub-style: weekday rows × week columns across the visible range;
  each cell shaded by that day's completion fraction (0 → 4 buckets). Hover/tap → date + count.
- **Today** — checklist of non-archived habits:
  - `check`: tap to toggle done.
  - `number`: numeric input; cell turns "met" color when the goal is satisfied.
  - Edits only enabled in edit mode; otherwise read-only.
- **Number-habit charts** — for each `number` habit, a small SVG line chart of its
  values over the range with a dashed **goal line**.
- **Manage habits** (edit mode) — add / rename / emoji / color / kind / goal / unit /
  reorder / archive.
- **Settings** (edit mode) — app title; sprint on/off + start date + length; set /
  change edit password.

## 9. Logic (exact definitions)

- **Met(habit, day):**
  - `check` → `done == 1`.
  - `number` → `goal_dir == 'atLeast' ? value >= goal : value <= goal`
    (a day with no value logged is **not** met).
- **Active day** — ≥1 non-archived habit met (or, for the grid shade, has ≥1 entry).
- **Perfect day** — every non-archived habit is met that day.
- **Streak** — current run of consecutive **perfect** days ending today, or ending
  yesterday if today is not yet perfect (today in progress doesn't break the streak).
- **Grid shade bucket** — `metCount / totalHabits` mapped to 0–4.
- **Dates** — the current day and all boundaries are the **IST calendar date**:
  `new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Kolkata', year:'numeric',
  month:'2-digit', day:'2-digit'}).format(now)` → `'YYYY-MM-DD'`. IST is a fixed
  `+05:30` (no DST); never use device-timezone offsets. (Per prior IST day-boundary
  incident.)

## 10. Seed habits (all editable by the user at runtime)

- **Checks:** YouTube video · LinkedIn post · Exercise · Learn something · Agency work
- **Numbers:** Pushups (≥ 50 reps) · Upwork outreach (≥ 5) · Morning run (≥ 3 km, chart)

Emojis/colors seeded sensibly; user can change everything.

## 11. Testing

- **Vitest (logic):** `met()`, active/perfect/streak, grid bucketing, and IST date
  helpers — including the historically-fragile cases: an entry logged after 18:30 IST,
  `atMost` goals, no-value days, archived habits excluded, streak with today in progress.
  Run a full (non-incremental) `tsc --noEmit` before trusting green.
- **Worker/API:** upsert idempotency on `(habit_id,date)`; write requests rejected
  without a valid password; reads work with none; `auth/set` first-run vs change path.
- **Browser walk (before "done"):** load the app in a real browser, set a password,
  tick a check, log a number, watch grid + stat + chart update, lock, confirm edits
  are blocked while reads still render. Test at a mobile viewport too.

## 12. Deployment & config

- `wrangler` config with `d1_databases` binding + assets binding; build command runs
  `vite build`.
- Migrations: a `schema.sql` applied to D1 (via `wrangler d1 execute`); a seed script
  inserts the §10 habits + the single settings row (with `edit_password_hash` NULL).
- No `.env*` committed. Nothing secret needed at build time (password is in D1).

## 13. Future (out of scope, noted)

- Flexible frequencies, reminders/PWA push, weight/other metrics, CSV export,
  multiple sprints history, per-habit streaks.
