// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("Task API client and server action", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    process.env.TASKBOARD13_API_URL = "http://api.test/";
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TASKBOARD13_API_URL;
  });

  it("AC-001.1 listTasks returns the tasks in the API's order from GET /tasks", async () => {
    const body = [
      { id: "a1", title: "First", due_date: "2026-12-01" },
      { id: "b2", title: "Second", due_date: null },
    ];
    fetchMock.mockResolvedValue(jsonResponse(body));
    const { listTasks } = await import("@/lib/tasks-api");
    expect(await listTasks()).toEqual({ ok: true, tasks: body });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("http://api.test/tasks");
    expect(init?.method ?? "GET").toBe("GET");
  });

  it("AC-001.4 createTask POSTs title and due_date and returns the created task", async () => {
    const task = { id: "n1", title: "Buy milk", due_date: "2026-12-01" };
    fetchMock.mockResolvedValue(jsonResponse(task, 201));
    const { createTask } = await import("@/lib/tasks-api");
    expect(await createTask({ title: "Buy milk", due_date: "2026-12-01" })).toEqual({ status: "created", task });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("http://api.test/tasks");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ title: "Buy milk", due_date: "2026-12-01" });
  });

  it("AC-001.5 createTask sends due_date null explicitly", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "n1", title: "Buy milk", due_date: null }, 201));
    const { createTask } = await import("@/lib/tasks-api");
    await createTask({ title: "Buy milk", due_date: null });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toHaveProperty("due_date", null);
    expect(body.title).toBe("Buy milk");
  });

  it("AC-001.6 the server action rejects an invalid title without calling the API", async () => {
    const { createTaskAction } = await import("@/app/actions");
    for (const title of ["", "   ", "x".repeat(201)]) {
      const result = await createTaskAction({ title, due_date: null });
      expect(result.status).toBe("title_invalid");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("AC-001.7 a 422 naming title becomes title_invalid with a message", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ detail: [{ loc: ["body", "title"], msg: "bad", type: "value_error", input: "x" }] }, 422),
    );
    const { createTaskAction } = await import("@/app/actions");
    const result = await createTaskAction({ title: "Buy milk", due_date: null });
    expect(result.status).toBe("title_invalid");
    expect(result).toEqual({ status: "title_invalid", message: "The title was not accepted. Please check it." });
  });

  it.each([
    ["a 422 for another field", () => fetchMock.mockResolvedValue(jsonResponse({ detail: [{ loc: ["body", "due_date"] }] }, 422))],
    ["a 503", () => fetchMock.mockResolvedValue(jsonResponse({ error: "db down" }, 503))],
    ["an unlisted status", () => fetchMock.mockResolvedValue(jsonResponse({}, 500))],
    ["a 201 with a malformed body", () => fetchMock.mockResolvedValue(jsonResponse({ nope: true }, 201))],
    ["a network error", () => fetchMock.mockRejectedValue(new TypeError("fetch failed"))],
    ["a timeout", () => fetchMock.mockRejectedValue(new DOMException("timed out", "TimeoutError"))],
  ])("AC-001.8 createTask reports failed on %s", async (_name, arrange) => {
    arrange();
    const { createTask } = await import("@/lib/tasks-api");
    expect(await createTask({ title: "Buy milk", due_date: null })).toEqual({ status: "failed" });
  });

  // A fetch that never answers and only ends when its signal aborts. AbortSignal.timeout runs on a
  // timer fake timers do not control, so it is replaced by a signal that the fake clock aborts.
  async function exerciseTimeout(call: () => Promise<unknown>, expected: unknown) {
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms: number) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException("timed out", "TimeoutError")), ms);
      return controller.signal;
    });
    fetchMock.mockImplementation(
      (_url: unknown, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => reject(init.signal.reason));
        }),
    );
    vi.useFakeTimers();
    try {
      let settled: unknown;
      const pending = call().then((value) => {
        settled = value;
      });
      await vi.advanceTimersByTimeAsync(4999);
      expect(settled).toBeUndefined();
      await vi.advanceTimersByTimeAsync(1);
      await pending;
      expect(settled).toEqual(expected);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const init = fetchMock.mock.calls[0][1];
      expect(init.signal).toBeInstanceOf(AbortSignal);
      expect(init.signal.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
  }

  it("AC-001.8 listTasks gives up at 5000 ms and not before", async () => {
    const { listTasks } = await import("@/lib/tasks-api");
    await exerciseTimeout(() => listTasks(), { ok: false });
  });

  it("AC-001.8 createTask gives up at 5000 ms and not before", async () => {
    const { createTask } = await import("@/lib/tasks-api");
    await exerciseTimeout(() => createTask({ title: "Buy milk", due_date: null }), { status: "failed" });
  });
});
