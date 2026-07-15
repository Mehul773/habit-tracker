import type { Habit, Entry } from "../lib/types";
import { rangeDates } from "../lib/dates";

const W = 320, H = 90, PAD = 8;

export function NumberChart({ habit, entries, from, to }: { habit: Habit; entries: Entry[]; from: string; to: string }) {
  const days = rangeDates(from, to);
  const byDate = new Map(entries.filter((e) => e.habit_id === habit.id && e.value != null).map((e) => [e.date, e.value as number]));
  const pts = days.map((d, i) => ({ i, v: byDate.get(d) })).filter((p) => p.v != null) as { i: number; v: number }[];
  const enough = pts.length >= 2;

  // Scale from whatever we have (logged values + the goal). Falls back to 0..1 so
  // the card + goal line still render before any data exists.
  const vals = pts.map((p) => p.v).concat(habit.goal != null ? [habit.goal] : []);
  const min = vals.length ? Math.min(...vals) : 0;
  const max = vals.length ? Math.max(...vals) : 1;
  const span = max - min || 1;
  const x = (i: number) => PAD + (i / Math.max(days.length - 1, 1)) * (W - 2 * PAD);
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - 2 * PAD);
  const path = pts.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const goalY = habit.goal != null ? y(habit.goal) : null;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3">
      <div className="mb-1 flex items-center justify-between text-xs text-neutral-400">
        <span>{habit.emoji} {habit.name} {habit.unit && <span className="text-neutral-600">({habit.unit})</span>}</span>
        {habit.goal != null && <span className="text-neutral-600">goal {habit.goal_dir === "atMost" ? "≤" : "≥"} {habit.goal}</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: H }}>
        {goalY != null && <line x1={PAD} y1={goalY} x2={W - PAD} y2={goalY} stroke="#6b7280" strokeDasharray="4 3" />}
        {enough && <path d={path} fill="none" stroke={habit.color} strokeWidth={2} />}
        {pts.map((p) => <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r={2.5} fill={habit.color} />)}
      </svg>
      {!enough && (
        <p className="mt-1 text-center text-xs text-neutral-600">
          {pts.length === 0 ? "No data yet — log a value each day to build your trend." : "One more day and the line appears."}
        </p>
      )}
    </div>
  );
}
