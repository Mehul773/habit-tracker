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
