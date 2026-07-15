import { useEffect, useState, useCallback } from "react";
import type { AppState } from "./lib/types";
import { fetchState } from "./lib/api";
import { getPw, setPw as savePw, clearPw } from "./lib/editmode";
import { Header } from "./components/Header";
import { LoginModal } from "./components/LoginModal";
import { Grid } from "./components/Grid";
import { Today } from "./components/Today";
import { NumberChart } from "./components/NumberChart";
import { Sidebar } from "./components/Sidebar";
import { istToday, addDays } from "./lib/dates";

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [pw, setPwState] = useState<string | null>(getPw());
  const [showLogin, setShowLogin] = useState(false);
  const [showPanel, setShowPanel] = useState(false);

  const reload = useCallback(() => { fetchState().then(setState); }, []);
  useEffect(() => { reload(); }, [reload]);

  function onUnlockSuccess(p: string) { savePw(p); setPwState(p); setShowLogin(false); reload(); }
  function onLock() { clearPw(); setPwState(null); }
  function onPwChange(p: string) { savePw(p); setPwState(p); }

  if (!state) return <div className="p-6">Loading…</div>;

  const today = istToday();
  const from = state.settings.sprint_on && state.settings.sprint_start
    ? state.settings.sprint_start : addDays(today, -119);

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <Header state={state} pw={pw} onLock={onLock} onUnlockClick={() => setShowLogin(true)} onOpenPanel={() => setShowPanel(true)} />
      {showLogin && (
        <LoginModal hasPassword={state.settings.has_password}
          onClose={() => setShowLogin(false)} onSuccess={onUnlockSuccess} />
      )}
      <section className="mt-6">
        <h2 className="mb-1 text-sm font-medium text-neutral-400">The grid</h2>
        <Grid state={state} from={from} to={today} />
      </section>
      <Today state={state} pw={pw} onChanged={reload} />
      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        {state.habits.filter((h) => h.kind === "number" && h.archived === 0).map((h) => (
          <NumberChart key={h.id} habit={h} entries={state.entries} from={from} to={today} />
        ))}
      </section>
      {pw && (
        <Sidebar
          open={showPanel} onClose={() => setShowPanel(false)}
          state={state} pw={pw} onChanged={reload} onPwChange={onPwChange}
        />
      )}
    </div>
  );
}
