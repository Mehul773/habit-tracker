import { useEffect, useState, useCallback } from "react";
import type { AppState } from "./lib/types";
import { fetchState } from "./lib/api";
import { getPw } from "./lib/editmode";
import { istToday } from "./lib/dates";
import { indexEntries, computeStreak } from "./lib/logic";

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [pw, _setPwState] = useState<string | null>(getPw());

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
