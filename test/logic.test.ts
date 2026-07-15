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
