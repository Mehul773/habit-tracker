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
