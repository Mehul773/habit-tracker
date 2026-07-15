import type { Habit, Entry, Settings, AppState } from "../src/lib/types";
import { sha256Hex } from "./auth";

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
