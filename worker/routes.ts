import type { Env } from "./db";
import { getState } from "./db";
import { istToday } from "../src/lib/dates";
import { addDays } from "../src/lib/dates";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

export async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === "GET" && path === "/api/state") {
    const today = istToday();
    const from = url.searchParams.get("from") ?? addDays(today, -119);
    const to = url.searchParams.get("to") ?? today;
    return json(await getState(env, from, to));
  }

  return json({ error: "not found" }, 404);
}
