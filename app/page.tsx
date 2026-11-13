import Link from "next/link";

import { TaskBoard } from "@/app/_components/task-board";
import { LOAD_FAILED } from "@/lib/task-validation";
import { listTasks } from "@/lib/tasks-api";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const result = await listTasks();

  return (
    <section className="board" aria-labelledby="board-title">
      <h1 id="board-title" className="section-title">
        Task board
      </h1>
      {result.ok ? (
        <TaskBoard initialTasks={result.tasks} />
      ) : (
        <>
          <p role="alert" className="board-alert">
            {LOAD_FAILED}
          </p>
          <Link className="btn btn-secondary" href="/">
            Try again
          </Link>
        </>
      )}
    </section>
  );
}
