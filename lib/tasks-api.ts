import { logger } from "@/lib/logger";

export type Task = { id: string; title: string; due_date: string | null }; // due_date: "YYYY-MM-DD" | null
export type ListTasksResult = { ok: true; tasks: Task[] } | { ok: false };
export type CreateTaskResult =
  | { status: "created"; task: Task }
  | { status: "title_invalid" } // the API answered 422 naming "title"
  | { status: "failed" };

type Op = "list" | "create";
type Reason = "status" | "body" | "timeout" | "network" | "config";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function fail(op: Op, reason: Reason, status?: number): void {
  if (reason === "config") {
    logger.error("tasks api call failed", { op, reason });
    return;
  }
  logger.warn("tasks api call failed", status === undefined ? { op, reason } : { op, status, reason });
}

function parseTask(value: unknown): Task | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  const { id, title, due_date } = item;
  if (typeof id !== "string" || id === "") return null;
  if (typeof title !== "string") return null;
  if (due_date !== null && !(typeof due_date === "string" && DATE_RE.test(due_date))) return null;
  return { id, title, due_date };
}

function namesTitle(body: unknown): boolean {
  if (typeof body !== "object" || body === null) return false;
  const detail = (body as { detail?: unknown }).detail;
  if (!Array.isArray(detail)) return false;
  return detail.some((entry) => {
    const loc = (entry as { loc?: unknown } | null)?.loc;
    return Array.isArray(loc) && loc.includes("title");
  });
}

type Outcome = { status: number; body: unknown } | { error: "timeout" | "network" | "body" | "config" };

async function call(method: "GET" | "POST", payload?: unknown): Promise<Outcome> {
  const base = (process.env.TASKBOARD13_API_URL ?? "").replace(/\/$/, "");
  if (base === "") return { error: "config" };
  try {
    const response = await fetch(`${base}/tasks`, {
      method,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const text = await response.text();
    let body: unknown = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = undefined; // not JSON; judged by status below
    }
    return { status: response.status, body };
  } catch (err) {
    const name = (err as { name?: string } | null)?.name;
    return { error: name === "TimeoutError" || name === "AbortError" ? "timeout" : "network" };
  }
}

export async function listTasks(): Promise<ListTasksResult> {
  const out = await call("GET");
  if ("error" in out) {
    fail("list", out.error);
    return { ok: false };
  }
  if (out.status !== 200) {
    fail("list", "status", out.status);
    return { ok: false };
  }
  if (!Array.isArray(out.body)) {
    fail("list", "body", out.status);
    return { ok: false };
  }
  const tasks: Task[] = [];
  for (const item of out.body) {
    const task = parseTask(item);
    if (!task) {
      fail("list", "body", out.status);
      return { ok: false };
    }
    tasks.push(task);
  }
  return { ok: true, tasks };
}

export async function createTask(input: { title: string; due_date: string | null }): Promise<CreateTaskResult> {
  const out = await call("POST", { title: input.title, due_date: input.due_date });
  if ("error" in out) {
    fail("create", out.error);
    return { status: "failed" };
  }
  if (out.status === 201) {
    const task = parseTask(out.body);
    if (task) return { status: "created", task };
    fail("create", "body", out.status);
    return { status: "failed" };
  }
  if (out.status === 422 && namesTitle(out.body)) return { status: "title_invalid" };
  fail("create", "status", out.status);
  return { status: "failed" };
}
