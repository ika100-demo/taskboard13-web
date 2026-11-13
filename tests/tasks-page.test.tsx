import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions", () => ({ createTaskAction: vi.fn() }));

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function renderPage() {
  const { default: HomePage } = await import("@/app/page");
  render(await HomePage());
}

describe("start page", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    process.env.TASKBOARD13_API_URL = "http://api.test";
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TASKBOARD13_API_URL;
  });

  it("AC-001.1 lists every task in the API's order with title and due date or No due date", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([
        { id: "a1", title: "First", due_date: "2026-12-01" },
        { id: "b2", title: "Second", due_date: null },
        { id: "c3", title: "Third", due_date: "2027-01-31" },
      ]),
    );
    await renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Task board" })).toBeInTheDocument();
    const items = within(screen.getByRole("list", { name: "Tasks" })).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("First");
    expect(items[0]).toHaveTextContent("2026-12-01");
    expect(items[1]).toHaveTextContent("Second");
    expect(items[1]).toHaveTextContent("No due date");
    expect(items[2]).toHaveTextContent("Third");
    expect(items[2]).toHaveTextContent("2027-01-31");
    expect(items[0]).not.toHaveTextContent("No due date");
    expect(screen.queryByText("No tasks yet")).not.toBeInTheDocument();
  });

  it("AC-001.2 shows No tasks yet when the API returns an empty list", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));
    await renderPage();
    expect(screen.getByText("No tasks yet")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Tasks" })).not.toBeInTheDocument();
  });

  it("AC-001.3 shows a markup title literally and creates no b element", async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ id: "a1", title: "<b>Buy milk</b>", due_date: null }]));
    await renderPage();
    const list = screen.getByRole("list", { name: "Tasks" });
    expect(within(list).getByText("<b>Buy milk</b>")).toBeInTheDocument();
    expect(list.querySelector("b")).toBeNull();
  });

  it.each([
    ["the API is unreachable", () => fetchMock.mockRejectedValue(new TypeError("fetch failed"))],
    ["the API answers 503", () => fetchMock.mockResolvedValue(jsonResponse({ error: "db down" }, 503))],
    ["the API answers an unlisted status", () => fetchMock.mockResolvedValue(jsonResponse([], 418))],
    ["the API answers a malformed body", () => fetchMock.mockResolvedValue(new Response("not json", { status: 200 }))],
    ["the API times out", () => fetchMock.mockRejectedValue(new DOMException("timed out", "TimeoutError"))],
  ])("AC-001.8 shows the load error instead of a list when %s", async (_name, arrange) => {
    arrange();
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent("Tasks could not be loaded. Please try again.");
    expect(screen.queryByRole("list", { name: "Tasks" })).not.toBeInTheDocument();
    expect(screen.queryByText("No tasks yet")).not.toBeInTheDocument();
  });
});
