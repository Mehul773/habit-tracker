# Habit Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public-read / login-to-edit personal daily habit tracker on Cloudflare (one Worker + D1), with `check` and `number` habits, a GitHub-style completion grid, streak/perfect/active stats, per-number trend charts, and a switchable sprint overlay.

**Architecture:** A React + Vite + Tailwind SPA is built to static files and served by a single Cloudflare Worker. The same Worker exposes `/api/*` backed by Cloudflare D1 (SQLite). Reads are public; writes require an edit password whose SHA-256 hash lives in the DB. All day boundaries are the IST calendar date.

**Tech Stack:** TypeScript, React 19, Vite 6, Tailwind v4 (`@tailwindcss/vite`), Cloudflare Workers (static assets binding), Cloudflare D1, Vitest, Wrangler 4.

## Global Constraints

- **Free tier only** — Cloudflare Workers + D1 free tier; no paid services, no extra SaaS.
- **No third-party chart library** — charts are hand-rolled inline SVG.
- **No secrets committed** — `.gitignore` covers `.env*`, `.dev.vars`, `.wrangler/`, `node_modules`, `dist`. The edit password is never in code/env; it lives in D1 as a SHA-256 hash.
- **IST dates only** — every day boundary uses `Asia/Kolkata` fixed `+05:30`; never device-timezone offsets (`.toLocaleString(tz)` + manual offset is banned).
- **Public read, login to edit** — GET is unauthenticated; every mutating endpoint requires `Authorization: Bearer <password>` verified by SHA-256 compare against `settings.edit_password_hash`.
- **Path/shell:** Windows machine, PowerShell primary + Bash tool. Never `cd` into spaced paths; project root has no spaces so plain `cd` is fine here.
- **Verify before done** — a task touching runtime UI/API ends with a real browser or `curl` walk, not just a green unit test. Run non-incremental `npx tsc --noEmit` before trusting types.

## File Structure

```
habit-tracker/
  package.json               # scripts, deps
  tsconfig.json              # app + worker TS config
  vite.config.ts             # React + Tailwind plugins
  wrangler.jsonc             # Worker: main + assets(SPA) + D1 binding
  index.html                 # SPA entry
  .gitignore
  schema.sql                 # D1 tables
  seed.sql                   # seed habits + single settings row (password NULL)
  src/
    main.tsx                 # React mount
    App.tsx                  # top-level: load state, edit-mode, layout
    index.css                # tailwind import + base
    lib/
      types.ts               # Habit, Entry, Settings, AppState, enums (shared w/ worker)
      dates.ts               # IST date helpers
      logic.ts               # isMet, day completion, perfect/active/streak, grid bucket
      api.ts                 # typed fetch client
      editmode.ts            # tiny edit-mode store (localStorage password)
    components/
      Header.tsx             # title, stat chips, sprint bar, lock/unlock button
      Grid.tsx               # GitHub-style SVG completion grid
      Today.tsx              # today checklist (check toggle + number input)
      NumberChart.tsx        # SVG line chart + goal line for one number habit
      ManageHabits.tsx       # add/edit/emoji/color/goal/reorder/archive
      SettingsPanel.tsx      # title, sprint config, set/change password
      LoginModal.tsx         # enter password to unlock edit mode
  worker/
    index.ts                 # fetch: route /api/* else env.ASSETS.fetch
    db.ts                    # D1 query helpers (getState, CRUD)
    auth.ts                  # sha256Hex, verifyPassword
    routes.ts               # /api handlers (state, auth, habits, entries, settings)
  test/
    dates.test.ts
    logic.test.ts
    auth.test.ts
    api.smoke.md             # scripted curl smoke steps for /api (run vs wrangler dev)
```

Types in `src/lib/types.ts` are imported by both the SPA and the Worker (single source of truth). `dates.ts`, `logic.ts`, `auth.ts` are pure/isomorphic (Web Crypto is available in Worker, browser, and Node 20 test runtime).

---

### Task 1: Project scaffold (Vite + React + TS + Tailwind + Worker config)

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `wrangler.jsonc`, `index.html`, `.gitignore`, `src/main.tsx`, `src/App.tsx`, `src/index.css`

**Interfaces:**
- Produces: a working `npm run dev` (Vite) and `npm run build` (outputs `dist/`), plus a `wrangler.jsonc` wired for later tasks.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "habit-tracker",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "wrangler dev",
    "test": "vitest run",
    "deploy": "npm run build && wrangler deploy",
    "db:local": "wrangler d1 execute habit_tracker --local --file=./schema.sql && wrangler d1 execute habit_tracker --local --file=./seed.sql"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20250101.0",
    "@tailwindcss/vite": "^4.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.0",
    "wrangler": "^4.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "types": ["@cloudflare/workers-types", "vite/client"],
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src", "worker", "test"]
}
```

- [ ] **Step 3: Create `vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: "dist" },
});
```

- [ ] **Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Habit Tracker</title>
  </head>
  <body class="bg-neutral-950 text-neutral-100">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `src/index.css`**

```css
@import "tailwindcss";
```

- [ ] **Step 6: Create `src/main.tsx` and a placeholder `src/App.tsx`**

`src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

`src/App.tsx`:
```tsx
export default function App() {
  return <div className="p-6 text-xl">Habit Tracker — scaffold OK</div>;
}
```

- [ ] **Step 7: Create `wrangler.jsonc`**

```jsonc
{
  "name": "habit-tracker",
  "main": "worker/index.ts",
  "compatibility_date": "2025-01-01",
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application"
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "habit_tracker",
      "database_id": "PLACEHOLDER_SET_AFTER_D1_CREATE"
    }
  ]
}
```

Note: `database_id` is filled in Task 4 after `wrangler d1 create`. A minimal `worker/index.ts` is added in Task 5; until then `wrangler dev` isn't used — `npm run dev` (Vite) is enough for this task.

- [ ] **Step 8: Create `.gitignore`**

```
node_modules
dist
.wrangler
.dev.vars
.env
.env.*
*.log
```

- [ ] **Step 9: Install and verify dev + build**

Run: `npm install`
Run: `npm run dev` → open the printed localhost URL, confirm "Habit Tracker — scaffold OK" renders. Stop the dev server.
Run: `npm run build`
Expected: `tsc --noEmit` passes and `dist/` is produced with `index.html` + assets.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite react ts tailwind + wrangler config"
```

---

### Task 2: Shared types + IST date helpers (TDD)

**Files:**
- Create: `src/lib/types.ts`, `src/lib/dates.ts`, `test/dates.test.ts`

**Interfaces:**
- Produces `types.ts`:
  - `type HabitKind = 'check' | 'number'`
  - `type GoalDir = 'atLeast' | 'atMost'`
  - `interface Habit { id:number; name:string; emoji:string; color:string; kind:HabitKind; goal:number|null; goal_dir:GoalDir|null; unit:string; sort:number; archived:0|1; created_at:string }`
  - `interface Entry { habit_id:number; date:string; value:number|null; done:0|1 }`
  - `interface Settings { title:string; sprint_on:0|1; sprint_start:string|null; sprint_len_days:number; has_password:boolean }`
  - `interface AppState { habits:Habit[]; entries:Entry[]; settings:Settings }`
- Produces `dates.ts`:
  - `istDateString(d: Date): string` → `'YYYY-MM-DD'` for that instant in IST
  - `istToday(now?: Date): string`
  - `addDays(dateStr: string, n: number): string`
  - `rangeDates(fromStr: string, toStr: string): string[]` (inclusive)

- [ ] **Step 1: Write `src/lib/types.ts`** (exact interfaces from Interfaces block above — no logic, just the types)

- [ ] **Step 2: Write the failing test `test/dates.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { istDateString, addDays, rangeDates } from "../src/lib/dates";

describe("istDateString", () => {
  it("rolls to next IST day after 18:30 UTC", () => {
    // 2026-07-15T19:00:00Z = 2026-07-16 00:30 IST
    expect(istDateString(new Date("2026-07-15T19:00:00Z"))).toBe("2026-07-16");
  });
  it("stays same IST day just before the roll", () => {
    // 2026-07-15T18:29:00Z = 2026-07-15 23:59 IST
    expect(istDateString(new Date("2026-07-15T18:29:00Z"))).toBe("2026-07-15");
  });
  it("handles midnight UTC", () => {
    // 2026-07-15T00:00:00Z = 2026-07-15 05:30 IST
    expect(istDateString(new Date("2026-07-15T00:00:00Z"))).toBe("2026-07-15");
  });
});

describe("addDays", () => {
  it("adds and subtracts across month boundary", () => {
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
    expect(addDays("2026-08-01", -1)).toBe("2026-07-31");
  });
});

describe("rangeDates", () => {
  it("is inclusive on both ends", () => {
    expect(rangeDates("2026-07-14", "2026-07-16")).toEqual([
      "2026-07-14",
      "2026-07-15",
      "2026-07-16",
    ]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run test/dates.test.ts`
Expected: FAIL — module `../src/lib/dates` not found / functions undefined.

- [ ] **Step 4: Write `src/lib/dates.ts`**

```ts
// IST is a fixed +05:30 (no DST). Anchor every boundary on the IST calendar date.
export function istDateString(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function istToday(now: Date = new Date()): string {
  return istDateString(now);
}

// Pure string math on 'YYYY-MM-DD' using a UTC anchor so no local tz leaks in.
export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) + n * 86400000;
  const dt = new Date(t);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function rangeDates(fromStr: string, toStr: string): string[] {
  const out: string[] = [];
  let cur = fromStr;
  while (cur <= toStr) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/dates.test.ts`
Expected: PASS (all cases).

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/dates.ts test/dates.test.ts
git commit -m "feat: shared types + IST date helpers (TDD)"
```

---

### Task 3: Core logic — met/active/perfect/streak/grid (TDD)

**Files:**
- Create: `src/lib/logic.ts`, `test/logic.test.ts`

**Interfaces:**
- Consumes: `Habit`, `Entry` from `types.ts`; `addDays` from `dates.ts`.
- Produces `logic.ts`:
  - `entryKey(habitId:number, date:string): string`
  - `indexEntries(entries: Entry[]): Map<string, Entry>` (key = `entryKey`)
  - `isMet(habit: Habit, entry: Entry | undefined): boolean`
  - `dayStats(habits: Habit[], idx: Map<string,Entry>, date: string): { met: number; total: number; frac: number }` (total = non-archived count)
  - `isActiveDay(habits, idx, date): boolean` (>=1 met)
  - `isPerfectDay(habits, idx, date): boolean` (total>0 and met===total)
  - `computeStreak(habits, idx, today: string): number`
  - `gridBucket(frac: number): 0|1|2|3|4`

- [ ] **Step 1: Write the failing test `test/logic.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import type { Habit, Entry } from "../src/lib/types";
import {
  indexEntries, isMet, dayStats, isPerfectDay, computeStreak, gridBucket,
} from "../src/lib/logic";

const check = (id: number): Habit => ({
  id, name: `c${id}`, emoji: "", color: "#0f0", kind: "check",
  goal: null, goal_dir: null, unit: "", sort: id, archived: 0, created_at: "",
});
const num = (id: number, goal: number, dir: "atLeast" | "atMost"): Habit => ({
  id, name: `n${id}`, emoji: "", color: "#0f0", kind: "number",
  goal, goal_dir: dir, unit: "reps", sort: id, archived: 0, created_at: "",
});
const e = (habit_id: number, date: string, v: Partial<Entry>): Entry => ({
  habit_id, date, value: null, done: 0, ...v,
});

describe("isMet", () => {
  it("check met when done=1", () => {
    expect(isMet(check(1), e(1, "d", { done: 1 }))).toBe(true);
    expect(isMet(check(1), e(1, "d", { done: 0 }))).toBe(false);
    expect(isMet(check(1), undefined)).toBe(false);
  });
  it("number atLeast met when value>=goal", () => {
    expect(isMet(num(2, 50, "atLeast"), e(2, "d", { value: 50 }))).toBe(true);
    expect(isMet(num(2, 50, "atLeast"), e(2, "d", { value: 49 }))).toBe(false);
  });
  it("number atMost met when value<=goal", () => {
    expect(isMet(num(3, 70, "atMost"), e(3, "d", { value: 70 }))).toBe(true);
    expect(isMet(num(3, 70, "atMost"), e(3, "d", { value: 71 }))).toBe(false);
  });
  it("number with no value is not met", () => {
    expect(isMet(num(2, 50, "atLeast"), undefined)).toBe(false);
    expect(isMet(num(2, 50, "atLeast"), e(2, "d", { value: null }))).toBe(false);
  });
});

describe("dayStats / perfect / streak", () => {
  const habits = [check(1), num(2, 5, "atLeast")];
  it("archived habits excluded from total", () => {
    const withArchived = [...habits, { ...check(9), archived: 1 as const }];
    const idx = indexEntries([e(1, "2026-07-15", { done: 1 }), e(2, "2026-07-15", { value: 5 })]);
    const s = dayStats(withArchived, idx, "2026-07-15");
    expect(s.total).toBe(2);
    expect(s.met).toBe(2);
    expect(isPerfectDay(withArchived, idx, "2026-07-15")).toBe(true);
  });
  it("streak counts consecutive perfect days ending today", () => {
    const idx = indexEntries([
      e(1, "2026-07-13", { done: 1 }), e(2, "2026-07-13", { value: 5 }),
      e(1, "2026-07-14", { done: 1 }), e(2, "2026-07-14", { value: 5 }),
      e(1, "2026-07-15", { done: 1 }), e(2, "2026-07-15", { value: 5 }),
    ]);
    expect(computeStreak(habits, idx, "2026-07-15")).toBe(3);
  });
  it("today incomplete does not break streak (counts from yesterday)", () => {
    const idx = indexEntries([
      e(1, "2026-07-13", { done: 1 }), e(2, "2026-07-13", { value: 5 }),
      e(1, "2026-07-14", { done: 1 }), e(2, "2026-07-14", { value: 5 }),
      // today 07-15 not perfect
      e(1, "2026-07-15", { done: 1 }),
    ]);
    expect(computeStreak(habits, idx, "2026-07-15")).toBe(2);
  });
  it("broken chain stops the streak", () => {
    const idx = indexEntries([
      e(1, "2026-07-13", { done: 1 }), e(2, "2026-07-13", { value: 5 }),
      // 07-14 missing entirely
      e(1, "2026-07-15", { done: 1 }), e(2, "2026-07-15", { value: 5 }),
    ]);
    expect(computeStreak(habits, idx, "2026-07-15")).toBe(1);
  });
});

describe("gridBucket", () => {
  it("maps fraction to 0..4", () => {
    expect(gridBucket(0)).toBe(0);
    expect(gridBucket(0.2)).toBe(1);
    expect(gridBucket(0.5)).toBe(2);
    expect(gridBucket(0.75)).toBe(3);
    expect(gridBucket(1)).toBe(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/logic.test.ts`
Expected: FAIL — `../src/lib/logic` not found.

- [ ] **Step 3: Write `src/lib/logic.ts`**

```ts
import type { Habit, Entry } from "./types";
import { addDays } from "./dates";

export function entryKey(habitId: number, date: string): string {
  return `${habitId}|${date}`;
}

export function indexEntries(entries: Entry[]): Map<string, Entry> {
  const m = new Map<string, Entry>();
  for (const e of entries) m.set(entryKey(e.habit_id, e.date), e);
  return m;
}

export function isMet(habit: Habit, entry: Entry | undefined): boolean {
  if (!entry) return false;
  if (habit.kind === "check") return entry.done === 1;
  if (entry.value == null || habit.goal == null) return false;
  return habit.goal_dir === "atMost"
    ? entry.value <= habit.goal
    : entry.value >= habit.goal;
}

function active(habits: Habit[]): Habit[] {
  return habits.filter((h) => h.archived === 0);
}

export function dayStats(
  habits: Habit[], idx: Map<string, Entry>, date: string
): { met: number; total: number; frac: number } {
  const list = active(habits);
  let met = 0;
  for (const h of list) if (isMet(h, idx.get(entryKey(h.id, date)))) met++;
  const total = list.length;
  return { met, total, frac: total === 0 ? 0 : met / total };
}

export function isActiveDay(habits: Habit[], idx: Map<string, Entry>, date: string): boolean {
  return dayStats(habits, idx, date).met > 0;
}

export function isPerfectDay(habits: Habit[], idx: Map<string, Entry>, date: string): boolean {
  const s = dayStats(habits, idx, date);
  return s.total > 0 && s.met === s.total;
}

export function computeStreak(habits: Habit[], idx: Map<string, Entry>, today: string): number {
  let streak = 0;
  // If today isn't perfect yet, start counting from yesterday (today in progress).
  let cur = isPerfectDay(habits, idx, today) ? today : addDays(today, -1);
  while (isPerfectDay(habits, idx, cur)) {
    streak++;
    cur = addDays(cur, -1);
  }
  return streak;
}

export function gridBucket(frac: number): 0 | 1 | 2 | 3 | 4 {
  if (frac <= 0) return 0;
  if (frac >= 1) return 4;
  if (frac < 0.34) return 1;
  if (frac < 0.67) return 2;
  return 3;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/logic.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/logic.ts test/logic.test.ts
git commit -m "feat: core habit logic met/perfect/streak/grid (TDD)"
```

---

### Task 4: D1 schema + seed + create database

**Files:**
- Create: `schema.sql`, `seed.sql`
- Modify: `wrangler.jsonc` (fill `database_id`)

**Interfaces:**
- Produces a local D1 named `habit_tracker` with the §5 tables and seed rows; `settings.edit_password_hash` is NULL.

- [ ] **Step 1: Write `schema.sql`** (verbatim from spec §5 — the three `CREATE TABLE` statements for `habits`, `entries`, `settings`). Prefix each with `DROP TABLE IF EXISTS ...;` so re-applying locally is idempotent.

```sql
DROP TABLE IF EXISTS entries;
DROP TABLE IF EXISTS habits;
DROP TABLE IF EXISTS settings;

CREATE TABLE habits (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  emoji      TEXT    NOT NULL DEFAULT '',
  color      TEXT    NOT NULL DEFAULT '#22c55e',
  kind       TEXT    NOT NULL CHECK (kind IN ('check','number')),
  goal       REAL,
  goal_dir   TEXT    CHECK (goal_dir IN ('atLeast','atMost')),
  unit       TEXT    NOT NULL DEFAULT '',
  sort       INTEGER NOT NULL DEFAULT 0,
  archived   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL
);

CREATE TABLE entries (
  habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date     TEXT    NOT NULL,
  value    REAL,
  done     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (habit_id, date)
);

CREATE TABLE settings (
  id                 INTEGER PRIMARY KEY CHECK (id = 1),
  title              TEXT    NOT NULL DEFAULT '12 Week Sprint',
  sprint_on          INTEGER NOT NULL DEFAULT 0,
  sprint_start       TEXT,
  sprint_len_days    INTEGER NOT NULL DEFAULT 84,
  edit_password_hash TEXT
);
```

- [ ] **Step 2: Write `seed.sql`** (the §10 habits + the single settings row; password NULL)

```sql
INSERT INTO habits (name, emoji, color, kind, goal, goal_dir, unit, sort, created_at) VALUES
  ('YouTube video',   '🎬', '#ef4444', 'check',  NULL, NULL,      '',     0, '2026-07-15'),
  ('LinkedIn post',   '💼', '#3b82f6', 'check',  NULL, NULL,      '',     1, '2026-07-15'),
  ('Exercise',        '🏋️', '#22c55e', 'check',  NULL, NULL,      '',     2, '2026-07-15'),
  ('Learn something', '📚', '#a855f7', 'check',  NULL, NULL,      '',     3, '2026-07-15'),
  ('Agency work',     '🚀', '#f59e0b', 'check',  NULL, NULL,      '',     4, '2026-07-15'),
  ('Pushups',         '💪', '#14b8a6', 'number', 50,   'atLeast', 'reps', 5, '2026-07-15'),
  ('Upwork outreach', '📨', '#06b6d4', 'number', 5,    'atLeast', '',     6, '2026-07-15'),
  ('Morning run',     '🏃', '#84cc16', 'number', 3,    'atLeast', 'km',   7, '2026-07-15');

INSERT INTO settings (id, title, sprint_on, sprint_len_days) VALUES
  (1, '12 Week Sprint', 0, 84);
```

- [ ] **Step 3: Create the D1 database**

Run: `npx wrangler d1 create habit_tracker`
Expected: prints a `database_id`. Copy it.

- [ ] **Step 4: Fill `database_id` in `wrangler.jsonc`** — replace `PLACEHOLDER_SET_AFTER_D1_CREATE` with the printed id.

- [ ] **Step 5: Apply schema + seed locally and verify**

Run: `npm run db:local`
Run: `npx wrangler d1 execute habit_tracker --local --command "SELECT count(*) AS n FROM habits;"`
Expected: `n = 8`.
Run: `npx wrangler d1 execute habit_tracker --local --command "SELECT edit_password_hash FROM settings WHERE id=1;"`
Expected: NULL.

- [ ] **Step 6: Commit**

```bash
git add schema.sql seed.sql wrangler.jsonc
git commit -m "feat: D1 schema + seed habits"
```

---

### Task 5: Auth utilities (TDD) + Worker skeleton serving public GET /api/state

**Files:**
- Create: `worker/auth.ts`, `worker/db.ts`, `worker/routes.ts`, `worker/index.ts`, `test/auth.test.ts`

**Interfaces:**
- Consumes: `Habit`, `Entry`, `Settings`, `AppState` from `src/lib/types.ts`.
- Produces `auth.ts`:
  - `sha256Hex(input: string): Promise<string>` (lowercase hex)
  - `verifyPassword(input: string, storedHash: string | null): Promise<boolean>` (false if storedHash null/empty)
- Produces `db.ts`:
  - `type Env = { DB: D1Database; ASSETS: Fetcher }`
  - `getState(env: Env, from: string, to: string): Promise<AppState>` (settings.has_password derived; hash never returned)
- Produces `routes.ts`:
  - `handleApi(request: Request, env: Env): Promise<Response>` — routes `/api/*`, returns 404 Response for unmatched.
- Produces `index.ts`:
  - default `fetch(request, env)` — `/api/*` → `handleApi`, else `env.ASSETS.fetch(request)`.

- [ ] **Step 1: Write the failing test `test/auth.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { sha256Hex, verifyPassword } from "../worker/auth";

describe("sha256Hex", () => {
  it("returns 64-char lowercase hex", async () => {
    const h = await sha256Hex("hello");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    // known SHA-256 of "hello"
    expect(h).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });
});

describe("verifyPassword", () => {
  it("true when input hashes to storedHash", async () => {
    const stored = await sha256Hex("9876543210");
    expect(await verifyPassword("9876543210", stored)).toBe(true);
    expect(await verifyPassword("wrong", stored)).toBe(false);
  });
  it("false when no password set", async () => {
    expect(await verifyPassword("anything", null)).toBe(false);
    expect(await verifyPassword("anything", "")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/auth.test.ts`
Expected: FAIL — `../worker/auth` not found.

- [ ] **Step 3: Write `worker/auth.ts`**

```ts
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPassword(input: string, storedHash: string | null): Promise<boolean> {
  if (!storedHash) return false;
  return (await sha256Hex(input)) === storedHash;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/auth.test.ts`
Expected: PASS.

- [ ] **Step 5: Write `worker/db.ts`**

```ts
import type { Habit, Entry, Settings, AppState } from "../src/lib/types";

export type Env = { DB: D1Database; ASSETS: Fetcher };

export async function getState(env: Env, from: string, to: string): Promise<AppState> {
  const habits = (await env.DB.prepare(
    "SELECT * FROM habits ORDER BY sort ASC, id ASC"
  ).all<Habit>()).results;

  const entries = (await env.DB.prepare(
    "SELECT habit_id, date, value, done FROM entries WHERE date >= ? AND date <= ?"
  ).bind(from, to).all<Entry>()).results;

  const row = await env.DB.prepare(
    "SELECT title, sprint_on, sprint_start, sprint_len_days, edit_password_hash FROM settings WHERE id=1"
  ).first<Settings & { edit_password_hash: string | null }>();

  const settings: Settings = {
    title: row?.title ?? "12 Week Sprint",
    sprint_on: (row?.sprint_on ?? 0) as 0 | 1,
    sprint_start: row?.sprint_start ?? null,
    sprint_len_days: row?.sprint_len_days ?? 84,
    has_password: !!row?.edit_password_hash,
  };

  return { habits, entries, settings };
}
```

- [ ] **Step 6: Write `worker/routes.ts` (state route only for now)**

```ts
import type { Env } from "./db";
import { getState } from "./db";
import { istToday } from "../src/lib/dates";
import { addDays } from "../src/lib/dates";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

export async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === "GET" && path === "/api/state") {
    const today = istToday();
    const from = url.searchParams.get("from") ?? addDays(today, -119);
    const to = url.searchParams.get("to") ?? today;
    return json(await getState(env, from, to));
  }

  return json({ error: "not found" }, 404);
}
```

- [ ] **Step 7: Write `worker/index.ts`**

```ts
import type { Env } from "./db";
import { handleApi } from "./routes";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return handleApi(request, env);
    return env.ASSETS.fetch(request);
  },
};
```

- [ ] **Step 8: Verify the API against local D1 (real walk)**

Run: `npm run build` (needs `dist/` for the assets binding to boot)
Run (background): `npx wrangler dev`
Run: `curl "http://localhost:8787/api/state"`
Expected: JSON with 8 habits, `settings.has_password=false`, and NO `edit_password_hash` field anywhere.
Stop `wrangler dev`.

- [ ] **Step 9: Commit**

```bash
git add worker/ test/auth.test.ts
git commit -m "feat: worker skeleton + public GET /api/state + auth utils (TDD)"
```

---

### Task 6: Write endpoints — auth-gated habits, entries, settings, password set/change

**Files:**
- Modify: `worker/routes.ts`, `worker/db.ts`
- Create: `test/api.smoke.md`

**Interfaces:**
- Consumes: `verifyPassword`, `sha256Hex` from `auth.ts`; `getState` from `db.ts`.
- Produces in `db.ts`: `createHabit`, `updateHabit`, `deleteHabit`, `upsertEntry`, `updateSettings`, `setPassword` (see code).
- Produces in `routes.ts`: gated routes below. Gate = read `Authorization: Bearer <pw>`, `verifyPassword` against current `edit_password_hash`; on fail → 401. Special first-run rule for `auth/set`.

Routes:
- `POST /api/auth/verify` — body `{password}` → `{ok:boolean}` (no gate; just checks).
- `POST /api/auth/set` — body `{newPassword, currentPassword?}`. If no password set, allow. Else require valid `currentPassword`. → `{ok:true}` or 401.
- `POST /api/habits` (gated) — body `Partial<Habit>` (name, emoji, color, kind, goal, goal_dir, unit) → `{id}`.
- `PATCH /api/habits/:id` (gated) — body partial fields → `{ok:true}`.
- `DELETE /api/habits/:id` (gated) → `{ok:true}`.
- `PUT /api/entries` (gated) — body `{habit_id, date, value?, done?}` upsert → `{ok:true}`.
- `PATCH /api/settings` (gated) — body `{title?, sprint_on?, sprint_start?, sprint_len_days?}` → `{ok:true}`.

- [ ] **Step 1: Add DB helpers to `worker/db.ts`**

```ts
import { sha256Hex } from "./auth";
import type { Habit, Entry } from "../src/lib/types";

export async function currentHash(env: Env): Promise<string | null> {
  const r = await env.DB.prepare("SELECT edit_password_hash h FROM settings WHERE id=1")
    .first<{ h: string | null }>();
  return r?.h ?? null;
}

export async function createHabit(env: Env, b: Partial<Habit>): Promise<number> {
  const r = await env.DB.prepare(
    `INSERT INTO habits (name,emoji,color,kind,goal,goal_dir,unit,sort,created_at)
     VALUES (?,?,?,?,?,?,?,?,?) RETURNING id`
  ).bind(
    b.name ?? "New habit", b.emoji ?? "", b.color ?? "#22c55e",
    b.kind ?? "check", b.goal ?? null, b.goal_dir ?? null,
    b.unit ?? "", b.sort ?? 0, new Date().toISOString().slice(0, 10)
  ).first<{ id: number }>();
  return r!.id;
}

const HABIT_FIELDS = ["name","emoji","color","kind","goal","goal_dir","unit","sort","archived"] as const;

export async function updateHabit(env: Env, id: number, b: Record<string, unknown>): Promise<void> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const f of HABIT_FIELDS) if (f in b) { sets.push(`${f}=?`); vals.push(b[f]); }
  if (!sets.length) return;
  vals.push(id);
  await env.DB.prepare(`UPDATE habits SET ${sets.join(",")} WHERE id=?`).bind(...vals).run();
}

export async function deleteHabit(env: Env, id: number): Promise<void> {
  await env.DB.prepare("DELETE FROM habits WHERE id=?").bind(id).run();
}

export async function upsertEntry(env: Env, e: Entry): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO entries (habit_id,date,value,done) VALUES (?,?,?,?)
     ON CONFLICT(habit_id,date) DO UPDATE SET value=excluded.value, done=excluded.done`
  ).bind(e.habit_id, e.date, e.value ?? null, e.done ?? 0).run();
}

const SETTINGS_FIELDS = ["title","sprint_on","sprint_start","sprint_len_days"] as const;

export async function updateSettings(env: Env, b: Record<string, unknown>): Promise<void> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const f of SETTINGS_FIELDS) if (f in b) { sets.push(`${f}=?`); vals.push(b[f]); }
  if (!sets.length) return;
  await env.DB.prepare(`UPDATE settings SET ${sets.join(",")} WHERE id=1`).bind(...vals).run();
}

export async function setPassword(env: Env, newPassword: string): Promise<void> {
  const hash = await sha256Hex(newPassword);
  await env.DB.prepare("UPDATE settings SET edit_password_hash=? WHERE id=1").bind(hash).run();
}
```

- [ ] **Step 2: Rewrite `worker/routes.ts` with all routes + gate**

```ts
import type { Env } from "./db";
import {
  getState, currentHash, createHabit, updateHabit, deleteHabit,
  upsertEntry, updateSettings, setPassword,
} from "./db";
import { verifyPassword } from "./auth";
import { istToday, addDays } from "../src/lib/dates";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

function bearer(request: Request): string {
  const h = request.headers.get("authorization") ?? "";
  return h.startsWith("Bearer ") ? h.slice(7) : "";
}

async function gate(request: Request, env: Env): Promise<boolean> {
  return verifyPassword(bearer(request), await currentHash(env));
}

export async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // public read
  if (method === "GET" && path === "/api/state") {
    const today = istToday();
    const from = url.searchParams.get("from") ?? addDays(today, -119);
    const to = url.searchParams.get("to") ?? today;
    return json(await getState(env, from, to));
  }

  // verify (no gate)
  if (method === "POST" && path === "/api/auth/verify") {
    const { password } = await request.json<{ password: string }>();
    return json({ ok: await verifyPassword(password, await currentHash(env)) });
  }

  // set/change password
  if (method === "POST" && path === "/api/auth/set") {
    const { newPassword, currentPassword } = await request.json<{ newPassword: string; currentPassword?: string }>();
    if (!newPassword) return json({ error: "newPassword required" }, 400);
    const existing = await currentHash(env);
    if (existing && !(await verifyPassword(currentPassword ?? "", existing))) {
      return json({ error: "wrong current password" }, 401);
    }
    await setPassword(env, newPassword);
    return json({ ok: true });
  }

  // everything below is gated
  if (!(await gate(request, env))) return json({ error: "unauthorized" }, 401);

  if (method === "POST" && path === "/api/habits") {
    const id = await createHabit(env, await request.json());
    return json({ id });
  }

  const habitMatch = path.match(/^\/api\/habits\/(\d+)$/);
  if (habitMatch) {
    const id = Number(habitMatch[1]);
    if (method === "PATCH") { await updateHabit(env, id, await request.json()); return json({ ok: true }); }
    if (method === "DELETE") { await deleteHabit(env, id); return json({ ok: true }); }
  }

  if (method === "PUT" && path === "/api/entries") {
    await upsertEntry(env, await request.json());
    return json({ ok: true });
  }

  if (method === "PATCH" && path === "/api/settings") {
    await updateSettings(env, await request.json());
    return json({ ok: true });
  }

  return json({ error: "not found" }, 404);
}
```

- [ ] **Step 3: Write `test/api.smoke.md`** — a scripted curl walk to run against `npx wrangler dev` (rebuild `dist` first). Document exact commands + expected output:

```md
# API smoke (run vs `npm run build` then `npx wrangler dev`)

1. Reset local DB: `npm run db:local`
2. State is public:
   `curl -s localhost:8787/api/state | jq '.habits | length'` → 8
3. Write rejected before a password exists AND gate fails (no hash):
   `curl -s -X PUT localhost:8787/api/entries -H 'authorization: Bearer x' -d '{"habit_id":1,"date":"2026-07-15","done":1}'`
   → `{"error":"unauthorized"}` (no password set yet → verify false)
4. First-run set password (no current needed):
   `curl -s -X POST localhost:8787/api/auth/set -d '{"newPassword":"9876543210"}'` → `{"ok":true}`
5. Verify:
   `curl -s -X POST localhost:8787/api/auth/verify -d '{"password":"9876543210"}'` → `{"ok":true}`
   `curl -s -X POST localhost:8787/api/auth/verify -d '{"password":"nope"}'` → `{"ok":false}`
6. Gated write now works with bearer:
   `curl -s -X PUT localhost:8787/api/entries -H 'authorization: Bearer 9876543210' -d '{"habit_id":1,"date":"2026-07-15","done":1}'` → `{"ok":true}`
7. Upsert idempotent (same call again) → `{"ok":true}`, and:
   `curl -s "localhost:8787/api/state" | jq '.entries | map(select(.habit_id==1 and .date=="2026-07-15")) | length'` → 1
8. Change password requires correct current:
   `curl -s -X POST localhost:8787/api/auth/set -d '{"newPassword":"1111","currentPassword":"wrong"}'` → 401
   `curl -s -X POST localhost:8787/api/auth/set -d '{"newPassword":"1111","currentPassword":"9876543210"}'` → `{"ok":true}`
9. state never leaks the hash:
   `curl -s localhost:8787/api/state | grep -i edit_password_hash` → (no output)
```

- [ ] **Step 4: Execute the smoke walk**

Run the steps in `test/api.smoke.md` against `npx wrangler dev`. All expected outputs must match. Then reset: `npm run db:local` (clears the test password/entries).

- [ ] **Step 5: Commit**

```bash
git add worker/ test/api.smoke.md
git commit -m "feat: gated write API (habits/entries/settings) + password set/change"
```

---

### Task 7: Frontend API client + edit-mode store

**Files:**
- Create: `src/lib/api.ts`, `src/lib/editmode.ts`

**Interfaces:**
- Consumes: `AppState`, `Habit`, `Entry` from `types.ts`.
- Produces `api.ts`:
  - `fetchState(): Promise<AppState>`
  - `verify(password:string): Promise<boolean>`
  - `setPassword(newPassword:string, currentPassword?:string): Promise<void>` (throws on non-ok)
  - `createHabit(pw:string, h:Partial<Habit>): Promise<number>`
  - `updateHabit(pw:string, id:number, patch:Partial<Habit>): Promise<void>`
  - `deleteHabit(pw:string, id:number): Promise<void>`
  - `putEntry(pw:string, e:Entry): Promise<void>`
  - `updateSettings(pw:string, patch:Record<string,unknown>): Promise<void>`
- Produces `editmode.ts`:
  - `getPw(): string | null` / `setPw(pw:string): void` / `clearPw(): void` (localStorage key `ht_pw`).

- [ ] **Step 1: Write `src/lib/editmode.ts`**

```ts
const KEY = "ht_pw";
export const getPw = (): string | null => localStorage.getItem(KEY);
export const setPw = (pw: string): void => localStorage.setItem(KEY, pw);
export const clearPw = (): void => localStorage.removeItem(KEY);
```

- [ ] **Step 2: Write `src/lib/api.ts`**

```ts
import type { AppState, Habit, Entry } from "./types";

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...opts,
    headers: { "content-type": "application/json", ...(opts.headers ?? {}) },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
  return res.json() as Promise<T>;
}
const auth = (pw: string) => ({ authorization: `Bearer ${pw}` });

export const fetchState = () => req<AppState>("/api/state");

export const verify = (password: string) =>
  req<{ ok: boolean }>("/api/auth/verify", { method: "POST", body: JSON.stringify({ password }) }).then((r) => r.ok);

export const setPassword = (newPassword: string, currentPassword?: string) =>
  req<{ ok: true }>("/api/auth/set", { method: "POST", body: JSON.stringify({ newPassword, currentPassword }) }).then(() => {});

export const createHabit = (pw: string, h: Partial<Habit>) =>
  req<{ id: number }>("/api/habits", { method: "POST", headers: auth(pw), body: JSON.stringify(h) }).then((r) => r.id);

export const updateHabit = (pw: string, id: number, patch: Partial<Habit>) =>
  req(`/api/habits/${id}`, { method: "PATCH", headers: auth(pw), body: JSON.stringify(patch) }).then(() => {});

export const deleteHabit = (pw: string, id: number) =>
  req(`/api/habits/${id}`, { method: "DELETE", headers: auth(pw) }).then(() => {});

export const putEntry = (pw: string, e: Entry) =>
  req("/api/entries", { method: "PUT", headers: auth(pw), body: JSON.stringify(e) }).then(() => {});

export const updateSettings = (pw: string, patch: Record<string, unknown>) =>
  req("/api/settings", { method: "PATCH", headers: auth(pw), body: JSON.stringify(patch) }).then(() => {});
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api.ts src/lib/editmode.ts
git commit -m "feat: frontend api client + edit-mode store"
```

---

### Task 8: App shell — load state, edit-mode, layout skeleton

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `fetchState`, edit-mode store, `types`, `logic`, `dates`.
- Produces: `App` renders live data; provides `pw` (edit-mode password or null), `reload()`, and passes them to child components (added in later tasks). For this task, render Header placeholder + raw counts so the wiring is verifiable.

- [ ] **Step 1: Rewrite `src/App.tsx`**

```tsx
import { useEffect, useState, useCallback } from "react";
import type { AppState } from "./lib/types";
import { fetchState } from "./lib/api";
import { getPw } from "./lib/editmode";
import { istToday } from "./lib/dates";
import { indexEntries, computeStreak } from "./lib/logic";

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [pw, setPwState] = useState<string | null>(getPw());

  const reload = useCallback(() => { fetchState().then(setState); }, []);
  useEffect(() => { reload(); }, [reload]);

  if (!state) return <div className="p-6">Loading…</div>;

  const today = istToday();
  const idx = indexEntries(state.entries);
  const streak = computeStreak(state.habits, idx, today);

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <h1 className="text-2xl font-bold">{state.settings.title}</h1>
      <p className="mt-2 text-sm text-neutral-400">
        {state.habits.length} habits · streak {streak}d ·
        {pw ? " edit mode ON" : " read-only"}
      </p>
      {/* Header, Grid, Today, charts, Manage, Settings wired in later tasks */}
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser (real walk)**

Run: `npm run build && npx wrangler dev` (D1 seeded via `npm run db:local` if not already).
Open `localhost:8787`, confirm title "12 Week Sprint", "8 habits · streak 0d · read-only".
Stop server.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: app shell loads live state + edit-mode flag"
```

---

### Task 9: Header component — stats + sprint bar + lock/unlock

**Files:**
- Create: `src/components/Header.tsx`, `src/components/LoginModal.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `AppState`, `logic` (streak, perfect/active counts), `dates`, `api.verify`, edit-mode store.
- Produces `Header({ state, pw, onUnlock, onLock })`:
  - stat chips: streak (days), perfect (count of perfect days in range), active (count of active days in range).
  - if `settings.sprint_on && sprint_start`: compute `dayNum = daysBetween(sprint_start, today)+1`, clamp to `[1, sprint_len_days]`; render "Day N / len" + a progress bar.
  - Lock/Unlock button: if `pw` → "Lock" (calls `onLock`); else "Unlock" → opens `LoginModal`.
- Produces `LoginModal({ onClose, onSuccess })`: password input → `verify()`; on true call `onSuccess(pw)`, else show error. If `!state.settings.has_password`, this modal switches to a "set password" form calling `setPassword(newPw)`.

- [ ] **Step 1: Write `src/components/LoginModal.tsx`**

```tsx
import { useState } from "react";
import { verify, setPassword } from "../lib/api";

export function LoginModal({
  hasPassword, onClose, onSuccess,
}: { hasPassword: boolean; onClose: () => void; onSuccess: (pw: string) => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");

  async function submit() {
    setErr("");
    if (!hasPassword) {
      if (pw.length < 4) return setErr("Choose at least 4 characters.");
      await setPassword(pw);
      return onSuccess(pw);
    }
    if (await verify(pw)) onSuccess(pw);
    else setErr("Wrong password.");
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-neutral-900 p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">{hasPassword ? "Unlock editing" : "Set an edit password"}</h2>
        <input
          type="password" autoFocus value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={hasPassword ? "Password" : "New password (your mobile number)"}
          className="mt-3 w-full rounded-lg bg-neutral-800 px-3 py-2 outline-none"
        />
        {err && <p className="mt-2 text-sm text-red-400">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-neutral-400">Cancel</button>
          <button onClick={submit} className="rounded-lg bg-green-600 px-3 py-1.5 font-medium">
            {hasPassword ? "Unlock" : "Set"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `src/components/Header.tsx`**

```tsx
import type { AppState } from "../lib/types";
import { rangeDates, addDays, istToday } from "../lib/dates";
import { indexEntries, computeStreak, isPerfectDay, isActiveDay } from "../lib/logic";

function daysBetween(a: string, b: string): number {
  let n = 0, cur = a;
  while (cur < b) { cur = addDays(cur, 1); n++; }
  return n;
}

export function Header({
  state, pw, onLock, onUnlockClick,
}: { state: AppState; pw: string | null; onLock: () => void; onUnlockClick: () => void }) {
  const today = istToday();
  const idx = indexEntries(state.entries);
  const from = state.settings.sprint_on && state.settings.sprint_start
    ? state.settings.sprint_start : addDays(today, -119);
  const days = rangeDates(from, today);
  const streak = computeStreak(state.habits, idx, today);
  const perfect = days.filter((d) => isPerfectDay(state.habits, idx, d)).length;
  const activeN = days.filter((d) => isActiveDay(state.habits, idx, d)).length;

  const sprint = state.settings.sprint_on && state.settings.sprint_start
    ? Math.min(Math.max(daysBetween(state.settings.sprint_start, today) + 1, 1), state.settings.sprint_len_days)
    : null;

  const Chip = ({ label, value }: { label: string; value: string | number }) => (
    <div className="text-right">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );

  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">{state.settings.title}</h1>
        {sprint !== null && (
          <div className="mt-1">
            <div className="text-sm text-neutral-400">Day {sprint} / {state.settings.sprint_len_days}</div>
            <div className="mt-1 h-1.5 w-48 overflow-hidden rounded bg-neutral-800">
              <div className="h-full bg-green-500" style={{ width: `${(sprint / state.settings.sprint_len_days) * 100}%` }} />
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-5">
        <Chip label="Streak" value={`${streak}d`} />
        <Chip label="Perfect" value={perfect} />
        <Chip label="Active" value={activeN} />
        <button
          onClick={pw ? onLock : onUnlockClick}
          className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm">
          {pw ? "🔓 Lock" : "🔒 Unlock"}
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Wire into `src/App.tsx`** — add modal state + handlers; replace the placeholder `<p>` with `<Header>`:

```tsx
// add imports
import { Header } from "./components/Header";
import { LoginModal } from "./components/LoginModal";
import { setPw as savePw, clearPw } from "./lib/editmode";
// inside App(), add:
const [showLogin, setShowLogin] = useState(false);
function onUnlockSuccess(p: string) { savePw(p); setPwState(p); setShowLogin(false); reload(); }
function onLock() { clearPw(); setPwState(null); }
// in JSX, replace the <h1>+<p> block with:
<Header state={state} pw={pw} onLock={onLock} onUnlockClick={() => setShowLogin(true)} />
{showLogin && (
  <LoginModal hasPassword={state.settings.has_password}
    onClose={() => setShowLogin(false)} onSuccess={onUnlockSuccess} />
)}
```

- [ ] **Step 4: Verify in browser**

Rebuild + `wrangler dev`. Reset DB first (`npm run db:local`) so no password is set.
- Click Unlock → modal says "Set an edit password" → set `9876543210` → button flips to "🔓 Lock", header shows edit mode.
- Reload page → still unlocked (localStorage). Click Lock → back to read-only.
- Click Unlock again → now says "Unlock editing" → wrong password shows error, correct one unlocks.
Reset DB afterward.

- [ ] **Step 5: Commit**

```bash
git add src/components/Header.tsx src/components/LoginModal.tsx src/App.tsx
git commit -m "feat: header stats + sprint bar + login/lock flow"
```

---

### Task 10: Grid component (GitHub-style SVG)

**Files:**
- Create: `src/components/Grid.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `AppState`, `dates` (range), `logic` (`dayStats`, `gridBucket`).
- Produces `Grid({ state, from, to })`: renders an SVG heatmap, weekday rows (7) × week columns, each cell filled by bucket color (0 = `#1f1f1f`; 1-4 = greens). Title tooltip per cell = `${date}: ${met}/${total}`.

- [ ] **Step 1: Write `src/components/Grid.tsx`**

```tsx
import type { AppState } from "../lib/types";
import { rangeDates } from "../lib/dates";
import { indexEntries, dayStats, gridBucket } from "../lib/logic";

const SHADES = ["#1f1f1f", "#0e4429", "#006d32", "#26a641", "#39d353"];
const CELL = 13, GAP = 3;

export function Grid({ state, from, to }: { state: AppState; from: string; to: string }) {
  const idx = indexEntries(state.entries);
  const days = rangeDates(from, to);
  // column = week index, row = weekday (0=Sun). Offset first column by start weekday.
  const startDow = new Date(`${from}T00:00:00Z`).getUTCDay();
  const cells = days.map((d, i) => {
    const pos = i + startDow;
    const col = Math.floor(pos / 7);
    const row = pos % 7;
    const s = dayStats(state.habits, idx, d);
    return { d, col, row, bucket: gridBucket(s.frac), met: s.met, total: s.total };
  });
  const cols = Math.max(...cells.map((c) => c.col)) + 1;
  const width = cols * (CELL + GAP);
  const height = 7 * (CELL + GAP);

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} className="mt-2">
        {cells.map((c) => (
          <rect
            key={c.d} x={c.col * (CELL + GAP)} y={c.row * (CELL + GAP)}
            width={CELL} height={CELL} rx={2} fill={SHADES[c.bucket]}>
            <title>{`${c.d}: ${c.met}/${c.total}`}</title>
          </rect>
        ))}
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Wire into `src/App.tsx`** — compute `from`/`to` (sprint-aware, same as Header) once in App and pass to both Header and Grid; render `<Grid>` under a "The grid" heading.

```tsx
import { Grid } from "./components/Grid";
// in App(), after computing today:
const from = state.settings.sprint_on && state.settings.sprint_start
  ? state.settings.sprint_start : addDays(today, -119);
// in JSX after <Header/>:
<section className="mt-6">
  <h2 className="mb-1 text-sm font-medium text-neutral-400">The grid</h2>
  <Grid state={state} from={from} to={today} />
</section>
```
(Import `addDays` in App.)

- [ ] **Step 3: Verify in browser**

Rebuild + dev. Unlock, tick a couple of habits for today (temporary — or via curl), reload; confirm today's cell brightens by completion fraction and the tooltip shows `met/total`. Confirm horizontal scroll on narrow (mobile) viewport, no page-level horizontal overflow.

- [ ] **Step 4: Commit**

```bash
git add src/components/Grid.tsx src/App.tsx
git commit -m "feat: github-style completion grid (svg)"
```

---

### Task 11: Today checklist (check toggle + number input)

**Files:**
- Create: `src/components/Today.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `AppState`, `pw`, `putEntry`, `logic.isMet`, `dates.istToday`, `reload`.
- Produces `Today({ state, pw, onChanged })`: lists non-archived habits. For `check`, a toggle button writes `{done: 0/1}`. For `number`, a numeric input writes `{value}` on change/blur; row shows "met" styling when `isMet`. All writes disabled (inputs read-only, buttons noop with a hint) when `pw` is null. After a successful write, call `onChanged()` (App's `reload`).

- [ ] **Step 1: Write `src/components/Today.tsx`**

```tsx
import { useState } from "react";
import type { AppState, Entry } from "../lib/types";
import { istToday } from "../lib/dates";
import { indexEntries, isMet, entryKey } from "../lib/logic";
import { putEntry } from "../lib/api";

export function Today({ state, pw, onChanged }: { state: AppState; pw: string | null; onChanged: () => void }) {
  const today = istToday();
  const idx = indexEntries(state.entries);
  const [busy, setBusy] = useState<number | null>(null);
  const habits = state.habits.filter((h) => h.archived === 0);
  const doneCount = habits.filter((h) => isMet(h, idx.get(entryKey(h.id, today)))).length;

  async function write(e: Entry) {
    if (!pw) return;
    setBusy(e.habit_id);
    try { await putEntry(pw, e); onChanged(); } finally { setBusy(null); }
  }

  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium text-neutral-400">Today</h2>
        <span className="text-xs text-neutral-500">{doneCount}/{habits.length} done</span>
      </div>
      <ul className="space-y-2">
        {habits.map((h) => {
          const entry = idx.get(entryKey(h.id, today));
          const met = isMet(h, entry);
          return (
            <li key={h.id}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${met ? "border-green-700 bg-green-950/40" : "border-neutral-800 bg-neutral-900"}`}>
              <span className="text-lg">{h.emoji}</span>
              <span className="flex-1">{h.name}</span>
              {h.kind === "check" ? (
                <button
                  disabled={!pw || busy === h.id}
                  onClick={() => write({ habit_id: h.id, date: today, value: null, done: met ? 0 : 1 })}
                  className={`grid h-7 w-7 place-items-center rounded-full ${met ? "bg-green-500 text-black" : "bg-neutral-700"} disabled:opacity-40`}>
                  {met ? "✓" : ""}
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <input
                    type="number" inputMode="decimal" readOnly={!pw}
                    defaultValue={entry?.value ?? ""}
                    onBlur={(ev) => {
                      const v = ev.target.value === "" ? null : Number(ev.target.value);
                      write({ habit_id: h.id, date: today, value: v, done: 0 });
                    }}
                    className="w-20 rounded-lg bg-neutral-800 px-2 py-1 text-right outline-none disabled:opacity-40"
                  />
                  <span className="w-10 text-xs text-neutral-500">{h.unit}</span>
                  <span className="w-16 text-xs text-neutral-500">/ {h.goal}{h.goal_dir === "atMost" ? " max" : ""}</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {!pw && <p className="mt-2 text-xs text-neutral-600">Unlock to edit.</p>}
    </section>
  );
}
```

- [ ] **Step 2: Wire into `src/App.tsx`** — render `<Today state={state} pw={pw} onChanged={reload} />` after the Grid section.

- [ ] **Step 3: Verify in browser (the core user path)**

Rebuild + dev, DB seeded, unlock.
- Tick "YouTube video" → circle fills green, row highlights, "done" count rises, grid cell brightens on reload.
- Type `50` into Pushups → row goes met (goal ≥50); type `49` → not met.
- Lock → inputs read-only, toggle disabled, "Unlock to edit" shows.
Confirm at mobile width too.

- [ ] **Step 4: Commit**

```bash
git add src/components/Today.tsx src/App.tsx
git commit -m "feat: today checklist with check + number entry"
```

---

### Task 12: Number-habit trend charts (SVG)

**Files:**
- Create: `src/components/NumberChart.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `Habit`, `Entry[]`, `dates.rangeDates`.
- Produces `NumberChart({ habit, entries, from, to })`: an SVG line chart of that habit's values across the range with a dashed goal line and habit color. Missing days are gaps (no point). Renders nothing if the habit has <2 values.

- [ ] **Step 1: Write `src/components/NumberChart.tsx`**

```tsx
import type { Habit, Entry } from "../lib/types";
import { rangeDates } from "../lib/dates";

const W = 320, H = 90, PAD = 8;

export function NumberChart({ habit, entries, from, to }: { habit: Habit; entries: Entry[]; from: string; to: string }) {
  const days = rangeDates(from, to);
  const byDate = new Map(entries.filter((e) => e.habit_id === habit.id && e.value != null).map((e) => [e.date, e.value as number]));
  const pts = days.map((d, i) => ({ i, v: byDate.get(d) })).filter((p) => p.v != null) as { i: number; v: number }[];
  if (pts.length < 2) return null;

  const vals = pts.map((p) => p.v).concat(habit.goal ?? []);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i: number) => PAD + (i / (days.length - 1)) * (W - 2 * PAD);
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - 2 * PAD);
  const path = pts.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const goalY = habit.goal != null ? y(habit.goal) : null;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3">
      <div className="mb-1 text-xs text-neutral-400">{habit.emoji} {habit.name} <span className="text-neutral-600">({habit.unit})</span></div>
      <svg width={W} height={H} className="w-full">
        {goalY != null && <line x1={PAD} y1={goalY} x2={W - PAD} y2={goalY} stroke="#6b7280" strokeDasharray="4 3" />}
        <path d={path} fill="none" stroke={habit.color} strokeWidth={2} />
        {pts.map((p) => <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r={2.5} fill={habit.color} />)}
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Wire into `src/App.tsx`** — render a responsive grid of `<NumberChart>` for each non-archived `number` habit:

```tsx
import { NumberChart } from "./components/NumberChart";
// in JSX:
<section className="mt-6 grid gap-3 sm:grid-cols-2">
  {state.habits.filter((h) => h.kind === "number" && h.archived === 0).map((h) => (
    <NumberChart key={h.id} habit={h} entries={state.entries} from={from} to={today} />
  ))}
</section>
```

- [ ] **Step 3: Verify in browser**

Rebuild + dev, unlock. Log Pushups values for 2-3 different days (change the number input, or use curl with different dates), reload; confirm a line chart appears with a dashed goal line at 50. A habit with <2 values shows no chart.

- [ ] **Step 4: Commit**

```bash
git add src/components/NumberChart.tsx src/App.tsx
git commit -m "feat: svg trend charts for number habits"
```

---

### Task 13: Manage habits (add / edit / reorder / archive)

**Files:**
- Create: `src/components/ManageHabits.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `AppState`, `pw`, `createHabit`, `updateHabit`, `deleteHabit`, `reload`.
- Produces `ManageHabits({ state, pw, onChanged })`: only rendered/opened in edit mode. Lists habits with inline edit of name, emoji, color, kind, goal, goal_dir, unit; buttons to move up/down (swap `sort`), archive/unarchive, and delete (with confirm). An "Add habit" button creates a default `check` habit then lets you edit it. All calls use `pw`.

- [ ] **Step 1: Write `src/components/ManageHabits.tsx`**

```tsx
import { useState } from "react";
import type { AppState, Habit } from "../lib/types";
import { createHabit, updateHabit, deleteHabit } from "../lib/api";

export function ManageHabits({ state, pw, onChanged }: { state: AppState; pw: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const habits = [...state.habits].sort((a, b) => a.sort - b.sort);

  async function patch(id: number, p: Partial<Habit>) { await updateHabit(pw, id, p); onChanged(); }
  async function add() { await createHabit(pw, { name: "New habit", kind: "check", emoji: "✅", sort: habits.length }); onChanged(); }
  async function remove(id: number) { if (confirm("Delete this habit and its history?")) { await deleteHabit(pw, id); onChanged(); } }
  async function move(i: number, dir: -1 | 1) {
    const a = habits[i], b = habits[i + dir];
    if (!b) return;
    await updateHabit(pw, a.id, { sort: b.sort });
    await updateHabit(pw, b.id, { sort: a.sort });
    onChanged();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="mt-6 text-sm text-neutral-400 underline">Manage habits</button>;

  return (
    <section className="mt-6 rounded-xl border border-neutral-800 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium">Manage habits</h2>
        <button onClick={() => setOpen(false)} className="text-sm text-neutral-500">Close</button>
      </div>
      <div className="space-y-2">
        {habits.map((h, i) => (
          <div key={h.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-neutral-900 p-2">
            <input value={h.emoji} onChange={(e) => patch(h.id, { emoji: e.target.value })} className="w-10 rounded bg-neutral-800 px-2 py-1 text-center" />
            <input value={h.name} onChange={(e) => patch(h.id, { name: e.target.value })} className="min-w-32 flex-1 rounded bg-neutral-800 px-2 py-1" />
            <input type="color" value={h.color} onChange={(e) => patch(h.id, { color: e.target.value })} className="h-8 w-10 rounded bg-neutral-800" />
            <select value={h.kind} onChange={(e) => patch(h.id, { kind: e.target.value as Habit["kind"] })} className="rounded bg-neutral-800 px-2 py-1">
              <option value="check">check</option><option value="number">number</option>
            </select>
            {h.kind === "number" && (
              <>
                <input type="number" value={h.goal ?? 0} onChange={(e) => patch(h.id, { goal: Number(e.target.value) })} className="w-16 rounded bg-neutral-800 px-2 py-1" />
                <select value={h.goal_dir ?? "atLeast"} onChange={(e) => patch(h.id, { goal_dir: e.target.value as Habit["goal_dir"] })} className="rounded bg-neutral-800 px-2 py-1">
                  <option value="atLeast">≥</option><option value="atMost">≤</option>
                </select>
                <input value={h.unit} placeholder="unit" onChange={(e) => patch(h.id, { unit: e.target.value })} className="w-16 rounded bg-neutral-800 px-2 py-1" />
              </>
            )}
            <button onClick={() => move(i, -1)} className="px-1.5 text-neutral-400">↑</button>
            <button onClick={() => move(i, 1)} className="px-1.5 text-neutral-400">↓</button>
            <button onClick={() => patch(h.id, { archived: h.archived ? 0 : 1 })} className="px-1.5 text-xs text-amber-400">{h.archived ? "unarchive" : "archive"}</button>
            <button onClick={() => remove(h.id)} className="px-1.5 text-xs text-red-400">delete</button>
          </div>
        ))}
      </div>
      <button onClick={add} className="mt-3 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium">+ Add habit</button>
    </section>
  );
}
```

- [ ] **Step 2: Wire into `src/App.tsx`** — render only when `pw`:

```tsx
import { ManageHabits } from "./components/ManageHabits";
// in JSX:
{pw && <ManageHabits state={state} pw={pw} onChanged={reload} />}
```

- [ ] **Step 3: Verify in browser**

Rebuild + dev, unlock. Add a habit → appears in Today. Rename/recolor/change emoji → reflected. Switch a check to number, set goal → number input appears in Today. Move up/down reorders. Archive → drops out of Today and stats; unarchive restores. Delete (confirm) → gone. Lock → Manage disappears.

- [ ] **Step 4: Commit**

```bash
git add src/components/ManageHabits.tsx src/App.tsx
git commit -m "feat: manage habits (add/edit/reorder/archive/delete)"
```

---

### Task 14: Settings panel (title + sprint + change password)

**Files:**
- Create: `src/components/SettingsPanel.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `AppState`, `pw`, `updateSettings`, `setPassword`, `dates.istToday`, `reload`.
- Produces `SettingsPanel({ state, pw, onChanged })`: edit-mode only. Fields: title (text), sprint_on (toggle), sprint_start (date, defaults to today when enabling), sprint_len_days (number). Separate "Change edit password" sub-form (current + new) calling `setPassword(new, current)`; on success show a confirmation.

- [ ] **Step 1: Write `src/components/SettingsPanel.tsx`**

```tsx
import { useState } from "react";
import type { AppState } from "../lib/types";
import { updateSettings, setPassword } from "../lib/api";
import { istToday } from "../lib/dates";

export function SettingsPanel({ state, pw, onChanged }: { state: AppState; pw: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const s = state.settings;
  const [cur, setCur] = useState(""); const [nw, setNw] = useState(""); const [msg, setMsg] = useState("");

  async function save(patch: Record<string, unknown>) { await updateSettings(pw, patch); onChanged(); }
  async function changePw() {
    setMsg("");
    try { await setPassword(nw, cur); setMsg("Password changed."); setCur(""); setNw(""); onChanged(); }
    catch (e) { setMsg((e as Error).message); }
  }

  if (!open) return <button onClick={() => setOpen(true)} className="mt-3 ml-3 text-sm text-neutral-400 underline">Settings</button>;

  return (
    <section className="mt-6 rounded-xl border border-neutral-800 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium">Settings</h2>
        <button onClick={() => setOpen(false)} className="text-sm text-neutral-500">Close</button>
      </div>
      <label className="block text-sm">Title
        <input defaultValue={s.title} onBlur={(e) => save({ title: e.target.value })} className="mt-1 w-full rounded bg-neutral-800 px-2 py-1" />
      </label>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={s.sprint_on === 1}
          onChange={(e) => save({ sprint_on: e.target.checked ? 1 : 0, sprint_start: e.target.checked && !s.sprint_start ? istToday() : s.sprint_start })} />
        Sprint mode
      </label>
      {s.sprint_on === 1 && (
        <div className="mt-2 flex gap-3">
          <label className="text-sm">Start
            <input type="date" defaultValue={s.sprint_start ?? istToday()} onBlur={(e) => save({ sprint_start: e.target.value })} className="mt-1 block rounded bg-neutral-800 px-2 py-1" />
          </label>
          <label className="text-sm">Length (days)
            <input type="number" defaultValue={s.sprint_len_days} onBlur={(e) => save({ sprint_len_days: Number(e.target.value) })} className="mt-1 block w-24 rounded bg-neutral-800 px-2 py-1" />
          </label>
        </div>
      )}
      <div className="mt-4 border-t border-neutral-800 pt-3">
        <h3 className="text-sm font-medium">Change edit password</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <input type="password" placeholder="current" value={cur} onChange={(e) => setCur(e.target.value)} className="rounded bg-neutral-800 px-2 py-1" />
          <input type="password" placeholder="new" value={nw} onChange={(e) => setNw(e.target.value)} className="rounded bg-neutral-800 px-2 py-1" />
          <button onClick={changePw} className="rounded bg-neutral-700 px-3 py-1 text-sm">Change</button>
        </div>
        {msg && <p className="mt-2 text-sm text-neutral-400">{msg}</p>}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Wire into `src/App.tsx`** — render only when `pw`:

```tsx
import { SettingsPanel } from "./components/SettingsPanel";
// in JSX:
{pw && <SettingsPanel state={state} pw={pw} onChanged={reload} />}
```

- [ ] **Step 3: Verify in browser**

Rebuild + dev, unlock.
- Change title → header updates. Enable Sprint → header shows "Day N / len" + bar; the grid `from` now starts at sprint_start.
- Set length 84, start today → "Day 1 / 84".
- Change password with wrong current → error message; correct current → "Password changed"; Lock then Unlock with the new password works, old fails.

- [ ] **Step 4: Commit**

```bash
git add src/components/SettingsPanel.tsx src/App.tsx
git commit -m "feat: settings panel (title, sprint, change password)"
```

---

### Task 15: Final polish, full-path verification, deploy notes

**Files:**
- Modify: `README.md`, `src/App.tsx` (only if wiring gaps found)
- Create: `docs/DEPLOY.md`

**Interfaces:** none new — this task integrates and verifies.

- [ ] **Step 1: Full non-incremental typecheck + tests**

Run: `npx tsc --noEmit` → no errors.
Run: `npx vitest run` → all suites pass (dates, logic, auth).

- [ ] **Step 2: Full user-path browser walk (production build)**

Run: `npm run db:local` then `npm run build && npx wrangler dev`.
Walk, at desktop AND mobile (375px) viewport:
1. Fresh (no password): read-only; Unlock → "Set password" → set one.
2. Tick every check, enter numbers hitting goals → Today shows N/N, header streak/perfect update, today's grid cell hits brightest bucket.
3. Number charts render with goal lines once ≥2 days of data exist (log yesterday via a quick curl `PUT /api/entries` with `date=<yesterday IST>`).
4. Manage: add/edit/reorder/archive/delete all reflect immediately.
5. Settings: title, sprint on/off, change password.
6. Lock → everything read-only, all data still visible; open in a private window (no localStorage) → read-only public view works with no login.
7. Console clean (no errors); no page-level horizontal scroll on mobile (grid scrolls within its own container).

Fix any wiring gaps found, re-verify.

- [ ] **Step 3: Write `README.md` (Caveman Lite) + `docs/DEPLOY.md`**

README covers: what it is, local dev (`npm install`, `npm run db:local`, `npm run dev` for UI-only or `npm run build && npx wrangler dev` for full), and the public-read/login-to-edit model.
`docs/DEPLOY.md` covers, in order:
1. `npx wrangler d1 create habit_tracker` → put `database_id` in `wrangler.jsonc` (already done in Task 4 for local; same id works remote).
2. Apply schema+seed to REMOTE D1: `npx wrangler d1 execute habit_tracker --remote --file=./schema.sql` then `... --file=./seed.sql`.
3. `npm run deploy` (build + `wrangler deploy`), OR connect the GitHub repo to Cloudflare for git-triggered builds (build command `npm run build`, deploy command `wrangler deploy`).
4. First visit → set the edit password (your mobile number) via the Unlock modal. Nothing secret is committed.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/DEPLOY.md src/App.tsx
git commit -m "docs: readme + deploy guide; final polish"
```

- [ ] **Step 5: Push branch + open PR (do NOT merge)**

```bash
git push -u origin feat/habit-tracker
```
Open a PR `feat/habit-tracker → main` via `gh` (full path `"C:\Program Files\GitHub CLI\gh.exe" pr create --repo Mehul773/habit-tracker --base main --head feat/habit-tracker --title "..." --body-file <file>`). Then STOP — Mehul reviews and merges.

---

## Self-Review

**Spec coverage (spec §→task):**
- §4 stack/hosting → Tasks 1, 5, 15. §5 data model → Task 4 + db.ts (5,6). §6 API → Tasks 5,6. §7 auth (hash, public read, first-run) → Tasks 5,6,9,14. §8 screens: Header/stats/sprint → 9; grid → 10; Today check+number → 11; number charts → 12; manage → 13; settings → 14. §9 logic (met/active/perfect/streak/bucket/IST) → Tasks 2,3. §10 seed → Task 4. §11 testing (Vitest + browser walk) → Tasks 2,3,5,6 + walks in 8-15. §12 deploy/config → Tasks 1,4,15. §13 future → out of scope. No gaps.
- Access model (public read / login edit) covered by public GET + gated writes (Task 6) and read-only UI when `pw` null (Tasks 11,13,14).

**Placeholder scan:** No "TBD"/"add error handling"/"similar to Task N". Only intentional placeholder is `database_id` in `wrangler.jsonc`, explicitly filled in Task 4 Step 4.

**Type consistency:** `Env` (db.ts) used across worker; `AppState`/`Habit`/`Entry`/`Settings` shared from `types.ts`; `isMet(habit, entry)`, `dayStats`, `computeStreak(habits, idx, today)`, `gridBucket(frac)`, `entryKey` names consistent between logic.ts (Task 3), Header (9), Grid (10), Today (11). API client names (`fetchState`, `verify`, `setPassword`, `createHabit`, `updateHabit`, `deleteHabit`, `putEntry`, `updateSettings`) match routes in Task 6. `getPw/setPw/clearPw` (editmode) consistent with App usage (Task 9). Charts consume `habit.goal/goal_dir/color/unit` matching the `Habit` interface.
