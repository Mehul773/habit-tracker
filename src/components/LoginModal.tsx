import { useState } from "react";
import { verify, setPassword } from "../lib/api";

export function LoginModal({
  hasPassword, onClose, onSuccess,
}: { hasPassword: boolean; onClose: () => void; onSuccess: (pw: string) => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");

  async function submit() {
    setErr("");
    if (!hasPassword) {
      if (pw.length < 4) return setErr("Choose at least 4 characters.");
      await setPassword(pw);
      return onSuccess(pw);
    }
    if (await verify(pw)) onSuccess(pw);
    else setErr("Wrong password.");
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-neutral-900 p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">{hasPassword ? "Unlock editing" : "Set an edit password"}</h2>
        <input
          type="password" autoFocus value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={hasPassword ? "Password" : "New password (your mobile number)"}
          className="mt-3 w-full rounded-lg bg-neutral-800 px-3 py-2 outline-none"
        />
        {err && <p className="mt-2 text-sm text-red-400">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-neutral-400">Cancel</button>
          <button onClick={submit} className="rounded-lg bg-green-600 px-3 py-1.5 font-medium">
            {hasPassword ? "Unlock" : "Set"}
          </button>
        </div>
      </div>
    </div>
  );
}
