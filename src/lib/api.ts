import type { AppState, Habit, Entry } from "./types";

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...opts,
    headers: { "content-type": "application/json", ...(opts.headers ?? {}) },
  });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? res.statusText);
  return res.json() as Promise<T>;
}
const auth = (pw: string) => ({ authorization: `Bearer ${pw}` });

export const fetchState = () => req<AppState>("/api/state");

export const verify = (password: string) =>
  req<{ ok: boolean }>("/api/auth/verify", { method: "POST", body: JSON.stringify({ password }) }).then((r) => r.ok);

export const setPassword = (newPassword: string, currentPassword?: string) =>
  req<{ ok: true }>("/api/auth/set", { method: "POST", body: JSON.stringify({ newPassword, currentPassword }) }).then(() => {});

export const createHabit = (pw: string, h: Partial<Habit>) =>
  req<{ id: number }>("/api/habits", { method: "POST", headers: auth(pw), body: JSON.stringify(h) }).then((r) => r.id);

export const updateHabit = (pw: string, id: number, patch: Partial<Habit>) =>
  req(`/api/habits/${id}`, { method: "PATCH", headers: auth(pw), body: JSON.stringify(patch) }).then(() => {});

export const deleteHabit = (pw: string, id: number) =>
  req(`/api/habits/${id}`, { method: "DELETE", headers: auth(pw) }).then(() => {});

export const putEntry = (pw: string, e: Entry) =>
  req("/api/entries", { method: "PUT", headers: auth(pw), body: JSON.stringify(e) }).then(() => {});

export const updateSettings = (pw: string, patch: Record<string, unknown>) =>
  req("/api/settings", { method: "PATCH", headers: auth(pw), body: JSON.stringify(patch) }).then(() => {});
