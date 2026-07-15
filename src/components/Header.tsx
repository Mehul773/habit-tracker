import type { AppState } from "../lib/types";
import { rangeDates, addDays, istToday } from "../lib/dates";
import { indexEntries, computeStreak, isPerfectDay, isActiveDay } from "../lib/logic";

function daysBetween(a: string, b: string): number {
  let n = 0, cur = a;
  while (cur < b) { cur = addDays(cur, 1); n++; }
  return n;
}

export function Header({
  state, pw, onLock, onUnlockClick, onOpenPanel,
}: { state: AppState; pw: string | null; onLock: () => void; onUnlockClick: () => void; onOpenPanel?: () => void }) {
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
        {pw && onOpenPanel && (
          <button
            onClick={onOpenPanel}
            aria-label="Manage habits and settings"
            className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm">
            ⚙
          </button>
        )}
        <button
          onClick={pw ? onLock : onUnlockClick}
          className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm">
          {pw ? "🔓 Lock" : "🔒 Unlock"}
        </button>
      </div>
    </header>
  );
}
