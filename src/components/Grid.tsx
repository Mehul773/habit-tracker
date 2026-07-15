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
