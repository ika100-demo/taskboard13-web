"use client";

import { useState, useTransition } from "react";
import type { FormEvent } from "react";

import { createTaskAction } from "@/app/actions";
import { NO_DUE_DATE, NO_TASKS, SAVE_FAILED, validateTitle } from "@/lib/task-validation";
import type { Task } from "@/lib/tasks-api";

export type TaskBoardProps = { initialTasks: Task[] };

export function TaskBoard({ initialTasks }: TaskBoardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError(null);
    const message = validateTitle(title);
    if (message !== null) {
      setTitleError(message);
      return;
    }
    setTitleError(null);
    startTransition(async () => {
      try {
        const result = await createTaskAction({ title, due_date: dueDate || null });
        if (result.status === "created") {
          setTasks((prev) => [...prev, result.task]);
          setTitle("");
          setDueDate("");
          setTitleError(null);
          setSaveError(null);
        } else if (result.status === "title_invalid") {
          setTitleError(result.message);
        } else {
          setSaveError(SAVE_FAILED);
        }
      } catch {
        setSaveError(SAVE_FAILED);
      }
    });
  }

  return (
    <>
      <form aria-label="Add a task" onSubmit={onSubmit} noValidate>
        <label htmlFor="title">Title</label>
        <input
          id="title"
          name="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={titleError ? true : undefined}
          aria-describedby={titleError ? "title-error" : undefined}
        />
        {titleError ? <p id="title-error">{titleError}</p> : null}
        <label htmlFor="due_date">Due date</label>
        <input
          id="due_date"
          name="due_date"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        <button type="submit" disabled={pending}>
          Add task
        </button>
        {saveError ? <p role="alert">{saveError}</p> : null}
      </form>
      {tasks.length === 0 ? (
        <p>{NO_TASKS}</p>
      ) : (
        <ul aria-label="Tasks">
          {tasks.map((task) => (
            <li key={task.id}>
              <span>{task.title}</span>{" "}
              {task.due_date === null ? (
                <span>{NO_DUE_DATE}</span>
              ) : (
                <time dateTime={task.due_date}>{task.due_date}</time>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
