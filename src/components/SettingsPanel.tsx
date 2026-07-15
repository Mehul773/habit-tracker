import { useState } from "react";
import type { AppState } from "../lib/types";
import { updateSettings, setPassword } from "../lib/api";
import { istToday } from "../lib/dates";

export function SettingsPanel({ state, pw, onChanged, onPwChange }: { state: AppState; pw: string; onChanged: () => void; onPwChange: (pw: string) => void }) {
  const s = state.settings;
  const [cur, setCur] = useState(""); const [nw, setNw] = useState(""); const [msg, setMsg] = useState("");

  async function save(patch: Record<string, unknown>) {
    try { await updateSettings(pw, patch); onChanged(); }
    catch (e) { setMsg((e as Error).message); }
  }
  async function changePw() {
    setMsg("");
    try { await setPassword(nw, cur); onPwChange(nw); setMsg("Password changed."); setCur(""); setNw(""); onChanged(); }
    catch (e) { setMsg((e as Error).message); }
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm">Title
        <input defaultValue={s.title} onBlur={(e) => save({ title: e.target.value })} className="mt-1 w-full rounded bg-neutral-800 px-2 py-1" />
      </label>

      <div className="border-t border-neutral-800 pt-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.sprint_on === 1}
            onChange={(e) => save({ sprint_on: e.target.checked ? 1 : 0, sprint_start: e.target.checked && !s.sprint_start ? istToday() : s.sprint_start })} />
          Sprint mode
        </label>
        {s.sprint_on === 1 && (
          <div className="mt-2 flex flex-wrap gap-3">
            <label className="text-sm">Start
              <input type="date" defaultValue={s.sprint_start ?? istToday()} onBlur={(e) => save({ sprint_start: e.target.value })} className="mt-1 block rounded bg-neutral-800 px-2 py-1" />
            </label>
            <label className="text-sm">Length (days)
              <input type="number" defaultValue={s.sprint_len_days} onBlur={(e) => save({ sprint_len_days: Number(e.target.value) })} className="mt-1 block w-24 rounded bg-neutral-800 px-2 py-1" />
            </label>
          </div>
        )}
      </div>

      <div className="border-t border-neutral-800 pt-3">
        <h3 className="text-sm font-medium">Change edit password</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <input type="password" placeholder="current" value={cur} onChange={(e) => setCur(e.target.value)} className="rounded bg-neutral-800 px-2 py-1" />
          <input type="password" placeholder="new" value={nw} onChange={(e) => setNw(e.target.value)} className="rounded bg-neutral-800 px-2 py-1" />
          <button onClick={changePw} className="rounded bg-neutral-700 px-3 py-1 text-sm">Change</button>
        </div>
      </div>

      {msg && <p className="text-sm text-neutral-400">{msg}</p>}
    </div>
  );
}
