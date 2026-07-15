import type { Env } from "./db";
import {
  getState, currentHash, createHabit, updateHabit, deleteHabit,
  upsertEntry, updateSettings, setPassword,
} from "./db";
import { verifyPassword } from "./auth";
import { istToday, addDays } from "../src/lib/dates";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

function bearer(request: Request): string {
  const h = request.headers.get("authorization") ?? "";
  return h.startsWith("Bearer ") ? h.slice(7) : "";
}

async function gate(request: Request, env: Env): Promise<boolean> {
  return verifyPassword(bearer(request), await currentHash(env));
}

export async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // public read
  if (method === "GET" && path === "/api/state") {
    const today = istToday();
    // wide default so long sprints are fully covered
    const from = url.searchParams.get("from") ?? addDays(today, -399);
    const to = url.searchParams.get("to") ?? today;
    return json(await getState(env, from, to));
  }

  // verify (no gate)
  if (method === "POST" && path === "/api/auth/verify") {
    const { password } = await request.json<{ password: string }>();
    return json({ ok: await verifyPassword(password, await currentHash(env)) });
  }

  // set/change password
  if (method === "POST" && path === "/api/auth/set") {
    const { newPassword, currentPassword } = await request.json<{ newPassword: string; currentPassword?: string }>();
    if (!newPassword) return json({ error: "newPassword required" }, 400);
    const existing = await currentHash(env);
    if (existing && !(await verifyPassword(currentPassword ?? "", existing))) {
      return json({ error: "wrong current password" }, 401);
    }
    await setPassword(env, newPassword);
    return json({ ok: true });
  }

  // everything below is gated
  if (!(await gate(request, env))) return json({ error: "unauthorized" }, 401);

  if (method === "POST" && path === "/api/habits") {
    const id = await createHabit(env, await request.json());
    return json({ id });
  }

  const habitMatch = path.match(/^\/api\/habits\/(\d+)$/);
  if (habitMatch) {
    const id = Number(habitMatch[1]);
    if (method === "PATCH") { await updateHabit(env, id, await request.json()); return json({ ok: true }); }
    if (method === "DELETE") { await deleteHabit(env, id); return json({ ok: true }); }
  }

  if (method === "PUT" && path === "/api/entries") {
    await upsertEntry(env, await request.json());
    return json({ ok: true });
  }

  if (method === "PATCH" && path === "/api/settings") {
    await updateSettings(env, await request.json());
    return json({ ok: true });
  }

  return json({ error: "not found" }, 404);
}
