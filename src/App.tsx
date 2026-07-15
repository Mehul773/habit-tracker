import { useEffect, useState, useCallback } from "react";
import type { AppState } from "./lib/types";
import { fetchState } from "./lib/api";
import { getPw, setPw as savePw, clearPw } from "./lib/editmode";
import { Header } from "./components/Header";
import { LoginModal } from "./components/LoginModal";

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [pw, setPwState] = useState<string | null>(getPw());
  const [showLogin, setShowLogin] = useState(false);

  const reload = useCallback(() => { fetchState().then(setState); }, []);
  useEffect(() => { reload(); }, [reload]);

  function onUnlockSuccess(p: string) { savePw(p); setPwState(p); setShowLogin(false); reload(); }
  function onLock() { clearPw(); setPwState(null); }

  if (!state) return <div className="p-6">Loading…</div>;

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <Header state={state} pw={pw} onLock={onLock} onUnlockClick={() => setShowLogin(true)} />
      {showLogin && (
        <LoginModal hasPassword={state.settings.has_password}
          onClose={() => setShowLogin(false)} onSuccess={onUnlockSuccess} />
      )}
      {/* Grid, Today, charts, Manage, Settings wired in later tasks */}
    </div>
  );
}
