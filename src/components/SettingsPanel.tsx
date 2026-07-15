import { useState } from "react";
import type { AppState } from "../lib/types";
import { updateSettings, setPassword } from "../lib/api";
import { istToday } from "../lib/dates";

export function SettingsPanel({ state, pw, onChanged }: { state: AppState; pw: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const s = state.settings;
  const [cur, setCur] = useState(""); const [nw, setNw] = useState(""); const [msg, setMsg] = useState("");

  async function save(patch: Record<string, unknown>) { await updateSettings(pw, patch); onChanged(); }
  async function changePw() {
    setMsg("");
    try { await setPassword(nw, cur); setMsg("Password changed."); setCur(""); setNw(""); onChanged(); }
    catch (e) { setMsg((e as Error).message); }
  }

  if (!open) return <button onClick={() => setOpen(true)} className="mt-3 ml-3 text-sm text-neutral-400 underline">Settings</button>;

  return (
    <section className="mt-6 rounded-xl border border-neutral-800 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium">Settings</h2>
        <button onClick={() => setOpen(false)} className="text-sm text-neutral-500">Close</button>
      </div>
      <label className="block text-sm">Title
        <input defaultValue={s.title} onBlur={(e) => save({ title: e.target.value })} className="mt-1 w-full rounded bg-neutral-800 px-2 py-1" />
      </label>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={s.sprint_on === 1}
          onChange={(e) => save({ sprint_on: e.target.checked ? 1 : 0, sprint_start: e.target.checked && !s.sprint_start ? istToday() : s.sprint_start })} />
        Sprint mode
      </label>
      {s.sprint_on === 1 && (
        <div className="mt-2 flex gap-3">
          <label className="text-sm">Start
            <input type="date" defaultValue={s.sprint_start ?? istToday()} onBlur={(e) => save({ sprint_start: e.target.value })} className="mt-1 block rounded bg-neutral-800 px-2 py-1" />
          </label>
          <label className="text-sm">Length (days)
            <input type="number" defaultValue={s.sprint_len_days} onBlur={(e) => save({ sprint_len_days: Number(e.target.value) })} className="mt-1 block w-24 rounded bg-neutral-800 px-2 py-1" />
          </label>
        </div>
      )}
      <div className="mt-4 border-t border-neutral-800 pt-3">
        <h3 className="text-sm font-medium">Change edit password</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <input type="password" placeholder="current" value={cur} onChange={(e) => setCur(e.target.value)} className="rounded bg-neutral-800 px-2 py-1" />
          <input type="password" placeholder="new" value={nw} onChange={(e) => setNw(e.target.value)} className="rounded bg-neutral-800 px-2 py-1" />
          <button onClick={changePw} className="rounded bg-neutral-700 px-3 py-1 text-sm">Change</button>
        </div>
        {msg && <p className="mt-2 text-sm text-neutral-400">{msg}</p>}
      </div>
    </section>
  );
}
