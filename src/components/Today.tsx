import { useState } from "react";
import type { AppState, Entry } from "../lib/types";
import { istToday } from "../lib/dates";
import { indexEntries, isMet, entryKey } from "../lib/logic";
import { putEntry } from "../lib/api";

export function Today({
  state, pw, onChanged, onRequestUnlock,
}: { state: AppState; pw: string | null; onChanged: () => void; onRequestUnlock: () => void }) {
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
              onClickCapture={(e) => { if (!pw) { e.preventDefault(); e.stopPropagation(); onRequestUnlock(); } }}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${met ? "border-green-700 bg-green-950/40" : "border-neutral-800 bg-neutral-900"} ${!pw ? "cursor-pointer" : ""}`}>
              <span className="text-lg">{h.emoji}</span>
              <span className="flex-1">{h.name}</span>
              {h.kind === "check" ? (
                <button
                  disabled={busy === h.id}
                  onClick={() => pw && write({ habit_id: h.id, date: today, value: null, done: met ? 0 : 1 })}
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
      {!pw && <p className="mt-2 text-xs text-neutral-600">Tap any habit to unlock and edit.</p>}
    </section>
  );
}
