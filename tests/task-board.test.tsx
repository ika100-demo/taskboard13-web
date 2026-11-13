import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createTaskAction = vi.fn();
vi.mock("@/app/actions", () => ({ createTaskAction: (...args: unknown[]) => createTaskAction(...args) }));

type Task = { id: string; title: string; due_date: string | null };

async function renderBoard(initialTasks: Task[] = []) {
  const boardModule = "@/app/_components/task-board";
  const { TaskBoard } = await import(/* @vite-ignore */ boardModule);
  render(<TaskBoard initialTasks={initialTasks} />);
  return {
    form: screen.getByRole("form", { name: "Add a task" }),
    title: screen.getByLabelText("Title") as HTMLInputElement,
    due: screen.getByLabelText("Due date") as HTMLInputElement,
    submit: () => fireEvent.click(screen.getByRole("button", { name: "Add task" })),
  };
}

const existing: Task[] = [{ id: "a1", title: "Existing", due_date: "2026-01-02" }];

describe("task board form", () => {
  beforeEach(() => {
    createTaskAction.mockReset();
  });

  it("AC-001.4 sends title and due date, appends the task and clears the form", async () => {
    createTaskAction.mockResolvedValue({
      status: "created",
      task: { id: "n1", title: "Buy milk", due_date: "2026-12-01" },
    });
    const { title, due, submit } = await renderBoard(existing);
    fireEvent.change(title, { target: { value: "Buy milk" } });
    fireEvent.change(due, { target: { value: "2026-12-01" } });
    submit();
    await waitFor(() => expect(within(screen.getByRole("list", { name: "Tasks" })).getAllByRole("listitem")).toHaveLength(2));
    expect(createTaskAction).toHaveBeenCalledWith({ title: "Buy milk", due_date: "2026-12-01" });
    const items = within(screen.getByRole("list", { name: "Tasks" })).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Existing");
    expect(items[1]).toHaveTextContent("Buy milk");
    expect(items[1]).toHaveTextContent("2026-12-01");
    expect(title.value).toBe("");
    expect(due.value).toBe("");
  });

  it("AC-001.4 replaces No tasks yet with the list on the first created task", async () => {
    createTaskAction.mockResolvedValue({ status: "created", task: { id: "n1", title: "Buy milk", due_date: null } });
    const { title, submit } = await renderBoard([]);
    expect(screen.getByText("No tasks yet")).toBeInTheDocument();
    fireEvent.change(title, { target: { value: "Buy milk" } });
    submit();
    await waitFor(() => expect(screen.getByRole("list", { name: "Tasks" })).toBeInTheDocument());
    expect(screen.queryByText("No tasks yet")).not.toBeInTheDocument();
  });

  it("AC-001.5 sends due_date null without a date and shows No due date", async () => {
    createTaskAction.mockResolvedValue({ status: "created", task: { id: "n1", title: "Buy milk", due_date: null } });
    const { title, submit } = await renderBoard(existing);
    fireEvent.change(title, { target: { value: "Buy milk" } });
    submit();
    await waitFor(() => expect(within(screen.getByRole("list", { name: "Tasks" })).getAllByRole("listitem")).toHaveLength(2));
    expect(createTaskAction).toHaveBeenCalledWith({ title: "Buy milk", due_date: null });
    const items = within(screen.getByRole("list", { name: "Tasks" })).getAllByRole("listitem");
    expect(items[1]).toHaveTextContent("Buy milk");
    expect(items[1]).toHaveTextContent("No due date");
  });

  it.each([
    ["empty", "", /enter a title/i],
    ["whitespace-only", "   ", /enter a title/i],
    ["longer than 200 characters", "x".repeat(201), /at most 200/i],
  ])("AC-001.6 rejects a title that is %s without calling the server", async (_name, value, message) => {
    const { title, due, submit } = await renderBoard(existing);
    fireEvent.change(title, { target: { value } });
    fireEvent.change(due, { target: { value: "2026-12-01" } });
    submit();
    const error = await screen.findByText(message);
    expect(error.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(createTaskAction).not.toHaveBeenCalled();
    expect(title.value).toBe(value);
    expect(due.value).toBe("2026-12-01");
    expect(within(screen.getByRole("list", { name: "Tasks" })).getAllByRole("listitem")).toHaveLength(1);
  });

  it("AC-001.6 accepts a title of exactly 200 characters", async () => {
    createTaskAction.mockResolvedValue({ status: "created", task: { id: "n1", title: "x".repeat(200), due_date: null } });
    const { title, submit } = await renderBoard(existing);
    fireEvent.change(title, { target: { value: "x".repeat(200) } });
    submit();
    await waitFor(() => expect(createTaskAction).toHaveBeenCalledTimes(1));
  });

  it("AC-001.7 shows a message next to the title when the API rejects the title and keeps the values", async () => {
    createTaskAction.mockResolvedValue({ status: "title_invalid", message: "The title was not accepted. Please check it." });
    const { title, due, submit } = await renderBoard(existing);
    fireEvent.change(title, { target: { value: "Buy milk" } });
    fireEvent.change(due, { target: { value: "2026-12-01" } });
    submit();
    const error = await screen.findByText("The title was not accepted. Please check it.");
    expect(error.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(title.value).toBe("Buy milk");
    expect(due.value).toBe("2026-12-01");
    expect(within(screen.getByRole("list", { name: "Tasks" })).getAllByRole("listitem")).toHaveLength(1);
  });

  it.each([
    ["the action reports failed", () => createTaskAction.mockResolvedValue({ status: "failed" })],
    ["the action throws", () => createTaskAction.mockRejectedValue(new Error("boom"))],
  ])("AC-001.8 shows the save error and keeps the values when %s", async (_name, arrange) => {
    arrange();
    const { title, due, submit } = await renderBoard(existing);
    fireEvent.change(title, { target: { value: "Buy milk" } });
    fireEvent.change(due, { target: { value: "2026-12-01" } });
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("The task could not be saved. Please try again.");
    expect(title.value).toBe("Buy milk");
    expect(due.value).toBe("2026-12-01");
    expect(within(screen.getByRole("list", { name: "Tasks" })).getAllByRole("listitem")).toHaveLength(1);
  });
});
