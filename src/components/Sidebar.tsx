import { useState } from "react";
import type { AppState } from "../lib/types";
import { ManageHabits } from "./ManageHabits";
import { SettingsPanel } from "./SettingsPanel";

export function Sidebar({
  open, onClose, state, pw, onChanged, onPwChange,
}: {
  open: boolean;
  onClose: () => void;
  state: AppState;
  pw: string;
  onChanged: () => void;
  onPwChange: (pw: string) => void;
}) {
  const [tab, setTab] = useState<"habits" | "settings">("habits");

  const Tab = ({ id, label }: { id: "habits" | "settings"; label: string }) => (
    <button
      onClick={() => setTab(id)}
      className={`rounded-lg px-3 py-1.5 text-sm ${tab === id ? "bg-neutral-800 font-medium text-neutral-100" : "text-neutral-400 hover:text-neutral-200"}`}
    >{label}</button>
  );

  return (
    <>
      {/* backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        aria-hidden={!open}
      />
      {/* panel: full-width on mobile, fixed panel on desktop */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-neutral-800 bg-neutral-950 shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
        role="dialog" aria-label="Manage and settings" aria-hidden={!open}
      >
        <div className="flex items-center justify-between gap-2 border-b border-neutral-800 p-3">
          <div className="flex gap-1">
            <Tab id="habits" label="Habits" />
            <Tab id="settings" label="Settings" />
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-neutral-400 hover:text-neutral-100">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {tab === "habits"
            ? <ManageHabits state={state} pw={pw} onChanged={onChanged} />
            : <SettingsPanel state={state} pw={pw} onChanged={onChanged} onPwChange={onPwChange} />}
        </div>
      </aside>
    </>
  );
}
