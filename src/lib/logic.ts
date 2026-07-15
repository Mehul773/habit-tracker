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
