"use server";

import { isDueDate, TITLE_REJECTED, validateTitle } from "@/lib/task-validation";
import { createTask } from "@/lib/tasks-api";
import type { Task } from "@/lib/tasks-api";

export type CreateTaskActionResult =
  | { status: "created"; task: Task }
  | { status: "title_invalid"; message: string }
  | { status: "failed" };

export async function createTaskAction(input: {
  title: string;
  due_date: string | null;
}): Promise<CreateTaskActionResult> {
  const message = validateTitle(input.title);
  if (message !== null) return { status: "title_invalid", message };
  if (input.due_date !== null && !(typeof input.due_date === "string" && isDueDate(input.due_date))) {
    return { status: "failed" };
  }
  const result = await createTask({ title: input.title, due_date: input.due_date });
  if (result.status === "title_invalid") {
    return { status: "title_invalid", message: validateTitle(input.title) ?? TITLE_REJECTED };
  }
  return result;
}
